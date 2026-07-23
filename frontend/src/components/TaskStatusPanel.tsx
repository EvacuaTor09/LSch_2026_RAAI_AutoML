import type { TaskResult } from '../types';
import { ModelResultCard } from './ModelResultCard';

type TaskStatusPanelProps = {
  status: string;
  error: string;
  task: TaskResult | null;
  tasks: TaskResult[];
  onSelectTask: (taskId: string) => void;
};

const STATUS_LABELS: Record<TaskResult['status'], string> = {
  queued: 'в очереди',
  running: 'обучается',
  completed: 'готово',
  failed: 'ошибка',
};

function formatCreatedAt(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function TaskStatusPanel({ status, error, task, tasks, onSelectTask }: TaskStatusPanelProps) {
  return (
    <section className="panel wide">
      <h2>
        <span className="step-badge">5</span>Результаты
      </h2>
      {status && <p className="muted">{status}</p>}
      {error && <p className="error">{error}</p>}

      {tasks.length > 0 ? (
        <div className="task-history">
          <h3 className="subheading">Мои задачи</h3>
          <div className="task-history-list">
            {tasks.map((item) => {
              const active = item.id === task?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`task-history-item${active ? ' is-active' : ''}`}
                  onClick={() => onSelectTask(item.id)}
                >
                  <span className="task-history-id">{item.id}</span>
                  <span className={`status-pill status-pill--${item.status}`}>{STATUS_LABELS[item.status]}</span>
                  <span className="muted task-history-meta">
                    {item.best_model
                      ? `${item.best_model}${item.best_accuracy ? ` · ${Math.round(item.best_accuracy * 10000) / 100}%` : ''}`
                      : formatCreatedAt(item.created_at) || 'без результатов'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {task ? (
        <div className="result-card">
          <div className="result-top">
            <div>
              <p className="muted">Task ID</p>
              <strong>{task.id}</strong>
            </div>
            <div>
              <p className="muted">Статус</p>
              <strong className={`status-pill status-pill--${task.status}`}>{STATUS_LABELS[task.status]}</strong>
            </div>
            <div>
              <p className="muted">Лучшая модель</p>
              <strong>
                {task.best_model ?? 'пока нет'}{' '}
                {task.best_accuracy ? `(${Math.round(task.best_accuracy * 10000) / 100}%)` : ''}
              </strong>
            </div>
          </div>
          {task.results?.length ? (
            <div className="result-list">
              {task.results.map((result) => (
                <ModelResultCard
                  key={result.model_name}
                  result={result}
                  isBest={result.model_name === task.best_model}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="muted">Здесь появится статус очереди и результаты по каждой модели.</p>
      )}
    </section>
  );
}
