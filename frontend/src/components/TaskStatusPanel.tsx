import type { TaskResult } from '../types';
import { ModelResultCard } from './ModelResultCard';

type TaskStatusPanelProps = {
  status: string;
  error: string;
  task: TaskResult | null;
};

const STATUS_LABELS: Record<TaskResult['status'], string> = {
  queued: 'в очереди',
  running: 'обучается',
  completed: 'готово',
  failed: 'ошибка',
};

export function TaskStatusPanel({ status, error, task }: TaskStatusPanelProps) {
  return (
    <section className="panel wide">
      <h2>
        <span className="step-badge">5</span>Результаты
      </h2>
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
                  taskId={task.id}
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
