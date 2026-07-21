import type { ConfusionMatrix } from '../types';

export function ConfusionMatrixView({ data }: { data: ConfusionMatrix }) {
  const max = Math.max(...data.matrix.flat());
  return (
    <table className="confusion-matrix">
      <thead>
        <tr><th /> {data.labels.map((l) => <th key={l}>{l}</th>)}</tr>
      </thead>
      <tbody>
        {data.matrix.map((row, i) => (
          <tr key={data.labels[i]}>
            <th>{data.labels[i]}</th>
            {row.map((v, j) => (
              <td key={j} style={{ background: `rgba(217,72,15,${v / max})` }}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}