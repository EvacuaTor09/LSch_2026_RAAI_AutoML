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
