import type { AuthResponse, LoginInput, RegisterInput } from '../types';
import { API_URL, readError } from './client';

// Предположение по контракту, пока бэк его не прислал: JSON-body,
// в ответ { token, user }. Ручки — /api/auth/login и /api/auth/register.
// Поправить URL/тела запросов здесь, если бэкендеры сделают иначе.

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as AuthResponse;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as AuthResponse;
}
