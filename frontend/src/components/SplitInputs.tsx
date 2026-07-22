import { NumberField } from './NumberField';
import type { SplitRatio } from '../types';

interface SplitInputsProps {
  value: SplitRatio;
  onChange: (value: SplitRatio) => void;
}

const KEYS: (keyof SplitRatio)[] = ['train', 'val', 'test'];
const LABELS: Record<keyof SplitRatio, string> = { train: 'Train', val: 'Val', test: 'Test' };

// Меняем одно поле — два других пересчитываются пропорционально своему
// текущему соотношению, чтобы сумма всегда была ровно 100. Например: было
// 60/30/10, поставили train = 70 → остаётся 30, val и test делят их в той
// же пропорции 30:10, то есть получат 22 и 8.
function rebalance(current: SplitRatio, changedKey: keyof SplitRatio, rawValue: number): SplitRatio {
  const newValue = Math.min(100, Math.max(0, Math.round(rawValue)));
  const otherKeys = KEYS.filter((k) => k !== changedKey) as [keyof SplitRatio, keyof SplitRatio];
  const remaining = 100 - newValue;
  const oldOthersSum = current[otherKeys[0]] + current[otherKeys[1]];

  const next: SplitRatio = { ...current, [changedKey]: newValue };

  if (oldOthersSum === 0) {
    const half = Math.floor(remaining / 2);
    next[otherKeys[0]] = half;
    next[otherKeys[1]] = remaining - half;
  } else {
    const share0 = Math.round((current[otherKeys[0]] / oldOthersSum) * remaining);
    next[otherKeys[0]] = share0;
    next[otherKeys[1]] = remaining - share0; // добирает остаток округления — сумма гарантированно 100
  }

  return next;
}

export function SplitInputs({ value, onChange }: SplitInputsProps) {
  return (
    <div className="field">
      <div className="split-row">
        {KEYS.map((key) => (
          <NumberField
            key={key}
            label={LABELS[key]}
            value={value[key]}
            min={0}
            max={100}
            onChange={(n) => onChange(rebalance(value, key, n))}
          />
        ))}
      </div>
      <div className="split-bar" aria-hidden="true">
        <span style={{ width: `${value.train}%` }} className="split-bar-train" />
        <span style={{ width: `${value.val}%` }} className="split-bar-val" />
        <span style={{ width: `${value.test}%` }} className="split-bar-test" />
      </div>
      <p className="field-hint">Сумма всегда 100% — соседние поля подстраиваются автоматически.</p>
    </div>
  );
}
