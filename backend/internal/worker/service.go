package worker

import (
	"context"
	"sort"
	"sync"
	"time"

	"lsch2026/backend/internal/domain"
	"lsch2026/backend/internal/modelclient"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
)

type Service struct {
	store  store.TaskStore
	queue  queue.TaskQueue
	client *modelclient.Client
}

func NewService(store store.TaskStore, queue queue.TaskQueue, client *modelclient.Client) *Service {
	return &Service{
		store:  store,
		queue:  queue,
		client: client,
	}
}

func (s *Service) Enqueue(ctx context.Context, taskID string) error {
	return s.queue.Enqueue(ctx, taskID)
}

func (s *Service) Run(ctx context.Context) error {
	for {
		taskID, err := s.queue.Dequeue(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return err
		}
		if err := s.processTask(ctx, taskID); err != nil {
			return err
		}
	}
}

func (s *Service) RunOnce(ctx context.Context) error {
	taskID, err := s.queue.Dequeue(ctx)
	if err != nil {
		return err
	}
	return s.processTask(ctx, taskID)
}

func (s *Service) processTask(ctx context.Context, taskID string) error {
	task, err := s.store.Get(ctx, taskID)
	if err != nil {
		return err
	}

	task.Status = domain.StatusRunning
	if err := s.store.Update(ctx, task); err != nil {
		return err
	}

	results := s.executeModels(ctx, task)
	successful := make([]domain.ModelResult, 0, len(results))
	for _, result := range results {
		if result.Error == "" {
			successful = append(successful, result)
		}
	}
	if len(successful) == 0 {
		task.Status = domain.StatusFailed
		task.Error = "no model returned a result"
		task.Results = results
		return s.store.Update(ctx, task)
	}

	best := successful[0]
	for _, result := range successful[1:] {
		if result.Accuracy > best.Accuracy {
			best = result
		}
	}

	task.Status = domain.StatusCompleted
	task.Results = results
	task.BestModel = best.ModelName
	task.BestAccuracy = best.Accuracy
	task.BestParams = best.Params
	now := time.Now().UTC()
	task.CompletedAt = &now
	return s.store.Update(ctx, task)
}

func (s *Service) executeModels(ctx context.Context, task domain.Task) []domain.ModelResult {
	results := make([]domain.ModelResult, 0, len(task.Models))
	resultCh := make(chan domain.ModelResult, len(task.Models))
	var wg sync.WaitGroup

	for _, modelName := range task.Models {
		wg.Add(1)
		go func(name domain.ModelName) {
			defer wg.Done()
			result, err := s.client.Train(ctx, task, name)
			if err != nil {
				resultCh <- domain.ModelResult{ModelName: string(name), Error: err.Error()}
				return
			}
			resultCh <- result
		}(modelName)
	}

	wg.Wait()
	close(resultCh)

	for result := range resultCh {
		results = append(results, result)
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Error != "" {
			return false
		}
		if results[j].Error != "" {
			return true
		}
		return results[i].Accuracy > results[j].Accuracy
	})
	return results
}
