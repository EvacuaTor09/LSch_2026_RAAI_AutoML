export type ModelName = "resnet50" | "vgg" | "vit";
export type MetricName = "accuracy" | "precision" | "recall" | "f1-macro";

export interface SplitConfig { train: number; val: number; test: number; }

export interface UploadDatasetResponse {
  dataset_id: string; class_names: string[]; num_images: number;
}

export interface CreateJobRequest {
  dataset_id: string; models: ModelName[]; split: SplitConfig;
  epochs: number; learning_rate: number; batch_size: number;
}
export interface CreateJobResponse { job_id: string; }

export type ModelJobStatus = "pending" | "training" | "done" | "error";
export interface ModelProgress {
  name: ModelName; status: ModelJobStatus; epoch: number; progress: number;
}
export interface JobStatusResponse { status: ModelJobStatus; models: ModelProgress[]; }

export interface EpochPoint {
  epoch: number; train_loss: number; val_loss: number; train_acc: number; val_acc: number;
}
export interface ConfusionMatrix { labels: string[]; matrix: number[][]; }
export interface TestMetrics { accuracy: number; precision: number; recall: number; f1: number; }
export interface ModelResult {
  name: ModelName; epoch_history: EpochPoint[]; confusion_matrix: ConfusionMatrix;
  test_metrics: TestMetrics; train_time_sec: number; size_mb: number;
}
export interface JobResultsResponse { models: ModelResult[]; }

export interface Prediction { model: ModelName; class: string; confidence: number; }
export interface PredictResponse { predictions: Prediction[]; }