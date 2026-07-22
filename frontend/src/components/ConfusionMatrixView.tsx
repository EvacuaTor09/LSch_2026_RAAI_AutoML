import type { ConfusionMatrix } from '../types';

type ConfusionMatrixViewProps = {
  data: ConfusionMatrix | undefined;
};

export function ConfusionMatrixView({ data }: ConfusionMatrixViewProps) {
  if (!data) {
    return (
      <div className="chart-block">
        <h4>Confusion matrix</h4>
        <div className="chart-placeholder">
          <p className="muted">Нет данных confusion matrix — бэкенд ещё не отдаёт этот блок.</p>
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...data.matrix.flat());

  return (
    <div className="chart-block">
      <h4>Confusion matrix</h4>
      <table className="confusion-matrix">
        <thead>
          <tr>
            <th />
            {data.labels.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row, rowIndex) => (
            <tr key={data.labels[rowIndex]}>
              <th>{data.labels[rowIndex]}</th>
              {row.map((cellValue, columnIndex) => (
                <td key={columnIndex} style={{ background: `rgba(31, 182, 164, ${cellValue / max})` }}>
                  {cellValue}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
