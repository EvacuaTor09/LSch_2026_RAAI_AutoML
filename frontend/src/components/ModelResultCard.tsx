import type { ModelResult } from '../types';
import { TrainingChart } from './TrainingChart';

type ModelResultCardProps = {
  result: ModelResult;
  isBest: boolean;
};

function formatPercent(value?: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? `${Math.round(value * 10000) / 100}%` : '—';
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? new Intl.NumberFormat('ru-RU').format(value) : '—';
}

function formatFloat(value?: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(2) : '—';
}

function formatDuration(value?: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value.toFixed(1)} с` : '—';
}

// Раньше этот компонент скачивал веса с ручки /api/tasks/:id/weights/:model,
// которой на бэке никогда не было (см. старый комментарий в api/tasks.ts) —
// кнопка гарантированно падала с ошибкой. Ручки для скачивания весов на
// бэке нет вообще, зато есть weights_file/endpoint в самом результате —
// показываем их как есть, без обещания скачивания, которого нет.
export function ModelResultCard({ result, isBest }: ModelResultCardProps) {
  if (result.error) {
    return (
      <article className="result-item">
        <strong>{result.model_name}</strong>
        <span className="error">{result.error}</span>
      </article>
    );
  }

  return (
    <article className={`result-item${isBest ? ' result-item--best' : ''}`}>
      <div className="result-item-head">
        <strong>
          {result.model_name} {isBest && <span className="best-badge">лучшая</span>}
        </strong>
      </div>

      <div className="metric-list">
        <span className="metric-pill">accuracy: {formatPercent(result.accuracy)}</span>
        <span className="metric-pill">precision: {formatPercent(result.precision)}</span>
        <span className="metric-pill">recall: {formatPercent(result.recall)}</span>
        <span className="metric-pill">f1: {formatPercent(result.f1_score)}</span>
        <span className="metric-pill">best_val_acc: {formatPercent(result.best_val_acc)}</span>
        <span className="metric-pill">training_time: {formatDuration(result.training_time)}</span>
        <span className="metric-pill">epochs_trained: {formatNumber(result.epochs_trained)}</span>
        <span className="metric-pill">best_epoch: {formatNumber(result.best_epoch)}</span>
        <span className="metric-pill">num_params: {formatNumber(result.num_params)}</span>
        <span className="metric-pill">trainable_params: {formatNumber(result.trainable_params)}</span>
        <span className="metric-pill">model_size_mb: {formatFloat(result.model_size_mb)}</span>
      </div>

      {(result.endpoint || result.weights_file) && (
        <p className="field-hint">
          {result.endpoint && <>endpoint: {result.endpoint}</>}
          {result.endpoint && result.weights_file && ' · '}
          {result.weights_file && <>weights_file: {result.weights_file}</>}
        </p>
      )}

      <TrainingChart history={result.history} bestEpoch={result.best_epoch} />
    </article>
  );
}
