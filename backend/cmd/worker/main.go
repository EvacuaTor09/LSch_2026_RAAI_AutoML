package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/modelclient"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
	"lsch2026/backend/internal/worker"

	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	storeConn, err := store.NewPostgresStore(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("init store: %v", err)
	}
	defer storeConn.Close()

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPass,
		DB:       cfg.RedisDB,
	})
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("init redis: %v", err)
	}
	defer redisClient.Close()

	taskQueue := queue.NewRedisQueue(redisClient, "automl:tasks")
	client := modelclient.NewClient(cfg, redisClient)
	service := worker.NewService(storeConn, taskQueue, client)
	if err := recoverQueueBacklog(ctx, storeConn, redisClient, "automl:tasks"); err != nil {
		log.Printf("queue recovery warning: %v", err)
	}

	log.Printf("worker started")
	if err := service.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("worker stopped with error: %v", err)
	}
}

func recoverQueueBacklog(
	ctx context.Context,
	taskStore *store.PostgresStore,
	redisClient *redis.Client,
	queueKey string,
) error {
	queuedIDs, err := redisClient.LRange(ctx, queueKey, 0, -1).Result()
	if err != nil {
		return err
	}
	inQueue := make(map[string]struct{}, len(queuedIDs))
	for _, id := range queuedIDs {
		trimmed := strings.TrimSpace(id)
		if trimmed != "" {
			inQueue[trimmed] = struct{}{}
		}
	}

	tasks, err := taskStore.List(ctx)
	if err != nil {
		return err
	}

	recovered := 0
	for _, task := range tasks {
		if task.Status != "queued" && task.Status != "running" {
			continue
		}
		if _, exists := inQueue[task.ID]; exists {
			continue
		}
		if err := redisClient.RPush(ctx, queueKey, task.ID).Err(); err != nil {
			return err
		}
		inQueue[task.ID] = struct{}{}
		recovered++
	}
	if recovered > 0 {
		log.Printf("recovered %d task(s) into queue", recovered)
	}
	return nil
}
