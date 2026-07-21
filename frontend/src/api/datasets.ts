import { API_URL, readError } from './client';

export const ALLOWED_EXTENSIONS = ['.zip', '.jar', '.tar', '.tgz', '.tar.gz', '.rar', '.7z'];

export function isAllowedArchive(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

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
