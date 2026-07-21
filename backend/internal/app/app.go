package app

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/dataset"
	"lsch2026/backend/internal/httpapi"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
)

type App struct {
	router *httpapi.Router
	store  *store.PostgresStore
	redis  *redis.Client
}

func New(ctx context.Context, cfg config.Config) (*App, error) {
	storeConn, err := store.NewPostgresStore(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init store: %w", err)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPass,
		DB:       cfg.RedisDB,
	})
	if err := redisClient.Ping(ctx).Err(); err != nil {
		_ = storeConn.Close()
		return nil, fmt.Errorf("init redis: %w", err)
	}

	datasetService := dataset.NewService(cfg.DataDir)
	taskQueue := queue.NewRedisQueue(redisClient, "automl:tasks")

	application := &App{
		router: httpapi.NewRouter(httpapi.Deps{
			Config:  cfg,
			Store:   storeConn,
			Queue:   taskQueue,
			Dataset: datasetService,
		}),
		store: storeConn,
		redis: redisClient,
	}
	return application, nil
}

func (a *App) Router() *httpapi.Router {
	return a.router
}

func (a *App) Close() error {
	if a.redis != nil {
		_ = a.redis.Close()
	}
	if a.store != nil {
		return a.store.Close()
	}
	return nil
}
