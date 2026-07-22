import { useState } from 'react';
import type { AdvancedParams } from '../types';

const DEFAULTS: AdvancedParams = {
  learning_rate: 0.001,
  epochs: 10,
  batch_size: 32,
};

type AdvancedSettingsProps = {
  value: AdvancedParams | undefined;
  onChange: (value: AdvancedParams | undefined) => void;
};

// value === undefined значит "расширенный режим выключен" — тогда в
// createTask() advanced_params вообще не уходит на бэкенд, и он использует
// свои дефолты. Это прямое отображение состояния UI на CreateTaskInput.advanced,
// без отдельного флага enabled, который пришлось бы держать в синхроне.
export function AdvancedSettings({ value, onChange }: AdvancedSettingsProps) {
  const enabled = value !== undefined;
  // Храним последние введённые значения, чтобы при выключении/включении
  // тумблера не терять то, что человек уже набрал.
  const [lastValues, setLastValues] = useState<AdvancedParams>(value ?? DEFAULTS);

  function toggle() {
    onChange(enabled ? undefined : lastValues);
  }

  function updateField(field: keyof AdvancedParams, raw: number) {
    const next = { ...(value ?? lastValues), [field]: raw };
    setLastValues(next);
    onChange(next);
  }

  return (
    <section className="panel">
      <div className="advanced-head">
        <h2>4. Расширенный режим</h2>
        <label className="switch">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          <span>{enabled ? 'Включён' : 'Выключен'}</span>
        </label>
      </div>

      {enabled ? (
        <div className="split-row">
          <label>
            learning rate
            <input
              type="number"
              step={0.0001}
              min={0}
              value={(value ?? lastValues).learning_rate}
              onChange={(event) => updateField('learning_rate', Number(event.target.value))}
            />
          </label>
          <label>
            epochs
            <input
              type="number"
              step={1}
              min={1}
              value={(value ?? lastValues).epochs}
              onChange={(event) => updateField('epochs', Number(event.target.value))}
            />
          </label>
          <label>
            batch size
            <input
              type="number"
              step={1}
              min={1}
              value={(value ?? lastValues).batch_size}
              onChange={(event) => updateField('batch_size', Number(event.target.value))}
            />
          </label>
        </div>
      ) : (
        <p className="muted">
          Без расширенного режима бэкенд использует свои дефолты для learning rate / epochs / batch size.
        </p>
      )}
    </section>
  );
}
