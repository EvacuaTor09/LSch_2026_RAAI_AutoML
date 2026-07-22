import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrainingHistory } from '../types';

type TrainingChartProps = {
  history: TrainingHistory | undefined;
  bestEpoch: number | undefined;
};

type ChartRow = {
  epoch: number;
  train_loss?: number;
  val_loss?: number;
  val_acc?: number;
  val_f1?: number;
};

// Реальная форма history — словарь массивов по метрике (train_loss, val_loss,
// val_acc, val_f1), а не массив объектов "по эпохе", как раньше считал этот
// фронт (отсюда графики вечно были пустыми). Индекс массива = эпоха, поэтому
// собираем их в один построчный набор для recharts здесь.
function buildRows(history: TrainingHistory | undefined): ChartRow[] {
  if (!history) return [];
  const length = Math.max(
    history.train_loss?.length ?? 0,
    history.val_loss?.length ?? 0,
    history.val_acc?.length ?? 0,
    history.val_f1?.length ?? 0,
  );
  return Array.from({ length }, (_, index) => ({
    epoch: index + 1,
    train_loss: history.train_loss?.[index],
    val_loss: history.val_loss?.[index],
    val_acc: history.val_acc?.[index],
    val_f1: history.val_f1?.[index],
  }));
}

export function TrainingChart({ history, bestEpoch }: TrainingChartProps) {
  const rows = buildRows(history);
  if (rows.length === 0) {
    return null;
  }

  const hasLoss = rows.some((row) => row.train_loss !== undefined || row.val_loss !== undefined);
  const hasAcc = rows.some((row) => row.val_acc !== undefined || row.val_f1 !== undefined);

  return (
    <div className="chart-row">
      {hasLoss && (
        <div className="chart-block">
          <h4>Loss по эпохам</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="epoch" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--line)' }} />
              <Legend />
              {bestEpoch && <ReferenceLine x={bestEpoch} stroke="var(--warn)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="train_loss" name="train loss" stroke="var(--accent)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="val_loss" name="val loss" stroke="var(--accent-2)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasAcc && (
        <div className="chart-block">
          <h4>Accuracy / F1 по эпохам</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="epoch" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--line)' }}
                formatter={(value) => {
                  const numericValue = Number(value);
                  return Number.isFinite(numericValue) ? `${Math.round(numericValue * 10000) / 100}%` : '—';
                }}
              />
              <Legend />
              {bestEpoch && <ReferenceLine x={bestEpoch} stroke="var(--warn)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="val_acc" name="val accuracy" stroke="var(--accent)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="val_f1" name="val F1" stroke="var(--accent-2)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
