import { useCallback, useEffect, useState } from 'react';
import { createTask, listTasks } from '../api';
import { useAuth } from '../auth/AuthContext';
import { DatasetPanel } from '../components/DatasetPanel';
import { ModelsPanel } from '../components/ModelsPanel';
import { PredictPanel } from '../components/PredictPanel';
import { TrainingConfigPanel } from '../components/TrainingConfigPanel';
import { TaskStatusPanel } from '../components/TaskStatusPanel';
import { DEFAULT_SPLIT, useDatasetUpload } from '../hooks/useDatasetUpload';
import { useTaskPolling } from '../hooks/useTaskPolling';
import type { AdvancedParams, MetricName, ModelName, SplitRatio, TaskResult } from '../types';

const ALL_MODELS: ModelName[] = ['resnet50', 'vgg16', 'vit_base_patch16_224'];

function upsertTask(list: TaskResult[], next: TaskResult): TaskResult[] {
  const without = list.filter((item) => item.id !== next.id);
  return [next, ...without].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  });
}

export function DashboardPage() {
  const { user, logout, skipAuth } = useAuth();
  const { archive, classes, selectArchive, inspectArchive } = useDatasetUpload();

  const [selectedModels, setSelectedModels] = useState<ModelName[]>(ALL_MODELS);
  const [split, setSplit] = useState<SplitRatio>(DEFAULT_SPLIT);
  const [classSplits, setClassSplits] = useState<Record<string, SplitRatio>>({});
  const [primaryMetric, setPrimaryMetric] = useState<MetricName>('f1');
  const [advanced, setAdvanced] = useState<AdvancedParams | undefined>(undefined);

  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleTaskUpdate = useCallback((next: TaskResult) => {
    setTask(next);
    setTasks((current) => upsertTask(current, next));
  }, []);

  useTaskPolling(task, handleTaskUpdate, setError);

  useEffect(() => {
    let active = true;
    async function loadTasks() {
      try {
        const items = await listTasks();
        if (!active) return;
        setTasks(items);
        setTask((current) => {
          if (current) {
            return items.find((item) => item.id === current.id) ?? current;
          }
          return items[0] ?? null;
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить задачи');
        }
      }
    }
    void loadTasks();
    return () => {
      active = false;
    };
  }, [user?.username]);

  function handleSelectArchive(file: File | null) {
    if (!file) return;
    const validationError = selectArchive(file);
    setStatus('');
    setError(validationError ?? '');
    setClassSplits({});
  }

  function handleSplitChange(next: SplitRatio) {
    setSplit(next);
  }

  function handleClassSplitChange(className: string, next: SplitRatio) {
    setClassSplits((current) => ({ ...current, [className]: next }));
  }

  function handleResetClassSplits() {
    setClassSplits({});
  }

  function handleSelectTask(taskId: string) {
    const selected = tasks.find((item) => item.id === taskId);
    if (!selected) return;
    setTask(selected);
    setStatus(`Открыта задача ${selected.id}`);
    setError('');
  }

  async function handleInspect() {
    setLoading(true);
    setError('');
    setStatus('Анализирую классы в архиве…');
    try {
      const discovered = await inspectArchive();
      setStatus(`Найдено классов: ${discovered.length}`);
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : 'Не удалось разобрать архив');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    if (!archive) {
      setError('Сначала выберите архив с датасетом');
      return;
    }
    if (!selectedModels.length) {
      setError('Выберите хотя бы одну модель');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Создаю задачу…');
    try {
      const created = await createTask({
        archive,
        models: selectedModels,
        splitConfig: { default: split, classes: classSplits },
        primaryMetric,
        advanced,
      });
      setTasks((current) => upsertTask(current, created));
      setTask(created);
      setStatus(`Задача ${created.id} поставлена в очередь`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{skipAuth ? 'локальный режим' : 'Аквариум · AutoML-оркестрация'}</p>
          <h1>Панель обучения моделей</h1>
          <p className="lead">
            Загрузите архив с датасетом, выберите модели и параметры обучения — оркестратор поднимет отдельный
            контейнер под каждую задачу.
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>Аккаунт</span>
            <strong>{user?.username ?? 'вы'}</strong>
          </div>
          <div className="stat">
            <span>Разбиение по умолчанию</span>
            <strong>
              {split.train}/{split.val}/{split.test}
            </strong>
          </div>
          {!skipAuth ? (
            <button type="button" onClick={logout} className="logout-button">
              Выйти
            </button>
          ) : (
            <p className="field-hint"></p>
          )}
        </div>
      </header>

      <main className="grid">
        <DatasetPanel
          archive={archive}
          classes={classes}
          loading={loading}
          onSelectArchive={handleSelectArchive}
          onInspect={handleInspect}
        />

        <ModelsPanel selected={selectedModels} onChange={setSelectedModels} />

        <TrainingConfigPanel
          split={split}
          onSplitChange={handleSplitChange}
          classes={classes}
          classSplits={classSplits}
          onClassSplitChange={handleClassSplitChange}
          onResetClassSplits={handleResetClassSplits}
          primaryMetric={primaryMetric}
          onPrimaryMetricChange={setPrimaryMetric}
          advanced={advanced}
          onAdvancedChange={setAdvanced}
          canSubmit={Boolean(archive) && selectedModels.length > 0}
          submitting={loading}
          onSubmit={handleCreateTask}
        />

        <PredictPanel task={task} />

        <TaskStatusPanel
          status={status}
          error={error}
          task={task}
          tasks={tasks}
          onSelectTask={handleSelectTask}
        />
      </main>
    </div>
  );
}
