import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { createTask, getTask, inspectDataset } from './api';
import type { ModelName, SplitConfig, SplitRatio, TaskResult } from './types';

const MODELS: Array<{ id: ModelName; title: string; hint: string }> = [
  { id: 'resnet50', title: 'ResNet-50', hint: 'Сильный CNN-бейзлайн' },
  { id: 'vgg16', title: 'VGG-16', hint: 'Простая и стабильная сеть' },
  { id: 'vit_base_patch16_224', title: 'ViT-B/16', hint: 'Трансформер для изображений' },
];

const DEFAULT_SPLIT: SplitRatio = { train: 60, val: 30, test: 10 };
const SPLIT_KEYS = ['train', 'val', 'test'] as const;

export function App() {
  const [archive, setArchive] = useState<File | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<ModelName[]>(['resnet50', 'vgg16', 'vit_base_patch16_224']);
  const [defaultSplit, setDefaultSplit] = useState<SplitRatio>(DEFAULT_SPLIT);
  const [classSplits, setClassSplits] = useState<Record<string, SplitRatio>>({});
  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const splitConfig: SplitConfig = useMemo(
    () => ({ default: defaultSplit, classes: classSplits }),
    [defaultSplit, classSplits],
  );

  const classBuckets = useMemo(() => {
    const buckets: Record<'train' | 'val' | 'test', string[]> = {
      train: [],
      val: [],
      test: [],
    };

    for (const className of classes) {
      const split = classSplits[className] ?? DEFAULT_SPLIT;
      const bucket = dominantSplit(split);
      buckets[bucket].push(className);
    }

    return buckets;
  }, [classes, classSplits]);

  useEffect(() => {
    if (!task?.id || task.status === 'completed' || task.status === 'failed') {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const fresh = await getTask(task.id);
        setTask(fresh);
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : 'Не удалось получить статус задачи');
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [task]);

  async function handleInspect() {
    if (!archive) {
      setError('Сначала выбери архив');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Анализирую классы в архиве');
    try {
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
      setStatus(`Найдено классов: ${discovered.length}`);
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
      setError('Выбери хотя бы одну модель');
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

  function toggleModel(model: ModelName) {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
    );
  }

  function setClassBucket(className: string, bucket: 'train' | 'val' | 'test') {
    const nextSplit =
      bucket === 'train'
        ? { train: 100, val: 0, test: 0 }
        : bucket === 'val'
          ? { train: 0, val: 100, test: 0 }
          : { train: 0, val: 0, test: 100 };

    setClassSplits((current) => ({
      ...current,
      [className]: nextSplit,
    }));
  }

  function handleDragStart(event: DragEvent<HTMLElement>, className: string) {
    event.dataTransfer.setData('text/plain', className);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, bucket: 'train' | 'val' | 'test') {
    event.preventDefault();
    const className = event.dataTransfer.getData('text/plain');
    if (!className) {
      return;
    }
    setClassBucket(className, bucket);
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
            <strong>{defaultSplit.train}/{defaultSplit.val}/{defaultSplit.test}</strong>
          </div>
          <div className="stat">
            <span>Selected models</span>
            <strong>{selectedModels.length}</strong>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>1. Архив датасета</h2>
          <input
            type="file"
            accept=".zip,.jar,.tar,.tgz,.tar.gz,.rar,.7z"
            onChange={(event) => {
              setArchive(event.target.files?.[0] ?? null);
              setStatus('');
              setError('');
              setTask(null);
            }}
          />
          <div className="actions">
            <button type="button" onClick={handleInspect} disabled={loading || !archive}>
              Найти классы
            </button>
            <button type="button" onClick={handleCreateTask} disabled={loading || !archive} className="primary">
              Создать задачу
            </button>
          </div>
          <p className="muted">Поддержка: zip, jar, tar, tgz, tar.gz, rar, 7z. Каждый верхний каталог — отдельный класс.</p>
        </section>

        <section className="panel">
          <h2>2. Модели</h2>
          <div className="model-grid">
            {MODELS.map((model) => {
              const active = selectedModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-card ${active ? 'active' : ''}`}
                  onClick={() => toggleModel(model.id)}
                >
                  <strong>{model.title}</strong>
                  <span>{model.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>3. Split settings</h2>
          <div className="split-row">
            {SPLIT_KEYS.map((field) => (
              <label key={field}>
                {field}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultSplit[field]}
                  onChange={(event) =>
                    setDefaultSplit((current) => ({
                      ...current,
                      [field]: Number(event.target.value),
                    }))
                  }
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
                  <span>{classBuckets[bucket].length} classes</span>
                </div>
                <div className="chip-row">
                  {classBuckets[bucket].length === 0 ? (
                    <p className="muted">Перетащи класс сюда</p>
                  ) : (
                    classBuckets[bucket].map((className) => (
                      <div
                        className="class-chip"
                        draggable
                        key={className}
                        onDragStart={(event) => handleDragStart(event, className)}
                        onDoubleClick={() => setClassBucket(className, bucket)}
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
              <p className="muted">Сначала загрузи архив и нажми «Найти классы».</p>
            ) : (
              classes.map((className) => {
                const split = classSplits[className] ?? DEFAULT_SPLIT;
                return (
                  <div className="class-card" key={className}>
                    <strong draggable onDragStart={(event) => handleDragStart(event, className)}>{className}</strong>
                    <div className="split-row compact">
                      {SPLIT_KEYS.map((field) => (
                        <label key={field}>
                          {field}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={split[field]}
                            onChange={(event) =>
                              setClassSplits((current) => ({
                                ...current,
                                [className]: {
                                  ...split,
                                  [field]: Number(event.target.value),
                                },
                              }))
                            }
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

        <section className="panel wide">
          <h2>4. Task status</h2>
          {status && <p className="muted">{status}</p>}
          {error && <p className="error">{error}</p>}
          {task ? (
            <div className="result-card">
              <div className="result-top">
                <div>
                  <p className="muted">Task ID</p>
                  <strong>{task.id}</strong>
                </div>
                <div>
                  <p className="muted">Status</p>
                  <strong>{task.status}</strong>
                </div>
                <div>
                  <p className="muted">Best</p>
                  <strong>
                    {task.best_model ?? 'pending'} {task.best_accuracy ? `(${Math.round(task.best_accuracy * 10000) / 100}%)` : ''}
                  </strong>
                </div>
              </div>
              {task.results?.length ? (
                <div className="result-list">
                  {task.results.map((result) => (
                    <article className="result-item" key={result.model_name}>
                      <strong>{result.model_name}</strong>
                      {result.error ? (
                        <span className="error">{result.error}</span>
                      ) : (
                        <span>{Math.round(result.accuracy * 10000) / 100}% accuracy</span>
                      )}
                      {!result.error && <pre>{JSON.stringify(result.params, null, 2)}</pre>}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">Здесь появится статус очереди и результат лучшей модели.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function dominantSplit(split: SplitRatio): 'train' | 'val' | 'test' {
  if (split.val >= split.train && split.val >= split.test) {
    return 'val';
  }
  if (split.test >= split.train && split.test >= split.val) {
    return 'test';
  }
  return 'train';
}
