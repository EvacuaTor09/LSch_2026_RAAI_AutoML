import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { EpochMetric } from '../types';

type TrainingCurvesChartProps = {
  history: EpochMetric[];
  metric: 'loss' | 'acc';
  title?: string;
};

export function TrainingCurvesChart({ history, metric, title }: TrainingCurvesChartProps) {
  if (history.length === 0) {
    return (
      <div className="chart-block">
        {title && <h4>{title}</h4>}
        <div className="chart-placeholder">
          <p className="muted">Нет данных по эпохам — появятся, когда обучение начнёт присылать историю.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-block">
      {title && <h4>{title}</h4>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="epoch" stroke="var(--muted)" />
          <YAxis stroke="var(--muted)" />
          <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--line)' }} />
          <Legend />
          <Line type="monotone" dataKey={`train_${metric}`} stroke="var(--accent)" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey={`val_${metric}`} stroke="var(--accent-2)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
