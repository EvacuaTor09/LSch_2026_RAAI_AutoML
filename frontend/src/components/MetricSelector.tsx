import type { MetricName } from '../types';

const METRICS: { id: MetricName; label: string }[] = [
  { id: 'f1', label: 'F1' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'precision', label: 'Precision' },
  { id: 'recall', label: 'Recall' },
  { id: 'loss', label: 'Loss (мин.)' },
];

interface MetricSelectorProps {
  value: MetricName;
  onChange: (metric: MetricName) => void;
}

// Раньше этот компонент был про "какую метрику подсветить в UI", хотя все
// метрики и так показываются по каждой модели всегда (п.5 ТЗ). На самом
// деле метрика здесь нужна бэку/оркестратору: по ней среди обученных
// моделей выбирается "лучшая" (best_model), это уходит в createTask как
// primary_metric. Дефолт — f1 (не accuracy), как и просили.
export function MetricSelector({ value, onChange }: MetricSelectorProps) {
  return (
    <div className="field">
      <div className="chip-row">
        {METRICS.map((m) => (
          <label key={m.id} className={`chip${value === m.id ? ' chip--active' : ''}`}>
            <input type="radio" name="primary-metric" checked={value === m.id} onChange={() => onChange(m.id)} />
            {m.label}
          </label>
        ))}
      </div>
      <p className="field-hint">
        По этой метрике бэкенд выберет лучшую модель среди обученных. Все метрики всё равно будут показаны для
        каждой модели в результатах.
      </p>
    </div>
  );
}
