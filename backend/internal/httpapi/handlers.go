package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"lsch2026/backend/internal/auth"
	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/dataset"
	"lsch2026/backend/internal/domain"
	"lsch2026/backend/internal/modelclient"
	"lsch2026/backend/internal/queue"
	"lsch2026/backend/internal/store"
)

type Handlers struct {
	cfg        config.Config
	store      store.TaskStore
	queue      queue.TaskQueue
	dataset    *dataset.Service
	auth       *auth.Service
	modelClient *modelclient.Client
}

func NewHandlers(deps Deps) *Handlers {
	return &Handlers{
		cfg:        deps.Config,
		store:      deps.Store,
		queue:      deps.Queue,
		dataset:    deps.Dataset,
		auth:       deps.Auth,
		modelClient: deps.ModelClient,
	}
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	if h.auth == nil {
		writeError(w, http.StatusInternalServerError, fmt.Errorf("auth is not configured"))
		return
	}
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid login payload"))
		return
	}
	token, err := h.auth.Login(r.Context(), payload.Username, payload.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "username": strings.TrimSpace(payload.Username)})
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	if h.auth == nil {
		writeError(w, http.StatusInternalServerError, fmt.Errorf("auth is not configured"))
		return
	}
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid register payload"))
		return
	}
	token, err := h.auth.Register(r.Context(), payload.Username, payload.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "username": strings.TrimSpace(payload.Username)})
}

func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	username, _ := auth.UsernameFromContext(r.Context())
	if username == "" {
		writeError(w, http.StatusUnauthorized, fmt.Errorf("not authenticated"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": username})
}

func (h *Handlers) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) InspectDataset(w http.ResponseWriter, r *http.Request) {
	archivePath, cleanup, err := h.saveUploadedArchive(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer cleanup()

	classes, err := h.dataset.InspectClasses(archivePath)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"classes": classes})
}

func (h *Handlers) CreateTask(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	archivePath, cleanup, err := h.saveUploadedArchive(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer cleanup()

	models, err := parseModels(r.FormValue("models"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	splitConfig := domain.SplitConfig{
		Default: domain.SplitRatio{Train: 60, Val: 30, Test: 10},
		Classes: map[string]domain.SplitRatio{},
	}
	if raw := strings.TrimSpace(r.FormValue("split_config")); raw != "" {
		if err := json.Unmarshal([]byte(raw), &splitConfig); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid split_config: %w", err))
			return
		}
	}

	var advancedParams *domain.AdvancedParams
	if raw := strings.TrimSpace(r.FormValue("advanced_params")); raw != "" {
		var params domain.AdvancedParams
		if err := json.Unmarshal([]byte(raw), &params); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("invalid advanced_params: %w", err))
			return
		}
		if params.Epochs < 1 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("advanced_params.epochs must be >= 1"))
			return
		}
		if params.BatchSize < 1 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("advanced_params.batch_size must be >= 1"))
			return
		}
		if params.LearningRate <= 0 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("advanced_params.learning_rate must be > 0"))
			return
		}
		advancedParams = &params
	}

	taskID := fmt.Sprintf("task-%d", time.Now().UTC().UnixNano())
	taskDir, classes, err := h.dataset.Prepare(taskID, archivePath, splitConfig)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	username, _ := auth.UsernameFromContext(r.Context())
	if username == "" {
		writeError(w, http.StatusUnauthorized, fmt.Errorf("authentication required"))
		return
	}

	task := domain.Task{
		ID:             taskID,
		Owner:          username,
		CreatedAt:      time.Now().UTC(),
		Status:         domain.StatusQueued,
		Models:         models,
		DatasetPath:    taskDir,
		ArchivePath:    archivePath,
		SplitConfig:    splitConfig,
		ClassNames:     classes,
		AdvancedParams: advancedParams,
	}
	if err := h.store.Create(r.Context(), task); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if err := h.queue.Enqueue(r.Context(), taskID); err != nil {
		task.Status = domain.StatusFailed
		task.Error = err.Error()
		_ = h.store.Update(r.Context(), task)
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusCreated, task)
}

