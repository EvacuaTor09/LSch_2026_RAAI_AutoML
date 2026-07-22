function resolveApiURL(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return 'http://localhost:8080';
}

export const API_URL = resolveApiURL();

export async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

// --- Токен авторизации ---
// Храним в localStorage (переживает перезагрузку страницы) и добавляем
// заголовок Authorization ко всем запросам через authHeaders().
// Если бэк ждёт токен в другом виде (cookie-сессия, другой заголовок) —
// поменять нужно только здесь, остальной api/* не изменится.
const TOKEN_KEY = 'automl_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
