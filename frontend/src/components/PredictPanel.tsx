import { useEffect, useState } from 'react';
import { predictPretrained, predictTask } from '../api';
import { Dropzone } from './Dropzone';
import type { ModelName, PredictionResult, TaskResult } from '../types';

const ALL_MODELS: ModelName[] = ['resnet50', 'vgg16', 'vit_base_patch16_224'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];

type PredictPanelProps = {
  task: TaskResult | null;
};

function formatPercent(value?: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? `${Math.round(value * 10000) / 100}%` : '—';
}

export function PredictPanel({ task }: PredictPanelProps) {
  const useTrained = Boolean(task && task.status === 'completed');
  const availableModels = useTrained && task ? task.models : ALL_MODELS;

  const [model, setModel] = useState<string>(availableModels[0]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!availableModels.includes(model as ModelName)) {
      setModel(task?.best_model ?? availableModels[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, useTrained]);

  function handleModelChange(next: string) {
    setModel(next);
    setResult(null);
    setError('');
  }

  function handleFileSelected(next: File) {
    setFile(next);
    setResult(null);
    setError('');
  }

  async function handlePredict() {
    if (!file) {
      setError('Выберите изображение для предсказания');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response =
        useTrained && task
          ? await predictTask({ taskId: task.id, model, file })
          : await predictPretrained({ model: model as ModelName, file });
      setResult(response);
    } catch (predictError) {
      setError(predictError instanceof Error ? predictError.message : 'Не удалось выполнить предсказание');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wide">
      <h2>
        <span className="step-badge">4</span>Предсказание
      </h2>
      <p className="field-hint">
        {useTrained
          ? 'Предсказание дообученной моделью из завершённой задачи.'
          : 'Пока нет завершённой задачи, используется ImageNet pretrained. После обучения переключится на модель из задачи.'}
      </p>

      <div className="split-row">
        <label className="text-field">
          Модель
          <select value={model} onChange={(e) => handleModelChange(e.target.value)}>
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Dropzone
        file={file}
        onFileSelected={handleFileSelected}
        disabled={busy}
        accept={IMAGE_EXTENSIONS}
        prompt="Перетащите изображение сюда или нажмите, чтобы выбрать"
      />

      <div className="actions actions--single">
        <button type="button" className="primary" onClick={handlePredict} disabled={busy}>
          {busy ? 'Считаю…' : 'Предсказать'}
        </button>
      </div>

      {error && <p className="field-error">{error}</p>}

      {result && (
        <div className="result-item" style={{ marginTop: '1rem' }}>
          <div className="result-item-head">
            <strong>{result.class_name}</strong>
            <span className="metric-pill">{formatPercent(result.confidence)} уверенность</span>
          </div>
          {result.top_predictions?.length ? (
            <div className="metric-list">
              {result.top_predictions.map((item) => (
                <span key={`${item.class_id}-${item.class_name}`} className="metric-pill">
                  {item.class_name}: {formatPercent(item.confidence)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
