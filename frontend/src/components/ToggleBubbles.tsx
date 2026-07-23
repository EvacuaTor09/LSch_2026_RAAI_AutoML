// Общая разметка "всплеска" пузырьков для .toggle-switch. Сама анимация —
// целиком в CSS (input:checked ~ .toggle-bubbles, см. styles.css), поэтому
// это чисто декоративная, без-стейтовая разметка: воткнул рядом с
// .toggle-track внутри любого .toggle-switch — и переключение тоггла само
// проигрывает всплеск.
const PARTICLES = [0, 1, 2, 3, 4];

export function ToggleBubbles() {
  return (
    <span className="toggle-bubbles" aria-hidden="true">
      {PARTICLES.map((i) => (
        <span key={i} className="toggle-bubble" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </span>
  );
}
