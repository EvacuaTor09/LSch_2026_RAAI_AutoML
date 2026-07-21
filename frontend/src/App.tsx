import { useMemo, useState } from 'react';
import { createTask } from './api';
import { ModelPicker } from './components/ModelPicker';
import { SplitEditor } from './components/SplitEditor';
import { TaskStatusPanel } from './components/TaskStatusPanel';
import { UploadPanel } from './components/UploadPanel';
import { DEFAULT_SPLIT, useDatasetUpload } from './hooks/useDatasetUpload';
import { useTaskPolling } from './hooks/useTaskPolling';
import type { ModelName, SplitConfig, SplitRatio, TaskResult } from './types';

export function App() {
  const { archive, classes, classSplits, setClassSplits, selectArchive, inspectArchive } = useDatasetUpload();

  const [selectedModels, setSelectedModels] = useState<ModelName[]>([
    'resnet50',
    'vgg16',
    'vit_base_patch16_224',
  ]);
  const [defaultSplit, setDefaultSplit] = useState<SplitRatio>(DEFAULT_SPLIT);
  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const splitConfig: SplitConfig = useMemo(
    () => ({ default: defaultSplit, classes: classSplits }),
    [defaultSplit, classSplits],
  );

  useTaskPolling(task, setTask, setError);

  function toggleModel(model: ModelName) {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
    );
  }

  function handleSelectArchive(file: File | null) {
    const validationError = selectArchive(file);
    setStatus('');
    setError(validationError ?? '');
    setTask(null);
  }

  async function handleInspect() {
    setLoading(true);
    setError('');
    setStatus('Анализирую классы в архиве');
    try {
      const count = await inspectArchive();
      setStatus(`Найдено классов: ${count}`);
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : 'Не удалось разобрать архив');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!archive) {
      setError('Выбери архив с датасетом');
      return;
    }
    if (!selectedModels.length) {
      setError('Выберите хотя бы одну модель');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Создаю задачу');
    try {
      const created = await createTask({ archive, models: selectedModels, splitConfig });
      setTask(created);
      setStatus(`Задача ${created.id} поставлена в очередь`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  }

  function handleClassFieldChange(className: string, field: keyof SplitRatio, value: number) {
    setClassSplits((current) => ({
      ...current,
      [className]: { ...(current[className] ?? defaultSplit), [field]: value },
    }));
  }

  function handleClassBucketChange(className: string, bucket: keyof SplitRatio) {
    const nextSplit: SplitRatio =
      bucket === 'train'
        ? { train: 100, val: 0, test: 0 }
        : bucket === 'val'
          ? { train: 0, val: 100, test: 0 }
          : { train: 0, val: 0, test: 100 };
    setClassSplits((current) => ({ ...current, [className]: nextSplit }));
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">AutoML orchestration</p>
          <h1>Панель задач для обучения нескольких моделей</h1>
          <p className="lead">
            Загрузи архив, настрой разбиение по классам, выбери модели и отправь задачу в backend.
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>Split default</span>
            <strong>
              {defaultSplit.train}/{defaultSplit.val}/{defaultSplit.test}
            </strong>
          </div>
          <div className="stat">
            <span>Selected models</span>
            <strong>{selectedModels.length}</strong>
          </div>
        </div>
      </header>

      <main className="grid">
        <UploadPanel
          archive={archive}
          loading={loading}
          onSelectArchive={handleSelectArchive}
          onInspect={handleInspect}
          onCreateTask={handleCreateTask}
        />

        <ModelPicker selected={selectedModels} onToggle={toggleModel} />

        <SplitEditor
          defaultSplit={defaultSplit}
          onDefaultSplitChange={(field, value) => setDefaultSplit((current) => ({ ...current, [field]: value }))}
          classes={classes}
          classSplits={classSplits}
          onClassFieldChange={handleClassFieldChange}
          onClassBucketChange={handleClassBucketChange}
        />

        <TaskStatusPanel status={status} error={error} task={task} />
      </main>
    </div>
  );
}
