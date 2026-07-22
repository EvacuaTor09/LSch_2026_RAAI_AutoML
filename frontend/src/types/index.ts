// Единый источник типов для всего фронта.
// Раньше часть компонентов импортировала из "../types", часть — из
// "../types/api" (файла не существовало в мёрдженной ветке), из-за чего
// проект вообще не собирался. Теперь везде импортируем только из "../types".

export type ModelName = 'resnet50' | 'vgg16' | 'vit_base_patch16_224';

export type SplitRatio = {
  train: number;
  val: number;
  test: number;
};

// Раньше был ещё SplitConfig = { default, classes: Record<string, SplitRatio> }
// с драг-н-дропом классов по выборкам. Убрали: по ТЗ (п.4) сплит — это
// train/val/test проценты на весь датасет, все классы участвуют во всех
// выборках одновременно (это и стратифицированный сплит, что нормально для
// классификации). Если бэк всё же захочет per-class сплит — вернуть будет
// несложно, тип и форма запроса это позволяют без переделки остального UI.

// Метрика, по которой ОРКЕСТРАТОР/бэк выбирает лучшую модель среди
// обученных (п.5 ТЗ). Это НЕ фильтр отображения — все метрики всё равно
// показываются по каждой модели, primary_metric влияет только на то, кого
// пометить как best_model.
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
  split: SplitRatio;
  primaryMetric: MetricName;
  advanced?: AdvancedParams;
};

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ModelResult = {
  model_name: string;
  accuracy: number;
  params: Record<string, string>;
  error?: string;
  metrics?: Partial<Record<MetricName, number>>;
  history?: EpochMetric[];
  confusion_matrix?: ConfusionMatrix;
};

export type TaskResult = {
  id: string;
  status: TaskStatus;
  models: ModelName[];
  class_names: string[];
  best_model?: string;
  best_accuracy?: number;
  best_params?: Record<string, string>;
  error?: string;
  results?: ModelResult[];
};

// --- Авторизация ---
// Контракт как у бэкенда: username/password, ответ { token, username }.
// Ручки: /api/auth/login, /api/auth/register, /api/auth/me
export type AuthUser = {
  username: string;
};

export type AuthResponse = {
  token: string;
  username: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type RegisterInput = {
  username: string;
  password: string;
};
