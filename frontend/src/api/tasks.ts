import type { ModelName, SplitConfig, TaskResult } from '../types';
import { API_URL, readError } from './client';

export async function createTask(input: {
  archive: File;
  models: ModelName[];
  splitConfig: SplitConfig;
}): Promise<TaskResult> {
  const formData = new FormData();
  formData.append('archive', input.archive);
  formData.append('models', JSON.stringify(input.models));
  formData.append('split_config', JSON.stringify(input.splitConfig));

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
