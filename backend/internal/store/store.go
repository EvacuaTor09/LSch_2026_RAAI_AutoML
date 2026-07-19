package store

import (
	"context"

	"lsch2026/backend/internal/domain"
)

type TaskStore interface {
	Create(ctx context.Context, task domain.Task) error
	Update(ctx context.Context, task domain.Task) error
	Get(ctx context.Context, id string) (domain.Task, error)
	List(ctx context.Context) ([]domain.Task, error)
}
