import { AdvancedSettings } from './AdvancedSettings';
import { MetricSelector } from './MetricSelector';
import { SplitInputs } from './SplitInputs';
import type { AdvancedParams, MetricName, SplitRatio } from '../types';

type TrainingConfigPanelProps = {
  split: SplitRatio;
  onSplitChange: (split: SplitRatio) => void;
  primaryMetric: MetricName;
  onPrimaryMetricChange: (metric: MetricName) => void;
  advanced: AdvancedParams | undefined;
  onAdvancedChange: (advanced: AdvancedParams | undefined) => void;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
};

export function TrainingConfigPanel({
  split,
  onSplitChange,
  primaryMetric,
  onPrimaryMetricChange,
  advanced,
  onAdvancedChange,
  canSubmit,
  submitting,
  onSubmit,
}: TrainingConfigPanelProps) {
  return (
    <section className="panel wide">
      <h2>
        <span className="step-badge">3</span>Настройки обучения
      </h2>

      <h3 className="subheading">Разбиение train / val / test</h3>
      <SplitInputs value={split} onChange={onSplitChange} />

      <h3 className="subheading">Метрика для выбора лучшей модели</h3>
      <MetricSelector value={primaryMetric} onChange={onPrimaryMetricChange} />

      <h3 className="subheading">Гиперпараметры</h3>
      <AdvancedSettings value={advanced} onChange={onAdvancedChange} />

      <div className="actions actions--single" style={{ marginTop: '1.25rem' }}>
        <button type="button" className="primary" onClick={onSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Отправляю…' : 'Отправить задачу на обучение'}
        </button>
      </div>
    </section>
  );
}
