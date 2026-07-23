import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface DropzoneProps {
  file: File | null;
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  // Список расширений, которые принимает конкретный дропзон (архивы датасета,
  // изображения для predict и т.д.) — раньше это было зашито в самом
  // компоненте только под архивы, из-за чего в PredictPanel нельзя было
  // выбрать картинку: любой файл проверялся как архив и отклонялся.
  accept: string[];
  // Текст-подсказка внутри пустой зоны, например "Перетащите архив датасета…".
  prompt: string;
}

function isAllowedFile(file: File, accept: string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((extension) => name.endsWith(extension.toLowerCase()));
}

export function Dropzone({ file, onFileSelected, disabled, accept, prompt }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndSet(candidate: File) {
    if (!isAllowedFile(candidate, accept)) {
      setError(`Неверный формат файла. Ожидается: ${accept.join(', ')}`);
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
          accept={accept.join(',')}
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
            {prompt}
            <br />
            <span className="muted">{accept.join(', ')}</span>
          </p>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
