import type { TaskResult } from '../types';

type TaskStatusPanelProps = {
  status: string;
  error: string;
  task: TaskResult | null;
};

export function TaskStatusPanel({ status, error, task }: TaskStatusPanelProps) {
  return (
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
  );
}
