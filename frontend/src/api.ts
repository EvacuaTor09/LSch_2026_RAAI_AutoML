import type { ModelName, SplitConfig, TaskResult } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export async function inspectDataset(file: File): Promise<string[]> {
  const formData = new FormData();
  formData.append('archive', file);

  const response = await fetch(`${API_URL}/api/datasets/inspect`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const payload = (await response.json()) as { classes: string[] };
  return payload.classes;
}

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

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
