import type { AuthUser, LoginResponse, ModelName, PredictionResult, SplitConfig, TaskResult } from './types';

function resolveApiURL(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return '';
}

const API_URL = resolveApiURL();
const TOKEN_KEY = 'automl_jwt';

export function getAuthToken(): string {
  return window.localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as LoginResponse;
}

export async function register(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as LoginResponse;
}

export async function me(): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as AuthUser;
}

export async function inspectDataset(file: File): Promise<string[]> {
  const formData = new FormData();
  formData.append('archive', file);

  const response = await fetch(`${API_URL}/api/datasets/inspect`, {
    method: 'POST',
    headers: authHeaders(),
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

export async function predictTask(input: { taskId: string; model: string; file: File }): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append('file', input.file);

  const response = await fetch(`${API_URL}/api/tasks/${input.taskId}/predict?model=${encodeURIComponent(input.model)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as PredictionResult;
}

export async function predictPretrained(input: { model: string; file: File }): Promise<PredictionResult> {
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

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
