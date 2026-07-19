package queue

import "context"

type TaskQueue interface {
	Enqueue(ctx context.Context, taskID string) error
	Dequeue(ctx context.Context) (string, error)
}
