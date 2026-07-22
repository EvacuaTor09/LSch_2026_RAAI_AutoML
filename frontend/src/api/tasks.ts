import type { CreateTaskInput, ModelName, TaskResult } from '../types';
import { API_URL, authHeaders, readError } from './client';

export async function createTask(input: CreateTaskInput): Promise<TaskResult> {
  const formData = new FormData();
  formData.append('archive', input.archive);
  formData.append('models', JSON.stringify(input.models));
  formData.append(
    'split_config',
    JSON.stringify({ default: input.split, classes: {} }),
  );
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

// Ручки /weights на бэке пока нет — вызов упадёт с понятной ошибкой через
// readError, пока бэкендеры её не реализуют. Держим здесь, чтобы кнопку
// скачивания в UI можно было верстать уже сейчас.
export async function downloadWeights(taskId: string, model: ModelName): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/weights/${model}`, {
    headers: authHeaders(),
  });
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
