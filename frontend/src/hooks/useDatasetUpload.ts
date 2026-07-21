import { useState } from 'react';
import { ALLOWED_EXTENSIONS, inspectDataset, isAllowedArchive } from '../api';
import type { SplitRatio } from '../types';

export const DEFAULT_SPLIT: SplitRatio = { train: 60, val: 30, test: 10 };

export function useDatasetUpload() {
  const [archive, setArchiveFile] = useState<File | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [classSplits, setClassSplits] = useState<Record<string, SplitRatio>>({});

  function selectArchive(file: File | null): string | null {
    setClasses([]);
    if (file && !isAllowedArchive(file)) {
      setArchiveFile(null);
      return `Неподдерживаемый формат файла. Поддерживаются только: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    setArchiveFile(file);
    return null;
  }

  async function inspectArchive(): Promise<number> {
    if (!archive) {
      throw new Error('Сначала выберите архив');
    }
    const discovered = await inspectDataset(archive);
    setClasses(discovered);
    setClassSplits((previous) => {
      const next = { ...previous };
      for (const className of discovered) {
        if (!next[className]) {
          next[className] = DEFAULT_SPLIT;
        }
      }
      return next;
    });
    return discovered.length;
  }

  return { archive, classes, classSplits, setClassSplits, selectArchive, inspectArchive };
}
