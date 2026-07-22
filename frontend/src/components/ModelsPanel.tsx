import { ModelCheckboxes } from './ModelCheckboxes';
import type { ModelName } from '../types';

type ModelsPanelProps = {
  selected: ModelName[];
  onChange: (models: ModelName[]) => void;
};

export function ModelsPanel({ selected, onChange }: ModelsPanelProps) {
  return (
    <section className="panel">
      <h2>
        <span className="step-badge">2</span>Модели
      </h2>
      <ModelCheckboxes selected={selected} onChange={onChange} />
    </section>
  );
}
