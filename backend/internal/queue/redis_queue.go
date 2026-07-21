package queue

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type RedisQueue struct {
	client *redis.Client
	key    string
}

func NewRedisQueue(client *redis.Client, key string) *RedisQueue {
	return &RedisQueue{client: client, key: key}
}

func (q *RedisQueue) Enqueue(ctx context.Context, taskID string) error {
	return q.client.RPush(ctx, q.key, taskID).Err()
}

func (q *RedisQueue) Dequeue(ctx context.Context) (string, error) {
	result, err := q.client.BLPop(ctx, 0, q.key).Result()
	if err != nil {
		return "", err
	}
	if len(result) != 2 {
		return "", fmt.Errorf("unexpected dequeue result")
	}
	return result[1], nil
}
