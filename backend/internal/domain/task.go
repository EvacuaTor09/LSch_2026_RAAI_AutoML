package domain

import "time"

type ModelName string

type TaskStatus string

type SplitConfig struct {
	Default SplitRatio            `json:"default"`
	Classes map[string]SplitRatio `json:"classes"`
}

type SplitRatio struct {
	Train float64 `json:"train"`
	Val   float64 `json:"val"`
	Test  float64 `json:"test"`
}

type TaskRequest struct {
	Models      []ModelName `json:"models"`
	SplitConfig SplitConfig `json:"split_config"`
}

type Task struct {
	ID           string            `json:"id"`
	CreatedAt    time.Time         `json:"created_at"`
	Status       TaskStatus        `json:"status"`
	Models       []ModelName       `json:"models"`
	DatasetPath  string            `json:"dataset_path"`
	ArchivePath  string            `json:"archive_path"`
	SplitConfig  SplitConfig       `json:"split_config"`
	ClassNames   []string          `json:"class_names"`
	Results      []ModelResult     `json:"results,omitempty"`
	BestModel    string            `json:"best_model,omitempty"`
	BestAccuracy float64           `json:"best_accuracy,omitempty"`
	BestParams   map[string]string `json:"best_params,omitempty"`
	Error        string            `json:"error,omitempty"`
	CompletedAt  *time.Time        `json:"completed_at,omitempty"`
}

type ModelResult struct {
	ModelName string            `json:"model_name"`
	Accuracy  float64           `json:"accuracy"`
	Params    map[string]string `json:"params"`
	Duration  time.Duration     `json:"duration"`
	Error     string            `json:"error,omitempty"`
}

const (
	StatusQueued    TaskStatus = "queued"
	StatusRunning   TaskStatus = "running"
	StatusCompleted TaskStatus = "completed"
	StatusFailed    TaskStatus = "failed"
)

const (
	ModelResNet50 ModelName = "resnet50"
	ModelVGG16    ModelName = "vgg16"
	ModelViT      ModelName = "vit_base_patch16_224"
)
