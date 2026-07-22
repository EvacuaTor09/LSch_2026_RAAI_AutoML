import { SplitInputs } from './SplitInputs';
import type { SplitRatio } from '../types';

type ClassSplitsProps = {
  classes: string[];
  defaultSplit: SplitRatio;
  classSplits: Record<string, SplitRatio>;
  onChange: (className: string, split: SplitRatio) => void;
  onResetToDefault: () => void;
};

// Бэк принимает split_config = { default, classes } — свой train/val/test
// на класс, а не только один сплит на весь датасет (см. types.ts). По
// умолчанию все классы используют defaultSplit; здесь можно переопределить
// отдельные классы.
export function ClassSplits({ classes, defaultSplit, classSplits, onChange, onResetToDefault }: ClassSplitsProps) {
  if (classes.length === 0) {
    return <p className="field-hint">Сначала проверьте классы в архиве, чтобы задать сплит по каждому из них.</p>;
  }

  return (
    <div className="field">
      <div className="actions actions--single" style={{ marginBottom: '0.75rem' }}>
        <button type="button" onClick={onResetToDefault}>
          Сбросить все классы к сплиту по умолчанию
        </button>
      </div>
      <div className="class-split-list">
        {classes.map((className) => {
          const split = classSplits[className] ?? defaultSplit;
          const total = split.train + split.val + split.test;
          return (
            <div className="class-item" key={className}>
              <div className="class-item-head">
                <strong>{className}</strong>
                <span className={total === 100 ? 'muted' : 'field-error'}>сумма {total}%</span>
              </div>
              <SplitInputs value={split} onChange={(next) => onChange(className, next)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
