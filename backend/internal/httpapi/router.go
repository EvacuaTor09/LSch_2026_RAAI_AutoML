package httpapi

import (
	"net/http"

	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/dataset"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
)

type Deps struct {
	Config  config.Config
	Store   store.TaskStore
	Queue   queue.TaskQueue
	Dataset *dataset.Service
}

type Router struct {
	mux *http.ServeMux
}

func NewRouter(deps Deps) *Router {
	mux := http.NewServeMux()
	h := NewHandlers(deps)

	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("POST /api/datasets/inspect", h.InspectDataset)
	mux.HandleFunc("POST /api/tasks", h.CreateTask)
	mux.HandleFunc("GET /api/tasks", h.ListTasks)
	mux.HandleFunc("GET /api/tasks/", h.GetTask)

	return &Router{mux: mux}
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if req.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	r.mux.ServeHTTP(w, req)
}
