// Единый источник типов для всего фронта.
// Раньше часть компонентов импортировала из "../types", часть — из "../api.ts"
// и корневого "../types.ts" (это был неразрешённый git-конфликт: HEAD и master
// одновременно принесли свои api.ts/types.ts). Теперь везде импортируем
// только из "../types" и "../api".

export type ModelName = 'resnet50' | 'vgg16' | 'vit_base_patch16_224';

export type SplitRatio = {
  train: number;
  val: number;
  test: number;
};

// Бэк принимает split_config = { default, classes } — свой train/val/test
// на каждый класс отдельно (см. ветку бэкендеров). Предыдущая версия этого
// файла убирала classes, ссылаясь на ТЗ п.4 (общий сплит на весь датасет) —
// это разошлось с тем, что реально понимает бэк. Возвращаем per-class.
export type SplitConfig = {
  default: SplitRatio;
  classes: Record<string, SplitRatio>;
};

// Метрика, по которой ОРКЕСТРАТОР/бэк выбирает лучшую модель среди
// обученных (п.5 ТЗ). Это НЕ фильтр отображения — все метрики всё равно
// показываются по каждой модели, primary_metric влияет только на то, кого
// пометить как best_model.
// ПОМЕТКА: этого поля нет в примерах запросов ветки бэкендеров — они его
// явно не подтверждали. Оставляю, т.к. лишнее поле в multipart-запросе бэк
// должен просто игнорировать, но стоит сверить с ними, что оно реально
// читается на той стороне.
export type MetricName = 'accuracy' | 'f1' | 'precision' | 'recall' | 'loss';

export type AdvancedParams = {
  learning_rate: number;
  epochs: number;
  batch_size: number;
};

export type CreateTaskInput = {
  archive: File;
  models: ModelName[];
  splitConfig: SplitConfig;
  primaryMetric: MetricName;
  advanced?: AdvancedParams;
};

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

// Реальная форма history по эпохам — нашлась в конфликтующей ветке
// бэкендеров (types.ts/App.tsx: TrainingHistory + асТrainingHistory +
// самодельный SVG LineChart). Раньше в этом файле была придуманная форма
// EpochMetric[] с train_acc/val_acc/train_loss/val_loss по эпохе — бэк
// отдаёт НЕ так: это словарь из массивов по каждой метрике отдельно, и
// длина массивов может не совпадать (train_loss доступен, а val_f1 — нет
// и т.п.), отсюда все поля опциональны.
export type TrainingHistory = {
  train_loss?: number[];
  val_loss?: number[];
  val_acc?: number[];
  val_f1?: number[];
};

// Форма результата по одной модели — приведена к тому, что реально
// приходит от бэка. Раньше здесь были придуманные metrics/confusion_matrix
// со своей формой — бэк confusion_matrix не отдаёт вовсе, поэтому этот блок
// показывал заглушку "нет данных" НАВСЕГДА, даже когда обучение прошло
// успешно. Убрали.
export type ModelResult = {
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
  history?: TrainingHistory;
  endpoint?: string;
  params: Record<string, string>;
  error?: string;
};

export type TaskResult = {
  id: string;
  owner?: string;
  created_at?: string;
  status: TaskStatus;
  models: ModelName[];
  class_names: string[];
  advanced_params?: AdvancedParams;
  best_model?: string;
  best_accuracy?: number;
  best_params?: Record<string, string>;
  error?: string;
  results?: ModelResult[];
};

// --- Predict ---
// Раньше в этом фронте predict не было вообще — ни на обученной модели,
// ни на pretrained (ImageNet) модели без обучения. У бэка обе ручки есть
// (см. api.ts ветки бэкендеров: predictTask, predictPretrained) —
// добавляем их сюда.
export type TopPrediction = {
  class_id: number;
  class_name: string;
  confidence: number;
};

export type PredictionResult = {
  model: string;
  model_type: string;
  class_id: number;
  class_name: string;
  confidence: number;
  probabilities?: number[];
  top_predictions?: TopPrediction[];
  status?: string;
  task_id?: string;
  model_name?: string;
  num_classes?: number;
  class_names?: string[];
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  training_time?: number;
  epochs_trained?: number;
  best_epoch?: number;
  best_val_acc?: number;
  num_params?: number;
  trainable_params?: number;
  model_size_mb?: number;
  history?: TrainingHistory;
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
