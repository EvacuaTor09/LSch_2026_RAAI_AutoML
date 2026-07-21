import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { EpochMetric } from '../types';

export function TrainingCurvesChart({ history, metric }: { history: EpochMetric[]; metric: 'loss' | 'acc' }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="epoch" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={`train_${metric}`} stroke="var(--accent)" dot={false} />
        <Line type="monotone" dataKey={`val_${metric}`} stroke="var(--accent-2)" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}