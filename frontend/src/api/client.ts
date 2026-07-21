const BASE_URL = import.meta.env.VITE_API_URL as string;
if (!BASE_URL) throw new Error("VITE_API_URL не задан!! см. .env.example");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message); this.name = "ApiError"; this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string) {
  return handle<T>(await fetch(`${BASE_URL}${path}`));
}
export async function apiPostJson<T>(path: string, body: unknown) {
  return handle<T>(await fetch(`${BASE_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}
export async function apiPostFile<T>(path: string, file: File) {
  const form = new FormData(); form.append("file", file);
  return handle<T>(await fetch(`${BASE_URL}${path}`, { method: "POST", body: form }));
}