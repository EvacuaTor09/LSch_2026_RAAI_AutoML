package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr string
	DataDir  string

	PostgresDSN string
	RedisAddr   string
	RedisPass   string
	RedisDB     int

	JWTSecret     string
	TokenTTL      time.Duration

	APIBase string

	ResNetReplicas []string
	VGGReplicas    []string
	ViTReplicas    []string

	TrainEpochs   int
	BatchSize     int
	ImageSize     int
	LearningRate  float64
	ModelRequestTimeout time.Duration
	LockTTLMillis int
}

func Load() Config {
	return Config{
		HTTPAddr:            envOrDefault("HTTP_ADDR", ":8080"),
		DataDir:             envOrDefault("DATA_DIR", "./storage"),
		PostgresDSN:         envOrDefault("POSTGRES_DSN", "postgres://automl:automl@postgres:5432/automl?sslmode=disable"),
		RedisAddr:           envOrDefault("REDIS_ADDR", "redis:6379"),
		RedisPass:           envOrDefault("REDIS_PASSWORD", ""),
		RedisDB:             envOrInt("REDIS_DB", 0),
		JWTSecret:           envOrDefault("JWT_SECRET", "dev-secret-change-me"),
		TokenTTL:            envOrDuration("JWT_TTL", 24*time.Hour),
		APIBase:             envOrDefault("API_BASE", "http://localhost:8080"),
		ResNetReplicas:      envOrList("RESNET_REPLICAS", []string{"http://resnet-1:8000", "http://resnet-2:8000", "http://resnet-3:8000"}),
		VGGReplicas:         envOrList("VGG_REPLICAS", []string{"http://vgg-1:8000", "http://vgg-2:8000", "http://vgg-3:8000"}),
		ViTReplicas:         envOrList("VIT_REPLICAS", []string{"http://vit-1:8000", "http://vit-2:8000", "http://vit-3:8000"}),
		TrainEpochs:         envOrInt("TRAIN_EPOCHS", 10),
		BatchSize:           envOrInt("BATCH_SIZE", 32),
		ImageSize:           envOrInt("IMAGE_SIZE", 224),
		LearningRate:        envOrFloat("LEARNING_RATE", 0.001),
		ModelRequestTimeout: envOrDuration("MODEL_REQUEST_TIMEOUT", 3*time.Hour),
		LockTTLMillis:       envOrInt("REPLICA_LOCK_TTL_MS", 30*60*1000),
	}
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envOrInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return parseInt(value, fallback)
}

func envOrFloat(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return parseFloat(value, fallback)
}

func envOrList(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return append([]string{}, fallback...)
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return append([]string{}, fallback...)
	}
	return result
}

func envOrDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	if parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseFloat(value string, fallback float64) float64 {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}