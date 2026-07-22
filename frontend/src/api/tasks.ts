import type { CreateTaskInput, ModelName, TaskResult } from '../types';
import { API_URL, readError } from './client';

export async function createTask(input: CreateTaskInput): Promise<TaskResult> {
  const formData = new FormData();
  formData.append('archive', input.archive);
  formData.append('models', JSON.stringify(input.models));
  formData.append('split_config', JSON.stringify(input.splitConfig));
  // Новые поля — опциональные, бэкенд их пока может игнорировать.
  // Как только primaryMetric/advanced понадобятся реально — согласуйте
  // имена form-полей с бэкендерами, тут это просто рабочее предположение.
  if (input.primaryMetric) {
    formData.append('primary_metric', input.primaryMetric);
  }
  if (input.advanced) {
    formData.append('advanced_params', JSON.stringify(input.advanced));
  }

  const response = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TaskResult;
}

export async function getTask(taskId: string): Promise<TaskResult> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as TaskResult;
}

// Ручки /weights на бэке пока нет — вызов упадёт с понятной ошибкой через
// readError, пока бэкендеры её не реализуют. Держим здесь, чтобы кнопку
// скачивания в UI можно было верстать уже сейчас.
export async function downloadWeights(taskId: string, model: ModelName): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/weights/${model}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.blob();
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
