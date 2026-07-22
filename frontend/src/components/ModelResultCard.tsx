import { useState } from 'react';
import { downloadWeights, triggerDownload } from '../api';
import type { ModelName, ModelResult } from '../types';
import { ConfusionMatrixView } from './ConfusionMatrixView';
import { TrainingCurvesChart } from './TrainingCurvesChart';

type ModelResultCardProps = {
  taskId: string;
  result: ModelResult;
  isBest: boolean;
};

function formatMetric(name: string, metricValue: number): string {
  return name === 'loss' ? metricValue.toFixed(3) : `${Math.round(metricValue * 10000) / 100}%`;
}

export function ModelResultCard({ taskId, result, isBest }: ModelResultCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  async function handleDownload() {
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await downloadWeights(taskId, result.model_name as ModelName);
      triggerDownload(blob, `${result.model_name}-${taskId}.pt`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Не удалось скачать веса');
    } finally {
      setDownloading(false);
    }
  }

  if (result.error) {
    return (
      <article className="result-item">
        <strong>{result.model_name}</strong>
        <span className="error">{result.error}</span>
      </article>
    );
  }

  // Пока бэкенд не всегда отдаёт полный набор metrics — показываем то, что
  // точно есть (accuracy). Как только metrics появится в ответе целиком,
  // здесь само подтянется весь набор без изменений в этом компоненте.
  const metrics: Record<string, number> = result.metrics ?? { accuracy: result.accuracy };

  return (
    <article className={`result-item${isBest ? ' result-item--best' : ''}`}>
      <div className="result-item-head">
        <strong>
          {result.model_name} {isBest && <span className="best-badge">лучшая</span>}
        </strong>
        <button type="button" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Скачиваю…' : 'Скачать веса'}
        </button>
      </div>

      <div className="metric-list">
        {Object.entries(metrics).map(([name, metricValue]) => (
          <span key={name} className="metric-pill">
            {name}: {formatMetric(name, metricValue)}
          </span>
        ))}
      </div>

      {downloadError && <p className="error">{downloadError}</p>}

      <TrainingCurvesChart history={result.history ?? []} metric="acc" title="Accuracy по эпохам" />
      <TrainingCurvesChart history={result.history ?? []} metric="loss" title="Loss по эпохам" />
      <ConfusionMatrixView data={result.confusion_matrix} />
    </article>
  );
}
