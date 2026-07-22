import type { CreateTaskInput, ModelName, PredictionResult, TaskResult } from '../types';
import { API_URL, authHeaders, readError } from './client';

export async function createTask(input: CreateTaskInput): Promise<TaskResult> {
  const formData = new FormData();
  formData.append('archive', input.archive);
  formData.append('models', JSON.stringify(input.models));
  formData.append('split_config', JSON.stringify(input.splitConfig));
  formData.append('primary_metric', input.primaryMetric);
  // advanced_params — опционально. Если пользователь не включил расширенный
  // режим, поле вообще не уходит и бэк применяет свои значения по умолчанию.
  if (input.advanced) {
    formData.append('advanced_params', JSON.stringify(input.advanced));
  }

  const response = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TaskResult;
}

export async function getTask(taskId: string): Promise<TaskResult> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TaskResult;
}

// Predict дообученной моделью из завершённой задачи.
export async function predictTask(input: { taskId: string; model: string; file: File }): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append('file', input.file);

  const response = await fetch(
    `${API_URL}/api/tasks/${input.taskId}/predict?model=${encodeURIComponent(input.model)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as PredictionResult;
}

// Predict на голой ImageNet-предобученной модели — доступно ДО и БЕЗ
// какого-либо обучения, отдельная ручка от predictTask.
export async function predictPretrained(input: { model: ModelName; file: File }): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append('file', input.file);

  const response = await fetch(`${API_URL}/api/predict/pretrained?model=${encodeURIComponent(input.model)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as PredictionResult;
}
