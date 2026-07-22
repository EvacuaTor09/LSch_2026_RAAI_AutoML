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

export type MetricName = 'accuracy' | 'f1' | 'precision' | 'recall' | 'loss';

export type AdvancedParams = {
  learning_rate: number;
  epochs: number;
  batch_size: number;
};

export type EpochMetric = {
  epoch: number;
  train_loss: number;
  val_loss: number;
  train_acc: number;
  val_acc: number;
};

export type ConfusionMatrix = {
  labels: string[];
  matrix: number[][];
};

export type CreateTaskInput = {
  archive: File;
  models: ModelName[];
  splitConfig: SplitConfig;
  primaryMetric?: MetricName;
  advanced?: AdvancedParams;
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
    metrics?: Record<MetricName, number>;
    history?: EpochMetric[];
    confusion_matrix?: ConfusionMatrix;
  }>;
};