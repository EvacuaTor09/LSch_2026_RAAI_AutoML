package queue

import "sync"

type MemoryQueue struct {
	mu    sync.Mutex
	items []string
}

func NewMemoryQueue() *MemoryQueue {
	return &MemoryQueue{items: make([]string, 0)}
}

func (q *MemoryQueue) Enqueue(taskID string) {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.items = append(q.items, taskID)
}

func (q *MemoryQueue) Dequeue() (string, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.items) == 0 {
		return "", false
	}

	taskID := q.items[0]
	q.items = q.items[1:]
	return taskID, true
}
