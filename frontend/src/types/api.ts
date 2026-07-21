export async function createTask(input: CreateTaskInput): Promise<TaskResult> {
  const formData = new FormData();
  formData.append('archive', input.archive);
  formData.append('models', JSON.stringify(input.models));
  formData.append('split_config', JSON.stringify(input.splitConfig));
  formData.append('primary_metric', input.primaryMetric);
  if (input.advanced) {
    formData.append('advanced_params', JSON.stringify(input.advanced));
  }
  const response = await fetch(`${API_URL}/api/tasks`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as TaskResult;
}

export async function downloadWeights(taskId: string, model: ModelName): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/weights/${model}`);
  if (!response.ok) throw new Error(await readError(response));
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