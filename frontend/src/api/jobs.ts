import { apiGet, apiPostFile, apiPostJson } from "./client";
import type { CreateJobRequest, CreateJobResponse, JobResultsResponse,
  JobStatusResponse, PredictResponse, UploadDatasetResponse } from "../types/api";

export function uploadDataset(file: File) {
  return apiPostFile<UploadDatasetResponse>("/api/datasets", file);
}
export function createJob(payload: CreateJobRequest) {
  return apiPostJson<CreateJobResponse>("/api/jobs", payload);
}
export function getJobStatus(jobId: string) {
  return apiGet<JobStatusResponse>(`/api/jobs/${jobId}`);
}
export function getJobResults(jobId: string) {
  return apiGet<JobResultsResponse>(`/api/jobs/${jobId}/results`);
}
export function getWeightsUrl(jobId: string, model: string) {
  return `${import.meta.env.VITE_API_URL}/api/jobs/${jobId}/weights?model=${model}`;
}
export function predict(jobId: string, file: File) {
  return apiPostFile<PredictResponse>(`/api/jobs/${jobId}/predict`, file);
}