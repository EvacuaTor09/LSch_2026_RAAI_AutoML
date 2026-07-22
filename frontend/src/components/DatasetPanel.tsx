import { Dropzone } from './Dropzone';

type DatasetPanelProps = {
  archive: File | null;
  classes: string[];
  loading: boolean;
  onSelectArchive: (file: File) => void;
  onInspect: () => void;
};

export function DatasetPanel({ archive, classes, loading, onSelectArchive, onInspect }: DatasetPanelProps) {
  return (
    <section className="panel">
      <h2>
        <span className="step-badge">1</span>Архив датасета
      </h2>
      <Dropzone file={archive} onFileSelected={onSelectArchive} disabled={loading} />

      <div className="actions actions--single">
        <button type="button" onClick={onInspect} disabled={loading || !archive}>
          Проверить классы
        </button>
      </div>

      {classes.length > 0 && (
        <div className="chip-row" style={{ marginTop: '0.75rem' }}>
          {classes.map((className) => (
            <span key={className} className="class-chip class-chip--static">
              {className}
            </span>
          ))}
        </div>
      )}
      <p className="field-hint">
        Каждый верхний каталог в архиве — отдельный класс. Все классы участвуют во всех выборках (train/val/test) —
        отдельно распределять их вручную не нужно.
      </p>
    </section>
  );
}
