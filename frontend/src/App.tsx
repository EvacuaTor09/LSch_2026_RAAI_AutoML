import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import {
  clearAuthToken,
  createTask,
  getAuthToken,
  getTask,
  inspectDataset,
  login,
  me,
  predictPretrained,
  predictTask,
  register,
  setAuthToken,
} from './api';
import type {
  AuthUser,
  ModelName,
  PredictionResult,
  SplitConfig,
  SplitRatio,
  TaskResult,
} from './types';

const MODELS: Array<{ id: ModelName; title: string; hint: string }> = [
  { id: 'resnet50', title: 'ResNet-50', hint: 'Сильный CNN-бейзлайн' },
  { id: 'vgg16', title: 'VGG-16', hint: 'Простая и стабильная сеть' },
  { id: 'vit_base_patch16_224', title: 'ViT-B/16', hint: 'Трансформер для изображений' },
];

const DEFAULT_SPLIT: SplitRatio = { train: 60, val: 30, test: 10 };
const SPLIT_KEYS = ['train', 'val', 'test'] as const;

export function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [archive, setArchive] = useState<File | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<ModelName[]>(['resnet50', 'vgg16', 'vit_base_patch16_224']);
  const [defaultSplit, setDefaultSplit] = useState<SplitRatio>(DEFAULT_SPLIT);
  const [classSplits, setClassSplits] = useState<Record<string, SplitRatio>>({});
  const [task, setTask] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [predictFile, setPredictFile] = useState<File | null>(null);
  const [predictModel, setPredictModel] = useState('');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [pretrainedPredictFile, setPretrainedPredictFile] = useState<File | null>(null);
  const [pretrainedPredictModel, setPretrainedPredictModel] = useState<ModelName>('resnet50');
  const [pretrainedPrediction, setPretrainedPrediction] = useState<PredictionResult | null>(null);
  const [pretrainedBusy, setPretrainedBusy] = useState(false);
  const [pretrainedError, setPretrainedError] = useState('');
  const [predictBusy, setPredictBusy] = useState(false);
  const [predictError, setPredictError] = useState('');

  const splitConfig: SplitConfig = useMemo(
    () => ({ default: defaultSplit, classes: classSplits }),
    [defaultSplit, classSplits],
  );

  const classBuckets = useMemo(() => {
    const buckets: Record<'train' | 'val' | 'test', string[]> = { train: [], val: [], test: [] };
    for (const className of classes) {
      const split = classSplits[className] ?? DEFAULT_SPLIT;
      buckets[dominantSplit(split)].push(className);
    }
    return buckets;
  }, [classes, classSplits]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = getAuthToken();
      if (!token) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }
      try {
        const user = await me();
        if (active) {
          setAuthUser(user);
        }
      } catch {
        clearAuthToken();
        if (active) {
          setAuthUser(null);
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    if (!task || predictModel) {
      return;
    }
    setPredictModel(task.best_model ?? task.models[0] ?? '');
  }, [task, predictModel]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      const result = authMode === 'login'
        ? await login(loginUsername, loginPassword)
        : await register(loginUsername, loginPassword);
      setAuthToken(result.token);
      setAuthUser({ username: result.username });
    } catch (loginFailure) {
      setLoginError(loginFailure instanceof Error ? loginFailure.message : 'Не удалось продолжить');
    } finally {
      setLoginBusy(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    setAuthUser(null);
    setArchive(null);
    setClasses([]);
    setTask(null);
    setPrediction(null);
    setPretrainedPrediction(null);
    setPredictFile(null);
    setPretrainedPredictFile(null);
    setPredictModel('');
    setPretrainedPredictModel('resnet50');
    setStatus('');
    setError('');
    setPredictError('');
    setPretrainedError('');
  }

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
      setPrediction(null);
      setPredictError('');
      setPredictFile(null);
      setPredictModel(created.best_model ?? created.models[0] ?? '');
      setStatus(`Задача ${created.id} поставлена в очередь`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  }

  async function handlePredict() {
    if (!task) {
      setPredictError('Сначала создай и дождись завершения задачи');
      return;
    }
    if (!predictFile) {
      setPredictError('Выбери файл для предсказания');
      return;
    }
    if (!predictModel) {
      setPredictError('Выбери модель');
      return;
    }
    setPredictBusy(true);
    setPredictError('');
    try {
      const result = await predictTask({ taskId: task.id, model: predictModel, file: predictFile });
      setPrediction(result);
    } catch (predictFailure) {
      setPredictError(predictFailure instanceof Error ? predictFailure.message : 'Не удалось выполнить predict');
    } finally {
      setPredictBusy(false);
    }
  }

  async function handlePretrainedPredict() {
    if (!pretrainedPredictFile) {
      setPretrainedError('Выбери файл для предсказания');
      return;
    }
    if (!pretrainedPredictModel) {
      setPretrainedError('Выбери модель');
      return;
    }
    setPretrainedBusy(true);
    setPretrainedError('');
    try {
      const result = await predictPretrained({ model: pretrainedPredictModel, file: pretrainedPredictFile });
      setPretrainedPrediction(result);
    } catch (failure) {
      setPretrainedError(failure instanceof Error ? failure.message : 'Не удалось выполнить predict');
    } finally {
      setPretrainedBusy(false);
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
    if (className) {
      setClassBucket(className, bucket);
    }
  }

  if (authLoading) {
    return (
      <div className="shell auth-shell">
        <div className="panel auth-panel">
          <p className="muted">Проверяю авторизацию...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="shell auth-shell">
        <div className="auth-hero">
          <p className="eyebrow">AutoML access</p>
          <h1>{authMode === 'login' ? 'Вход в систему' : 'Регистрация'}</h1>
          <p className="lead">Создай аккаунт или войди, чтобы открыть загрузку датасета, обучение и predict.</p>
        </div>
        <form className="panel auth-panel" onSubmit={handleLogin}>
          <label>
            Username
            <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>
          {loginError && <p className="error">{loginError}</p>}
          <button type="submit" className="primary" disabled={loginBusy}>
            {loginBusy ? 'Жди...' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Нет аккаунта? Регистрация' : 'У меня уже есть аккаунт'}
          </button>
        </form>
      </div>
    );
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
            <span>User</span>
            <strong>{authUser.username}</strong>
          </div>
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
          <button type="button" onClick={handleLogout}>
            Выйти
          </button>
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
              setPrediction(null);
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
                    <strong draggable onDragStart={(event) => handleDragStart(event, className)}>
                      {className}
                    </strong>
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
                    {task.best_model ?? 'pending'}{' '}
                    {task.best_accuracy ? `(${Math.round(task.best_accuracy * 10000) / 100}%)` : ''}
                  </strong>
                </div>
              </div>
              {task.best_params && Object.keys(task.best_params).length > 0 ? (
                <div className="metric-block">
                  <p className="muted">Best params</p>
                  <pre>{JSON.stringify(task.best_params, null, 2)}</pre>
                </div>
              ) : null}
              {task.results?.length ? (
                <div className="result-list">
                  {task.results.map((result) => (
                    <article className="result-item" key={result.model_name}>
                      <div className="result-head">
                        <strong>{result.model_name}</strong>
                        {result.error ? (
                          <span className="error">{result.error}</span>
                        ) : (
                          <span>{formatPercent(result.accuracy)} accuracy</span>
                        )}
                      </div>
                      {!result.error ? (
                        <div className="metric-grid">
                          <Metric label="accuracy" value={formatPercent(result.accuracy)} />
                          <Metric label="precision" value={formatPercent(result.precision)} />
                          <Metric label="recall" value={formatPercent(result.recall)} />
                          <Metric label="f1" value={formatPercent(result.f1_score)} />
                          <Metric label="training_time" value={formatDuration(result.training_time)} />
                          <Metric label="num_params" value={formatNumber(result.num_params)} />
                          <Metric label="trainable_params" value={formatNumber(result.trainable_params)} />
                          <Metric label="model_size_mb" value={formatFloat(result.model_size_mb)} />
                          <Metric label="best_val_acc" value={formatPercent(result.best_val_acc)} />
                          <Metric label="epochs_trained" value={formatNumber(result.epochs_trained)} />
                          <Metric label="best_epoch" value={formatNumber(result.best_epoch)} />
                          <Metric label="endpoint" value={result.endpoint ?? result.params?.endpoint ?? 'n/a'} />
                          <Metric label="weights_file" value={result.weights_file ?? result.params?.weights_file ?? 'n/a'} />
                        </div>
                      ) : null}
                      {!result.error && result.params ? (
                        <div className="metric-block">
                          <p className="muted">Params</p>
                          <pre>{JSON.stringify(result.params, null, 2)}</pre>
                        </div>
                      ) : null}
                      {!result.error && result.history ? (
                        <div className="metric-block">
                          <p className="muted">History</p>
                          <pre>{JSON.stringify(result.history, null, 2)}</pre>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">Здесь появится статус очереди и результат лучшей модели.</p>
          )}
        </section>

        <section className="panel wide">
          <h2>5. Predict</h2>
          {task ? (
            <div className="predict-grid">
              <label>
                Модель
                <select value={predictModel} onChange={(event) => setPredictModel(event.target.value)}>
                  <option value="">Выбери модель</option>
                  {task.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Изображение
                <input type="file" accept="image/*" onChange={(event) => setPredictFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="button" className="primary" onClick={handlePredict} disabled={predictBusy}>
                {predictBusy ? 'Считаю...' : 'Predict'}
              </button>
            </div>
          ) : (
            <p className="muted">Сначала создай и дождись завершения задачи, чтобы открыть predict.</p>
          )}
          {predictError && <p className="error">{predictError}</p>}
          {prediction ? (
            <div className="result-item">
              <div className="result-head">
                <strong>{prediction.class_name}</strong>
                <span>{formatPercent(prediction.confidence)} confidence</span>
              </div>
              <div className="metric-grid">
                <Metric label="model" value={prediction.model} />
                <Metric label="model_type" value={prediction.model_type} />
                <Metric label="class_id" value={String(prediction.class_id)} />
                <Metric label="confidence" value={formatPercent(prediction.confidence)} />
              </div>
              <pre>{JSON.stringify(prediction.probabilities, null, 2)}</pre>
            </div>
          ) : null}
        </section>

        <section className="panel wide">
          <h2>6. Pretrained predict</h2>
          <div className="predict-grid">
            <label>
              Модель
              <select value={pretrainedPredictModel} onChange={(event) => setPretrainedPredictModel(event.target.value as ModelName)}>
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Изображение
              <input type="file" accept="image/*" onChange={(event) => setPretrainedPredictFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="primary" onClick={handlePretrainedPredict} disabled={pretrainedBusy}>
              {pretrainedBusy ? 'Считаю...' : 'Predict'}
            </button>
          </div>
          {pretrainedError && <p className="error">{pretrainedError}</p>}
          {pretrainedPrediction ? (
            <div className="result-item">
              <div className="result-head">
                <strong>{pretrainedPrediction.class_name}</strong>
                <span>{formatPercent(pretrainedPrediction.confidence)} confidence</span>
              </div>
              <div className="metric-grid">
                <Metric label="model" value={pretrainedPrediction.model} />
                <Metric label="model_type" value={pretrainedPrediction.model_type} />
                <Metric label="class_id" value={String(pretrainedPrediction.class_id)} />
                <Metric label="confidence" value={formatPercent(pretrainedPrediction.confidence)} />
              </div>
              <pre>{JSON.stringify(pretrainedPrediction.probabilities, null, 2)}</pre>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${Math.round(value * 10000) / 100}%`;
}

function formatNumber(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function formatFloat(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }
  return value.toFixed(2);
}

function formatDuration(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)}s`;
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