func (h *Handlers) ListTasks(w http.ResponseWriter, r *http.Request) {
	username, _ := auth.UsernameFromContext(r.Context())
	if username == "" {
		writeError(w, http.StatusUnauthorized, fmt.Errorf("authentication required"))
		return
	}
	tasks, err := h.store.List(r.Context(), username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": tasks})
}

func (h *Handlers) GetTask(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, fmt.Errorf("task not found"))
		return
	}

	task, err := h.getOwnedTask(r, id)
	if err != nil {
		writeError(w, statusFromTaskAccessError(err), err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *Handlers) PredictTask(w http.ResponseWriter, r *http.Request) {
	if h.modelClient == nil {
		writeError(w, http.StatusInternalServerError, fmt.Errorf("model client is not configured"))
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	id = strings.TrimSuffix(id, "/predict")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, fmt.Errorf("task not found"))
		return
	}
	task, err := h.getOwnedTask(r, id)
	if err != nil {
		writeError(w, statusFromTaskAccessError(err), err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("file is required"))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	modelName := strings.TrimSpace(r.URL.Query().Get("model"))
	if modelName == "" {
		modelName = task.BestModel
	}
	if modelName == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("model is required"))
		return
	}
	endpoint := modelEndpoint(task, modelName)
	if endpoint == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("no endpoint configured for model %s", modelName))
		return
	}
	result, err := h.modelClient.Predict(r.Context(), endpoint, header.Filename, data)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handlers) PredictPretrained(w http.ResponseWriter, r *http.Request) {
	if h.modelClient == nil {
		writeError(w, http.StatusInternalServerError, fmt.Errorf("model client is not configured"))
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("file is required"))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	modelName := strings.TrimSpace(r.URL.Query().Get("model"))
	if modelName == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("model is required"))
		return
	}
	result, err := h.modelClient.PredictPretrained(r.Context(), modelName, header.Filename, data)
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handlers) saveUploadedArchive(r *http.Request) (string, func(), error) {
	file, header, err := r.FormFile("archive")
	if err != nil {
		return "", func() {}, fmt.Errorf("archive file is required")
	}
	defer file.Close()
	if !isSupportedArchive(header.Filename) {
		return "", func() {}, fmt.Errorf("unsupported archive format: use zip, jar, tar, tgz, tar.gz, rar or 7z")
	}

	tmpDir := filepath.Join(h.cfg.DataDir, "_tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return "", func() {}, err
	}

	path := filepath.Join(tmpDir, fmt.Sprintf("%d_%s", time.Now().UTC().UnixNano(), header.Filename))
	out, err := os.Create(path)
	if err != nil {
		return "", func() {}, err
	}
	if _, err := io.Copy(out, file); err != nil {
		out.Close()
		os.Remove(path)
		return "", func() {}, err
	}
	if err := out.Close(); err != nil {
		return "", func() {}, err
	}

	cleanup := func() {
		_ = os.Remove(path)
	}
	return path, cleanup, nil
}

func isSupportedArchive(filename string) bool {
	name := strings.ToLower(strings.TrimSpace(filename))
	if strings.HasSuffix(name, ".tar.gz") || strings.HasSuffix(name, ".tgz") {
		return true
	}
	switch filepath.Ext(name) {
	case ".zip", ".jar", ".tar", ".rar", ".7z":
		return true
	default:
		return false
	}
}

func parseModels(raw string) ([]domain.ModelName, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("models is required")
	}
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil, err
	}
	models := make([]domain.ModelName, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		models = append(models, domain.ModelName(trimmed))
	}
	if len(models) == 0 {
		return nil, fmt.Errorf("models list is empty")
	}
	return models, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

var errTaskForbidden = fmt.Errorf("task not found")

func (h *Handlers) getOwnedTask(r *http.Request, id string) (domain.Task, error) {
	username, _ := auth.UsernameFromContext(r.Context())
	if username == "" {
		return domain.Task{}, fmt.Errorf("authentication required")
	}
	task, err := h.store.Get(r.Context(), id)
	if err != nil {
		return domain.Task{}, fmt.Errorf("task not found")
	}
	// Legacy tasks without owner are visible only until reassigned; new tasks always have owner.
	if task.Owner != "" && task.Owner != username {
		return domain.Task{}, errTaskForbidden
	}
	return task, nil
}

func statusFromTaskAccessError(err error) int {
	if err == nil {
		return http.StatusOK
	}
	if strings.Contains(err.Error(), "authentication required") {
		return http.StatusUnauthorized
	}
	return http.StatusNotFound
}

func modelEndpoint(task domain.Task, modelName string) string {
	for _, result := range task.Results {
		if strings.EqualFold(result.ModelName, modelName) && result.Endpoint != "" {
			return result.Endpoint
		}
		if strings.EqualFold(result.ModelName, modelName) {
			if endpoint := result.Params["endpoint"]; endpoint != "" {
				return endpoint
			}
		}
	}
	if strings.EqualFold(task.BestModel, modelName) && len(task.Results) > 0 {
		if endpoint := task.Results[0].Endpoint; endpoint != "" {
			return endpoint
		}
		if endpoint := task.Results[0].Params["endpoint"]; endpoint != "" {
			return endpoint
		}
	}
	return ""
}
