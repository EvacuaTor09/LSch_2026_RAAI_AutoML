import { ALLOWED_EXTENSIONS } from '../api';
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
      <Dropzone
        file={archive}
        onFileSelected={onSelectArchive}
        disabled={loading}
        accept={ALLOWED_EXTENSIONS}
        prompt="Перетащите архив датасета сюда или нажмите, чтобы выбрать"
      />

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
      <div className="hint-block">
        <p className="muted">
          Форматы: zip, jar, tar, tgz, rar, 7z. В корне архива — папки классов, внутри них картинки. Не кладите
          готовые train/val/test — сплит система сделает сама. Нужно минимум 2 класса и лучше ≥4–5 фото на класс,
          иначе val может получиться пустым.
        </p>
        <pre className="hint-pre">{`cats/
  a.jpg
  b.jpg
dogs/
  c.jpg
  d.jpg`}</pre>
      </div>
    </section>
  );
}
