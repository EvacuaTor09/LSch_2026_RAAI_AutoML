package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"lsch2026/backend/internal/domain"
)

type FileStore struct {
	mu       sync.Mutex
	path     string
	tasks    map[string]domain.Task
}

func NewFileStore(baseDir string) (*FileStore, error) {
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, err
	}

	store := &FileStore{
		path:  filepath.Join(baseDir, "tasks.json"),
		tasks: map[string]domain.Task{},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *FileStore) Create(task domain.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.tasks[task.ID] = task
	return s.persist()
}

func (s *FileStore) Update(task domain.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.tasks[task.ID] = task
	return s.persist()
}

func (s *FileStore) Get(id string) (domain.Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.tasks[id]
	return task, ok
}

func (s *FileStore) List() []domain.Task {
	s.mu.Lock()
	defer s.mu.Unlock()

	result := make([]domain.Task, 0, len(s.tasks))
	for _, task := range s.tasks {
		result = append(result, task)
	}
	return result
}

func (s *FileStore) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, &s.tasks); err != nil {
		return fmt.Errorf("load tasks: %w", err)
	}
	return nil
}

func (s *FileStore) persist() error {
	data, err := json.MarshalIndent(s.tasks, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

func (s *FileStore) TouchCompletion(id string, status domain.TaskStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.tasks[id]
	if !ok {
		return fmt.Errorf("task %s not found", id)
	}
	now := time.Now().UTC()
	task.Status = status
	task.CompletedAt = &now
	s.tasks[id] = task
	return s.persist()
}
