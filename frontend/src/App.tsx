import { useEffect, useId, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
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
  ModelRunResult,
  PredictionResult,
  SplitConfig,
  SplitRatio,
  TaskResult,
  TrainingHistory,
} from './types';

const MODELS: Array<{ id: ModelName; title: string; hint: string }> = [
  { id: 'resnet50', title: 'ResNet-50', hint: 'CNN-бейзлайн' },
  { id: 'vgg16', title: 'VGG-16', hint: 'Простая сеть' },
  { id: 'vit_base_patch16_224', title: 'ViT-B/16', hint: 'Трансформер' },
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
  const [predictModel, setPredictModel] = useState<string>('resnet50');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictBusy, setPredictBusy] = useState(false);
  const [predictError, setPredictError] = useState('');

  const splitConfig: SplitConfig = useMemo(
    () => ({ default: defaultSplit, classes: classSplits }),
    [defaultSplit, classSplits],
  );

  const useTrainedPredict = Boolean(task && task.status === 'completed');
  const predictModels = useMemo(
    () => (useTrainedPredict && task ? task.models : MODELS.map((model) => model.id)),
    [useTrainedPredict, task],
  );

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
    if (useTrainedPredict && task) {
      if (!task.models.includes(predictModel as ModelName)) {
        setPredictModel(task.best_model ?? task.models[0] ?? 'resnet50');
      }
      return;
    }
    if (!MODELS.some((model) => model.id === predictModel)) {
      setPredictModel('resnet50');
    }
  }, [task, useTrainedPredict, predictModel]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      const result =
        authMode === 'login'
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
    setPredictFile(null);
    setPredictModel('resnet50');
    setStatus('');
    setError('');
    setPredictError('');
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
            next[className] = { ...defaultSplit };
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
      const result =
        useTrainedPredict && task
          ? await predictTask({ taskId: task.id, model: predictModel, file: predictFile })
          : await predictPretrained({ model: predictModel as ModelName, file: predictFile });
      setPrediction(result);
    } catch (predictFailure) {
      setPredictError(predictFailure instanceof Error ? predictFailure.message : 'Не удалось выполнить predict');
    } finally {
      setPredictBusy(false);
    }
  }

  function toggleModel(model: ModelName) {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
    );
  }

  function applyDefaultToAllClasses() {
    setClassSplits(() => {
      const next: Record<string, SplitRatio> = {};
      for (const className of classes) {
        next[className] = { ...defaultSplit };
      }
      return next;
    });
  }

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <h1>AutoML</h1>
          <p className="muted">Проверяю сессию…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <h1>AutoML</h1>
          <p>Сравни модели на своём датасете и сразу проверь predict.</p>
        </div>
        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Username
            <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {loginError ? <p className="error">{loginError}</p> : null}
          <div className="actions">
            <button type="submit" className="primary" disabled={loginBusy}>
              {loginBusy ? 'Жди…' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
            <button type="button" className="ghost" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Регистрация' : 'Уже есть аккаунт'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          Auto<span>ML</span>
        </div>
        <div className="topbar-meta">
          <span>{authUser.username}</span>
          <span>
            split {defaultSplit.train}/{defaultSplit.val}/{defaultSplit.test}
          </span>
          <span>{selectedModels.length} models</span>
          <button type="button" className="ghost" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="flow">
        <section className="section">
          <div className="section-head">
            <h2>Датасет</h2>
            <p>Загрузи архив с классами в корне, разбери структуру и запусти обучение.</p>
          </div>
          <FilePicker
            accept=".zip,.jar,.tar,.tgz,.tar.gz,.rar,.7z"
            file={archive}
            buttonLabel="Выбрать архив"
            onChange={(file) => {
              setArchive(file);
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
            <button type="button" className="primary" onClick={handleCreateTask} disabled={loading || !archive}>
              Создать задачу
            </button>
          </div>
          <div className="hint-block">
            <p className="muted">
              Форматы: zip, jar, tar, tgz, rar, 7z. В корне архива — папки классов, внутри них картинки. Не клади готовые
              train/val/test: сплит система сделает сама. Нужно минимум 2 класса и лучше ≥4–5 фото на класс, иначе val
              может получиться пустым.
            </p>
            <pre className="hint-pre">{`cats/
  a.jpg
  b.jpg
dogs/
  c.jpg
  d.jpg`}</pre>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Модели</h2>
            <p>Выбери, какие сети дообучить на датасете.</p>
          </div>
          <div className="model-row">
            {MODELS.map((model) => {
              const active = selectedModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-chip ${active ? 'active' : ''}`}
                  onClick={() => toggleModel(model.id)}
                >
                  <strong>{model.title}</strong>
                  <span>{model.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Разбиение</h2>
            <p>
              Доли фотографий внутри каждого класса: train / val / test. По умолчанию одно и то же для всех, ниже
              можно поправить отдельно.
            </p>
          </div>
          <div className="split-row">
            {SPLIT_KEYS.map((field) => (
              <label key={field}>
                {field}, %
                <PercentInput
                  value={defaultSplit[field]}
                  onChange={(value) => {
                    const nextDefault = { ...defaultSplit, [field]: value };
                    setDefaultSplit(nextDefault);
                    setClassSplits((current) => {
                      const next: Record<string, SplitRatio> = { ...current };
                      for (const className of classes) {
                        next[className] = { ...nextDefault };
                      }
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="actions">
            <button type="button" onClick={applyDefaultToAllClasses} disabled={!classes.length}>
              Сбросить классы к умолчанию
            </button>
          </div>
          <p className="muted">
            В каждом классе фото делятся так: {defaultSplit.train}% train / {defaultSplit.val}% val /{' '}
            {defaultSplit.test}% test.
          </p>
          <div className="class-list">
            {classes.length === 0 ? (
              <p className="muted">Сначала найди классы в архиве.</p>
            ) : (
              classes.map((className) => {
                const split = classSplits[className] ?? defaultSplit;
                const total = split.train + split.val + split.test;
                return (
                  <div className="class-item" key={className}>
                    <div className="class-item-head">
                      <strong>{className}</strong>
                      <span className={total === 100 ? 'muted' : 'error'}>сумма {total}%</span>
                    </div>
                    <div className="split-row">
                      {SPLIT_KEYS.map((field) => (
                        <label key={field}>
                          {field}, %
                          <PercentInput
                            value={split[field]}
                            onChange={(value) =>
                              setClassSplits((current) => ({
                                ...current,
                                [className]: {
                                  ...split,
                                  [field]: value,
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

        <section className="section">
          <div className="section-head">
            <h2>Результаты</h2>
            <p>Статус задачи и сравнение метрик по моделям.</p>
          </div>
          {status ? <p className="muted">{status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {task ? (
            <>
              <div className="status-line">
                <div>
                  <span>task</span>
                  <strong>{task.id}</strong>
                </div>
                <div>
                  <span>status</span>
                  <strong>{task.status}</strong>
                </div>
                <div>
                  <span>best</span>
                  <strong>
                    {task.best_model ?? 'pending'}
                    {task.best_accuracy ? ` · ${formatPercent(task.best_accuracy)}` : ''}
                  </strong>
                </div>
              </div>
              {task.results?.length ? (
                <div className="result-list">
                  {task.results.map((result) => (
                    <ModelResultCard key={result.model_name} result={result} />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">После создания задачи здесь появятся статус и метрики.</p>
          )}
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Predict</h2>
            <p>
              {useTrainedPredict
                ? 'Предсказание дообученной моделью из завершённой задачи.'
                : 'Пока нет задачи — ImageNet pretrained. После обучения автоматически переключится на trained.'}
            </p>
          </div>
          <div className="row predict">
            <label>
              Модель
              <select value={predictModel} onChange={(event) => setPredictModel(event.target.value)}>
                {predictModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <FilePicker
              label="Изображение"
              accept="image/*"
              file={predictFile}
              buttonLabel="Выбрать фото"
              onChange={setPredictFile}
            />
            <button type="button" className="primary" onClick={handlePredict} disabled={predictBusy}>
              {predictBusy ? 'Считаю…' : 'Predict'}
            </button>
          </div>
          <p className="muted">{useTrainedPredict ? 'режим: trained' : 'режим: pretrained'}</p>
          {predictError ? <p className="error">{predictError}</p> : null}
          {prediction ? <PredictionCard prediction={prediction} /> : null}
        </section>
      </main>
    </div>
  );
}

function ModelResultCard({ result }: { result: ModelRunResult }) {
  const history = asTrainingHistory(result.history);
  const bestValLoss = bestEpochValue(history?.val_loss, result.best_epoch);

  return (
    <article className="result-block">
      <div className="result-head">
        <strong>{result.model_name}</strong>
        {result.error ? (
          <span className="error">{result.error}</span>
        ) : (
          <span>{formatPercent(result.accuracy)} accuracy</span>
        )}
      </div>
      {result.error ? null : (
        <>
          <div className="metric-groups">
            <MetricGroup title="Метрики">
              <Metric label="accuracy" value={formatPercent(result.accuracy)} />
              <Metric label="precision" value={formatPercent(result.precision)} />
              <Metric label="recall" value={formatPercent(result.recall)} />
              <Metric label="F1" value={formatPercent(result.f1_score)} />
            </MetricGroup>
            <MetricGroup title="Инфо про модель">
              <Metric label="параметры" value={formatNumber(result.num_params)} />
              <Metric label="обучаемые параметры" value={formatNumber(result.trainable_params)} />
              <Metric label="время обучения" value={formatDuration(result.training_time)} />
              <Metric label="вес модели, Мб" value={formatFloat(result.model_size_mb)} />
            </MetricGroup>
            <MetricGroup title="Статистика обучения">
              <Metric label="эпохи" value={formatNumber(result.epochs_trained)} />
              <Metric label="лучшая эпоха" value={formatNumber(result.best_epoch)} />
              <Metric label="val loss (лучшая эпоха)" value={formatFloat(bestValLoss)} />
              <Metric label="val accuracy" value={formatPercent(result.best_val_acc)} />
            </MetricGroup>
          </div>
          <TrainingCharts history={history} bestEpoch={result.best_epoch} />
        </>
      )}
    </article>
  );
}

function FilePicker({
  accept,
  file,
  label,
  buttonLabel = 'Выбрать файл',
  onChange,
}: {
  accept: string;
  file: File | null;
  label?: string;
  buttonLabel?: string;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
  }

  return (
    <div className="file-picker">
      {label ? <span className="file-picker-label">{label}</span> : null}
      <div className="file-picker-row">
        <input id={inputId} className="file-picker-input" type="file" accept={accept} onChange={handleChange} />
        <label htmlFor={inputId} className="file-picker-btn">
          {buttonLabel}
        </label>
        <span className="file-picker-name">{file?.name ?? 'Файл не выбран'}</span>
      </div>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: PredictionResult }) {
  const hasTrainMetrics = typeof prediction.accuracy === 'number';
  const history = asTrainingHistory(prediction.history);
  const bestValLoss = bestEpochValue(history?.val_loss, prediction.best_epoch);

  return (
    <div className="result-block">
      <div className="result-head">
        <strong>{prediction.class_name}</strong>
        <span>{formatPercent(prediction.confidence)} confidence</span>
      </div>
      <div className="metric-groups">
        <MetricGroup title="Предсказание">
          <Metric label="model" value={prediction.model} />
          <Metric label="model_type" value={prediction.model_type} />
          <Metric label="class_id" value={String(prediction.class_id)} />
          <Metric label="class_name" value={prediction.class_name} />
          <Metric label="confidence" value={formatPercent(prediction.confidence)} />
          <Metric label="num_classes" value={formatNumber(prediction.num_classes)} />
        </MetricGroup>
        {hasTrainMetrics ? (
          <>
            <MetricGroup title="Метрики">
              <Metric label="accuracy" value={formatPercent(prediction.accuracy)} />
              <Metric label="precision" value={formatPercent(prediction.precision)} />
              <Metric label="recall" value={formatPercent(prediction.recall)} />
              <Metric label="F1" value={formatPercent(prediction.f1_score)} />
            </MetricGroup>
            <MetricGroup title="Инфо про модель">
              <Metric label="параметры" value={formatNumber(prediction.num_params)} />
              <Metric label="обучаемые параметры" value={formatNumber(prediction.trainable_params)} />
              <Metric label="время обучения" value={formatDuration(prediction.training_time)} />
              <Metric label="вес модели, Мб" value={formatFloat(prediction.model_size_mb)} />
            </MetricGroup>
            <MetricGroup title="Статистика обучения">
              <Metric label="эпохи" value={formatNumber(prediction.epochs_trained)} />
              <Metric label="лучшая эпоха" value={formatNumber(prediction.best_epoch)} />
              <Metric label="val loss (лучшая эпоха)" value={formatFloat(bestValLoss)} />
              <Metric label="val accuracy" value={formatPercent(prediction.best_val_acc)} />
              <Metric label="task_id" value={prediction.task_id ?? 'n/a'} />
            </MetricGroup>
          </>
        ) : (
          <MetricGroup title="Инфо про модель">
            <Metric label="параметры" value={formatNumber(prediction.num_params)} />
            <Metric label="обучаемые параметры" value={formatNumber(prediction.trainable_params)} />
            <Metric label="вес модели, Мб" value={formatFloat(prediction.model_size_mb)} />
          </MetricGroup>
        )}
      </div>
      {prediction.top_predictions?.length ? (
        <div className="metric-block">
          <p>top_predictions</p>
          <div className="metric-grid">
            {prediction.top_predictions.map((item) => (
              <Metric
                key={`${item.class_id}-${item.class_name}`}
                label={`${item.class_id}: ${item.class_name}`}
                value={formatPercent(item.confidence)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {hasTrainMetrics ? <TrainingCharts history={history} bestEpoch={prediction.best_epoch} /> : null}
    </div>
  );
}

function MetricGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="metric-group">
      <h3>{title}</h3>
      <div className="metric-grid">{children}</div>
    </div>
  );
}

function TrainingCharts({ history, bestEpoch }: { history?: TrainingHistory; bestEpoch?: number }) {
  if (!history) {
    return null;
  }

  const trainLoss = toNumberSeries(history.train_loss);
  const valLoss = toNumberSeries(history.val_loss);
  const valAcc = toNumberSeries(history.val_acc);
  const hasLoss = trainLoss.length > 0 || valLoss.length > 0;
  const hasAcc = valAcc.length > 0;

  if (!hasLoss && !hasAcc) {
    return null;
  }

  return (
    <div className="chart-row">
      {hasLoss ? (
        <LineChart
          title="Loss по эпохам"
          series={[
            { label: 'train loss', values: trainLoss, color: '#0f766e' },
            { label: 'val loss', values: valLoss, color: '#1e4064' },
          ]}
          bestEpoch={bestEpoch}
        />
      ) : null}
      {hasAcc ? (
        <LineChart
          title="Accuracy по эпохам"
          series={[{ label: 'val accuracy', values: valAcc, color: '#0f766e' }]}
          bestEpoch={bestEpoch}
          yAsPercent
        />
      ) : null}
    </div>
  );
}

function LineChart({
  title,
  series,
  bestEpoch,
  yAsPercent = false,
}: {
  title: string;
  series: Array<{ label: string; values: number[]; color: string }>;
  bestEpoch?: number;
  yAsPercent?: boolean;
}) {
  const width = 560;
  const height = 220;
  const pad = { top: 18, right: 16, bottom: 32, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const lengths = series.map((item) => item.values.length).filter((n) => n > 0);
  const epochs = lengths.length ? Math.max(...lengths) : 0;
  if (epochs === 0) {
    return null;
  }

  const allValues = series.flatMap((item) => item.values);
  let yMin = Math.min(...allValues);
  let yMax = Math.max(...allValues);
  if (yMin === yMax) {
    yMin -= yAsPercent ? 0.05 : 0.1;
    yMax += yAsPercent ? 0.05 : 0.1;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const xAt = (index: number) => pad.left + (epochs === 1 ? innerW / 2 : (index / (epochs - 1)) * innerW);
  const yAt = (value: number) => pad.top + ((yMax - value) / (yMax - yMin)) * innerH;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <strong>{title}</strong>
        <div className="chart-legend">
          {series
            .filter((item) => item.values.length > 0)
            .map((item) => (
              <span key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
        </div>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {ticks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={`tick-${tick}`}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} className="chart-grid" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" className="chart-label">
                {yAsPercent ? formatPercent(tick) : tick.toFixed(2)}
              </text>
            </g>
          );
        })}
        <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} className="chart-axis" />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} className="chart-axis" />
        {series.map((item) => {
          if (item.values.length === 0) {
            return null;
          }
          const points = item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ');
          return (
            <g key={item.label}>
              <polyline fill="none" stroke={item.color} strokeWidth="2.5" points={points} />
              {item.values.map((value, index) => (
                <circle key={`${item.label}-${index}`} cx={xAt(index)} cy={yAt(value)} r="3.2" fill={item.color} />
              ))}
            </g>
          );
        })}
        {typeof bestEpoch === 'number' && bestEpoch >= 1 && bestEpoch <= epochs ? (
          <line
            x1={xAt(bestEpoch - 1)}
            y1={pad.top}
            x2={xAt(bestEpoch - 1)}
            y2={pad.top + innerH}
            className="chart-best"
          />
        ) : null}
        {Array.from({ length: epochs }, (_, index) => (
          <text key={`ep-${index}`} x={xAt(index)} y={height - 10} textAnchor="middle" className="chart-label">
            {index + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(String(value));
    }
  }, [value, focused]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (raw === '') {
      setText('');
      onChange(0);
      return;
    }
    if (!/^\d{1,3}$/.test(raw)) {
      return;
    }
    const normalized = raw.replace(/^0+(?=\d)/, '');
    const next = Math.min(100, Math.max(0, Number.parseInt(normalized, 10)));
    if (Number.isNaN(next)) {
      return;
    }
    setText(String(next));
    onChange(next);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(String(value));
      }}
    />
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

function asTrainingHistory(history?: TrainingHistory | Record<string, unknown>): TrainingHistory | undefined {
  if (!history || typeof history !== 'object') {
    return undefined;
  }
  return {
    train_loss: toNumberSeries((history as TrainingHistory).train_loss ?? (history as Record<string, unknown>).train_loss),
    val_loss: toNumberSeries((history as TrainingHistory).val_loss ?? (history as Record<string, unknown>).val_loss),
    val_acc: toNumberSeries((history as TrainingHistory).val_acc ?? (history as Record<string, unknown>).val_acc),
    val_f1: toNumberSeries((history as TrainingHistory).val_f1 ?? (history as Record<string, unknown>).val_f1),
  };
}

function toNumberSeries(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
}

function bestEpochValue(series: number[] | undefined, bestEpoch?: number): number | undefined {
  if (!series?.length || typeof bestEpoch !== 'number' || bestEpoch < 1) {
    return undefined;
  }
  return series[bestEpoch - 1];
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
