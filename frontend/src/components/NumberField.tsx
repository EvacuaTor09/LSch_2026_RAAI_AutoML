import { useEffect, useState } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

// Баг, который чинит этот компонент: <input type="number" value={n}
// onChange={e => onChange(Number(e.target.value))}> при очистке поля даёт
// Number("") === 0, стейт тут же становится 0, инпут перерисовывается с "0",
// и следующая цифра дописывается К этому нулю ("07" вместо "7").
// Фикс: держим то, что реально напечатано, отдельной строкой ("raw"); наверх
// отдаём число только когда строка — валидное число, а пустую строку
// разрешаем как промежуточное состояние вместо мгновенного превращения в 0.
export function NumberField({ label, value, onChange, min, max, step }: NumberFieldProps) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    // Синхронизация только если значение поменялось СНАРУЖИ (например,
    // соседнее поле пересчитало сплит) — иначе перебивали бы то, что
    // человек печатает прямо сейчас.
    if (Number(raw) !== value) setRaw(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="number-field">
      {label}
      <input
        type="text"
        inputMode="decimal"
        step={step}
        value={raw}
        onChange={(e) => {
          const next = e.target.value;
          if (!/^-?\d*\.?\d*$/.test(next)) return; // игнорируем нечисловой ввод
          setRaw(next);
          if (next !== '' && next !== '-' && !next.endsWith('.')) {
            const parsed = Number(next);
            if (!Number.isNaN(parsed)) {
              onChange(min !== undefined || max !== undefined ? clamp(parsed, min, max) : parsed);
            }
          }
        }}
        onBlur={() => {
          const parsed = Number(raw);
          if (raw === '' || Number.isNaN(parsed)) {
            setRaw(String(value)); // откат к последнему валидному значению
          } else {
            const clamped = min !== undefined || max !== undefined ? clamp(parsed, min, max) : parsed;
            setRaw(String(clamped));
            onChange(clamped);
          }
        }}
      />
    </label>
  );
}

function clamp(n: number, min?: number, max?: number): number {
  let result = n;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}
