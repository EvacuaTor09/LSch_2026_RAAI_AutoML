import type { ChangeEvent } from 'react';
import { ALLOWED_EXTENSIONS } from '../api';

type UploadPanelProps = {
  archive: File | null;
  loading: boolean;
  onSelectArchive: (file: File | null) => void;
  onInspect: () => void;
  onCreateTask: () => void;
};

export function UploadPanel({ archive, loading, onSelectArchive, onInspect, onCreateTask }: UploadPanelProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSelectArchive(event.target.files?.[0] ?? null);
  }

  return (
    <section className="panel">
      <h2>1. Архив датасета</h2>
      <input type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={handleChange} />
      <div className="actions">
        <button type="button" onClick={onInspect} disabled={loading || !archive}>
          Найти классы
        </button>
        <button type="button" onClick={onCreateTask} disabled={loading || !archive} className="primary">
          Создать задачу
        </button>
      </div>
      <p className="muted">
        Поддержка: {ALLOWED_EXTENSIONS.join(', ')}. Каждый верхний каталог в архиве — отдельный класс.
      </p>
    </section>
  );
}
