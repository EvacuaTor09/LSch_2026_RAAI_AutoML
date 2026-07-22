import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ALLOWED_EXTENSIONS, isAllowedArchive } from '../api';

interface DropzoneProps {
  file: File | null;
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function Dropzone({ file, onFileSelected, disabled }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndSet(candidate: File) {
    if (!isAllowedArchive(candidate)) {
      setError(`Неверный формат файла. Ожидается: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    setError('');
    onFileSelected(candidate);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) validateAndSet(dropped);
  }

  return (
    <div className="field">
      <div
        className={`dropzone${dragOver ? ' dropzone--over' : ''}${disabled ? ' dropzone--disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ALLOWED_EXTENSIONS.join(',')}
          disabled={disabled}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) validateAndSet(selected);
            e.target.value = ''; // разрешить повторный выбор того же файла
          }}
        />
        <svg className="dropzone-icon" viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1a1 1 0 1 1 2 0v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1a1 1 0 0 1 1-1Z"
          />
        </svg>
        {file ? (
          <p>
            <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(1)} МБ)
          </p>
        ) : (
          <p>
            Перетащите архив датасета сюда или нажмите, чтобы выбрать
            <br />
            <span className="muted">{ALLOWED_EXTENSIONS.join(', ')}</span>
          </p>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
