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
    params: Record<string, string>;
    error?: string;
  }>;
};
