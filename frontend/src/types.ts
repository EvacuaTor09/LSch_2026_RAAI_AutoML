export type ModelName = 'resnet50' | 'vgg16' | 'vit_base_patch16_224';

export type SplitRatio = {
  train: number;
  val: number;
  test: number;
};

export type SplitConfig = {
  default: SplitRatio;
  classes: Record<string, SplitRatio>;
};

export type LoginResponse = {
	token: string;
	username: string;
};

export type AuthUser = {
	username: string;
};

export type TaskResult = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  models: ModelName[];
  class_names: string[];
  best_model?: string;
  best_accuracy?: number;
  best_params?: Record<string, string>;
  error?: string;
  results?: Array<{
    model_name: string;
    accuracy: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    training_time?: number;
    num_params?: number;
    trainable_params?: number;
    model_size_mb?: number;
    weights_file?: string;
    best_val_acc?: number;
    epochs_trained?: number;
    best_epoch?: number;
    history?: Record<string, unknown>;
    endpoint?: string;
    params: Record<string, string>;
    error?: string;
  }>;
};

export type PredictionResult = {
	model: string;
	model_type: string;
	class_id: number;
	class_name: string;
	confidence: number;
	probabilities: number[];
};
