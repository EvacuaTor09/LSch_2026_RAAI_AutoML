import type { ModelName } from '../types';

const MODELS: Array<{ id: ModelName; title: string; hint: string }> = [
  { id: 'resnet50', title: 'ResNet-50', hint: 'Сильный CNN-бейзлайн' },
  { id: 'vgg16', title: 'VGG-16', hint: 'Простая и стабильная сеть' },
  { id: 'vit_base_patch16_224', title: 'ViT-B/16', hint: 'Трансформер для изображений' },
];

type ModelPickerProps = {
  selected: ModelName[];
  onToggle: (model: ModelName) => void;
};

export function ModelPicker({ selected, onToggle }: ModelPickerProps) {
  return (
    <section className="panel">
      <h2>2. Модели</h2>
      <div className="model-grid">
        {MODELS.map((model) => {
          const active = selected.includes(model.id);
          return (
            <label key={model.id} className={`model-card ${active ? 'active' : ''}`}>
              <input type="checkbox" checked={active} onChange={() => onToggle(model.id)} />
              <strong>{model.title}</strong>
              <span>{model.hint}</span>
            </label>
          );
        })}
      </div>
      {selected.length === 3 && (
        <p className="muted">
          Все 3 модели обучаются на CPU-only машине — это займёт заметно больше времени, чем одна-две.
        </p>
      )}
    </section>
  );
}
