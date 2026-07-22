import { useState } from 'react';
import { createTask } from '../api';
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

export function DashboardPage() {
  const { user, logout, skipAuth } = useAuth();
  const { archive, classes, selectArchive, inspectArchive } = useDatasetUpload();

  const [selectedModels, setSelectedModels] = useState<ModelName[]>(ALL_MODELS);
  const [split, setSplit] = useState<SplitRatio>(DEFAULT_SPLIT);
  const [classSplits, setClassSplits] = useState<Record<string, SplitRatio>>({});
  const [primaryMetric, setPrimaryMetric] = useState<MetricName>('f1');
  const [advanced, setAdvanced] = useState<AdvancedParams | undefined>(undefined);

  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useTaskPolling(task, setTask, setError);

  function handleSelectArchive(file: File | null) {
    if (!file) return;
    const validationError = selectArchive(file);
    setStatus('');
    setError(validationError ?? '');
    setTask(null);
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
          <p className="eyebrow">{skipAuth ? 'локальный режим' : 'Аквариум · AutoML orchestration'}</p>
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
            <span>Split по умолчанию</span>
            <strong>
              {split.train}/{split.val}/{split.test}
            </strong>
          </div>
          {!skipAuth ? (
            <button type="button" onClick={logout} className="logout-button">
              Выйти
            </button>
          ) : (
            <p className="field-hint">Auth отключён — VITE_SKIP_AUTH=true</p>
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

        <TaskStatusPanel status={status} error={error} task={task} />
      </main>
    </div>
  );
}
