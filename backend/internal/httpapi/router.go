package httpapi

import (
	"net/http"

	"lsch2026/backend/internal/auth"
	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/dataset"
	"lsch2026/backend/internal/modelclient"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
)

type Deps struct {
	Config      config.Config
	Store       store.TaskStore
	Queue       queue.TaskQueue
	Dataset     *dataset.Service
	Auth        *auth.Service
	ModelClient *modelclient.Client
}

type Router struct {
	mux  *http.ServeMux
	auth *auth.Service
}

func NewRouter(deps Deps) *Router {
	mux := http.NewServeMux()
	h := NewHandlers(deps)

	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("POST /api/auth/login", h.Login)
	mux.HandleFunc("POST /api/auth/register", h.Register)
	mux.HandleFunc("GET /api/auth/me", h.Me)
	mux.HandleFunc("POST /api/datasets/inspect", h.InspectDataset)
	mux.HandleFunc("POST /api/tasks", h.CreateTask)
	mux.HandleFunc("GET /api/tasks", h.ListTasks)
	mux.HandleFunc("GET /api/tasks/", h.GetTask)
	mux.HandleFunc("POST /api/tasks/{id}/predict", h.PredictTask)
	mux.HandleFunc("POST /api/predict/pretrained", h.PredictPretrained)

	return &Router{mux: mux, auth: deps.Auth}
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if r.auth != nil && !isPublicRoute(req.Method, req.URL.Path) {
		username, err := r.auth.UsernameFromRequest(req)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err)
			return
		}
		req = req.WithContext(auth.WithUsername(req.Context(), username))
	}
	r.mux.ServeHTTP(w, req)
}

func isPublicRoute(method, path string) bool {
	return (method == http.MethodGet && path == "/healthz") ||
		(method == http.MethodPost && (path == "/api/auth/login" || path == "/api/auth/register"))
}
