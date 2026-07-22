import { useEffect } from 'react';
import { getTask } from '../api';
import type { TaskResult, TaskStatus } from '../types';

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'failed'];

export function useTaskPolling(
  task: TaskResult | null,
  setTask: (task: TaskResult) => void,
  setError: (message: string) => void,
) {
  useEffect(() => {
    if (!task?.id || TERMINAL_STATUSES.includes(task.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        setTask(await getTask(task.id));
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : 'Не удалось получить статус задачи');
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [task, setTask, setError]);
}
