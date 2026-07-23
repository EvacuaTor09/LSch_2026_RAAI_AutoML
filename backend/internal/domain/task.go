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
	Models         []ModelName     `json:"models"`
	SplitConfig    SplitConfig     `json:"split_config"`
	AdvancedParams *AdvancedParams `json:"advanced_params,omitempty"`
}

// AdvancedParams — опциональные гиперпараметры с фронта (расширенный режим).
// Если nil — worker берёт TRAIN_EPOCHS / LEARNING_RATE / BATCH_SIZE из env.
type AdvancedParams struct {
	LearningRate float64 `json:"learning_rate"`
	Epochs       int     `json:"epochs"`
	BatchSize    int     `json:"batch_size"`
}

type Task struct {
	ID             string            `json:"id"`
	CreatedAt      time.Time         `json:"created_at"`
	Status         TaskStatus        `json:"status"`
	Models         []ModelName       `json:"models"`
	DatasetPath    string            `json:"dataset_path"`
	ArchivePath    string            `json:"archive_path"`
	SplitConfig    SplitConfig       `json:"split_config"`
	ClassNames     []string          `json:"class_names"`
	AdvancedParams *AdvancedParams   `json:"advanced_params,omitempty"`
	Results        []ModelResult     `json:"results,omitempty"`
	BestModel      string            `json:"best_model,omitempty"`
	BestAccuracy   float64           `json:"best_accuracy,omitempty"`
	BestParams     map[string]string `json:"best_params,omitempty"`
	Error          string            `json:"error,omitempty"`
	CompletedAt    *time.Time        `json:"completed_at,omitempty"`
}

type ModelResult struct {
	ModelName       string            `json:"model_name"`
	Accuracy        float64           `json:"accuracy"`
	Precision       float64           `json:"precision,omitempty"`
	Recall          float64           `json:"recall,omitempty"`
	F1Score         float64           `json:"f1_score,omitempty"`
	TrainingTime    float64           `json:"training_time,omitempty"`
	NumParams       int64             `json:"num_params,omitempty"`
	TrainableParams int64             `json:"trainable_params,omitempty"`
	ModelSizeMB     float64           `json:"model_size_mb,omitempty"`
	WeightsFile     string            `json:"weights_file,omitempty"`
	BestValAcc      float64           `json:"best_val_acc,omitempty"`
	EpochsTrained   int               `json:"epochs_trained,omitempty"`
	BestEpoch       int               `json:"best_epoch,omitempty"`
	History         map[string]any    `json:"history,omitempty"`
	Endpoint        string            `json:"endpoint,omitempty"`
	Params          map[string]string `json:"params,omitempty"`
	Duration        time.Duration     `json:"-"`
	Error           string            `json:"error,omitempty"`
}

type TopPrediction struct {
	ClassID    int     `json:"class_id"`
	ClassName  string  `json:"class_name"`
	Confidence float64 `json:"confidence"`
}

type PredictionResult struct {
	Model           string          `json:"model"`
	ModelType       string          `json:"model_type"`
	ClassID         int             `json:"class_id"`
	ClassName       string          `json:"class_name"`
	Confidence      float64         `json:"confidence"`
	Probabilities   []float64       `json:"probabilities,omitempty"`
	TopPredictions  []TopPrediction `json:"top_predictions,omitempty"`
	Status          string          `json:"status,omitempty"`
	TaskID          string          `json:"task_id,omitempty"`
	ModelName       string          `json:"model_name,omitempty"`
	NumClasses      int             `json:"num_classes,omitempty"`
	ClassNames      []string        `json:"class_names,omitempty"`
	Accuracy        float64         `json:"accuracy,omitempty"`
	Precision       float64         `json:"precision,omitempty"`
	Recall          float64         `json:"recall,omitempty"`
	F1Score         float64         `json:"f1_score,omitempty"`
	TrainingTime    float64         `json:"training_time,omitempty"`
	EpochsTrained   int             `json:"epochs_trained,omitempty"`
	BestEpoch       int             `json:"best_epoch,omitempty"`
	BestValAcc      float64         `json:"best_val_acc,omitempty"`
	NumParams       int64           `json:"num_params,omitempty"`
	TrainableParams int64           `json:"trainable_params,omitempty"`
	ModelSizeMB     float64         `json:"model_size_mb,omitempty"`
	History         map[string]any  `json:"history,omitempty"`
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
