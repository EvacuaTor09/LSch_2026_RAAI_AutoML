import type { DragEvent } from 'react';
import type { SplitRatio } from '../types';

const SPLIT_KEYS = ['train', 'val', 'test'] as const;
type Bucket = (typeof SPLIT_KEYS)[number];

type SplitEditorProps = {
  defaultSplit: SplitRatio;
  onDefaultSplitChange: (field: Bucket, value: number) => void;
  classes: string[];
  classSplits: Record<string, SplitRatio>;
  onClassFieldChange: (className: string, field: Bucket, value: number) => void;
  onClassBucketChange: (className: string, bucket: Bucket) => void;
};

export function SplitEditor({
  defaultSplit,
  onDefaultSplitChange,
  classes,
  classSplits,
  onClassFieldChange,
  onClassBucketChange,
}: SplitEditorProps) {
  const buckets: Record<Bucket, string[]> = { train: [], val: [], test: [] };
  for (const className of classes) {
    const split = classSplits[className] ?? defaultSplit;
    buckets[dominantSplit(split)].push(className);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, className: string) {
    event.dataTransfer.setData('text/plain', className);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, bucket: Bucket) {
    event.preventDefault();
    const className = event.dataTransfer.getData('text/plain');
    if (className) {
      onClassBucketChange(className, bucket);
    }
  }

  return (
    <section className="panel">
      <h2>3. Настройки сплита обучающей, валидационной и тестовой выборки</h2>
      <div className="split-row">
        {SPLIT_KEYS.map((field) => (
          <label key={field}>
            {field}
            <input
              type="number"
              min={0}
              max={100}
              value={defaultSplit[field]}
              onChange={(event) => onDefaultSplitChange(field, Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="bucket-grid">
        {SPLIT_KEYS.map((bucket) => (
          <div
            className="bucket"
            key={bucket}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, bucket)}
          >
            <div className="bucket-head">
              <strong>{bucket.toUpperCase()}</strong>
              <span>{buckets[bucket].length} classes</span>
            </div>
            <div className="chip-row">
              {buckets[bucket].length === 0 ? (
                <p className="muted">Перетащите класс сюда</p>
              ) : (
                buckets[bucket].map((className) => (
                  <div
                    className="class-chip"
                    draggable
                    key={className}
                    onDragStart={(event) => handleDragStart(event, className)}
                    onDoubleClick={() => onClassBucketChange(className, bucket)}
                  >
                    {className}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="class-list">
        {classes.length === 0 ? (
          <p className="muted">Сначала загрузите архив и нажмите «Найти классы».</p>
        ) : (
          classes.map((className) => {
            const split = classSplits[className] ?? defaultSplit;
            return (
              <div className="class-card" key={className}>
                <strong draggable onDragStart={(event) => handleDragStart(event, className)}>
                  {className}
                </strong>
                <div className="split-row compact">
                  {SPLIT_KEYS.map((field) => (
                    <label key={field}>
                      {field}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={split[field]}
                        onChange={(event) => onClassFieldChange(className, field, Number(event.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function dominantSplit(split: SplitRatio): Bucket {
  if (split.val >= split.train && split.val >= split.test) return 'val';
  if (split.test >= split.train && split.test >= split.val) return 'test';
  return 'train';
}
