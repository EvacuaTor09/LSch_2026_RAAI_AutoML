package store

import (
	"context"

	"lsch2026/backend/internal/auth"
	"lsch2026/backend/internal/domain"
)

type TaskStore interface {
	Create(ctx context.Context, task domain.Task) error
	Update(ctx context.Context, task domain.Task) error
	Get(ctx context.Context, id string) (domain.Task, error)
	// List returns tasks. If owner is non-empty, only that user's tasks.
	List(ctx context.Context, owner string) ([]domain.Task, error)
	GetUser(ctx context.Context, username string) (auth.User, error)
	UpsertUser(ctx context.Context, user auth.User) error
}
