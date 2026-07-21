export type ModelName = 'resnet50' | 'vgg16' | 'vit_base_patch16_224';

export type MetricName = 'accuracy' | 'f1' | 'precision' | 'recall' | 'loss';

export type SplitRatio = { train: number; val: number; test: number };
export type SplitConfig = { default: SplitRatio; classes: Record<string, SplitRatio> };

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
  matrix: number[][]; // matrix[i][j] — сколько объектов класса i модель назвала классом j
};

export type ModelResult = {
  model_name: ModelName;
  metrics: Record<MetricName, number>; // считаем на бэке всё сразу, показываем что нужно
  history?: EpochMetric[];
  confusion_matrix?: ConfusionMatrix;
  weights_available?: boolean;
  error?: string;
};

export type TaskResult = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  models: ModelName[];
  class_names: string[];
  primary_metric: MetricName;
  best_model?: ModelName;
  best_score?: number;
  error?: string;
  results?: ModelResult[];
};

export type CreateTaskInput = {
  archive: File;
  models: ModelName[];
  splitConfig: SplitConfig;
  primaryMetric: MetricName;
  advanced?: AdvancedParams;
};