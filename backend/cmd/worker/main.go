package main

import (
	"context"
	"log"
	"os"
	"os/signal"
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

	log.Printf("worker started")
	if err := service.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("worker stopped with error: %v", err)
	}
}
