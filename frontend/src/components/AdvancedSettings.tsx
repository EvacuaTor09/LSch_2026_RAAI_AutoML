import { useState } from 'react';
import { NumberField } from './NumberField';
import type { AdvancedParams } from '../types';

const DEFAULTS: AdvancedParams = { learning_rate: 0.001, epochs: 10, batch_size: 32 };

interface AdvancedSettingsProps {
  value: AdvancedParams | undefined;
  onChange: (value: AdvancedParams | undefined) => void;
}

// Раньше режим переключался кнопкой-дисклоузером ("Показать/Скрыть"), а
// значение обязательно было объектом (AdvancedValues без undefined) — из-за
// этого TS ругался на App.tsx, где advanced мог быть undefined, и в целом
// было неочевидно, что означает "не открыто": то ли "выключено и бэк
// использует свои дефолты", то ли "открыто, но с нулями".
// Теперь это один явный переключатель: OFF — advanced === undefined,
// поля вообще не уходят в запрос, бэк использует свои значения по
// умолчанию; ON — показываем поля с вменяемыми дефолтами и шлём их.
export function AdvancedSettings({ value, onChange }: AdvancedSettingsProps) {
  const [lastValues, setLastValues] = useState<AdvancedParams>(value ?? DEFAULTS);
  const enabled = value !== undefined;

  function handleToggle(next: boolean) {
    if (next) {
      onChange(lastValues);
    } else {
      setLastValues(value ?? lastValues);
      onChange(undefined);
    }
  }

  return (
    <div className="field">
      <label className="toggle-row">
        <span className="toggle-switch">
          <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />
          <span className="toggle-track" aria-hidden="true" />
        </span>
        <span className="toggle-label">
          <strong>Расширенный режим</strong>
          <span className="muted"> — вручную задать learning rate, epochs, batch size</span>
        </span>
      </label>

      {enabled && value && (
        <div className="split-row" style={{ marginTop: '0.75rem' }}>
          <NumberField
            label="Learning rate"
            value={value.learning_rate}
            min={0}
            step={0.0001}
            onChange={(n) => onChange({ ...value, learning_rate: n })}
          />
          <NumberField label="Epochs" value={value.epochs} min={1} onChange={(n) => onChange({ ...value, epochs: n })} />
          <NumberField
            label="Batch size"
            value={value.batch_size}
            min={1}
            onChange={(n) => onChange({ ...value, batch_size: n })}
          />
        </div>
      )}
      {!enabled && (
        <p className="field-hint">
          Выключено — бэкенд применит свои значения по умолчанию для loss/optimizer/dropout и остальных параметров.
        </p>
      )}
    </div>
  );
}
