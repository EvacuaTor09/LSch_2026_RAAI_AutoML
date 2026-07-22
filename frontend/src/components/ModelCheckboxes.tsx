import type { ModelName } from '../types';

const MODELS: { id: ModelName; label: string; hint: string }[] = [
  { id: 'resnet50', label: 'ResNet-50', hint: 'сильный CNN-бейзлайн' },
  { id: 'vgg16', label: 'VGG-16', hint: 'проще и стабильнее' },
  { id: 'vit_base_patch16_224', label: 'ViT-B/16', hint: 'трансформер, медленнее на CPU' },
];

interface ModelCheckboxesProps {
  selected: ModelName[];
  onChange: (models: ModelName[]) => void;
}

export function ModelCheckboxes({ selected, onChange }: ModelCheckboxesProps) {
  function toggle(model: ModelName) {
    onChange(selected.includes(model) ? selected.filter((m) => m !== model) : [...selected, model]);
  }

  return (
    <div className="field">
      <div className="toggle-list">
        {MODELS.map((m) => (
          <label key={m.id} className="toggle-row">
            <span className="toggle-switch">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              <span className="toggle-track" aria-hidden="true" />
            </span>
            <span className="toggle-label">
              <strong>{m.label}</strong>
              <span className="muted"> — {m.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {selected.length > 1 && (
        <p className="field-warning">
          Выбрано моделей: {selected.length}. Сервер CPU-only — обучение займёт заметно больше времени.
        </p>
      )}
      {selected.length === 0 && <p className="field-error">Выберите хотя бы одну модель.</p>}
    </div>
  );
}
