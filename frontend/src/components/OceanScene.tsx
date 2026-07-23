import bubble1 from '../assets/bubble1.svg';
import coral from '../assets/coral.svg';
import fish1 from '../assets/fish1.svg';
import fish2 from '../assets/fish2.svg';
import fish3 from '../assets/fish3.svg';
import patrick from '../assets/patrick.svg';
import seaflower from '../assets/seaflower.svg';

// Декоративный фон-«аквариум»: чистый CSS-анимации (transform/opacity — не
// триггерят layout/reflow, поэтому дёшево держать десяток элементов и не
// проседать по FPS). JS тут нужен только чтобы сгенерировать разброс
// параметров (позиция/скорость/задержка) — сама анимация целиком в CSS.
// pointer-events: none и aria-hidden — это чисто декор, не должен мешать
// кликам и скринридерам.

type FishSpec = {
  src: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  // ltr = плывёт слева направо (спрайт зеркалим, т.к. рыбки на арте смотрят влево)
  direction: 'rtl' | 'ltr';
};

const FISH: FishSpec[] = [
  { src: fish1, top: '14%', size: 60, duration: 32, delay: -4, direction: 'rtl' },
  { src: fish2, top: '48%', size: 44, duration: 24, delay: -14, direction: 'ltr' },
  { src: fish3, top: '70%', size: 52, duration: 38, delay: -22, direction: 'rtl' },
  { src: fish1, top: '32%', size: 32, duration: 20, delay: -8, direction: 'ltr' },
];

// Пузыри: 16 штук с псевдослучайным, но детерминированным разбросом (без
// Math.random — чтобы позиции не «прыгали» при каждом ре-рендере компонента).
const BUBBLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 61.8) % 100}%`,
  size: 8 + ((i * 7) % 5) * 4,
  duration: 9 + ((i * 5) % 10),
  delay: -((i * 37) % 20),
}));

export function OceanScene() {
  return (
    <div className="ocean-scene" aria-hidden="true">
      <div className="ocean-rays" />

      {BUBBLES.map((b, i) => (
        <img
          key={i}
          src={bubble1}
          className="ocean-bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      {FISH.map((f, i) => (
        <div
          key={i}
          className={`ocean-fish ocean-fish--${f.direction}`}
          style={{ top: f.top, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }}
        >
          <span className={`ocean-fish-flip${f.direction === 'ltr' ? ' is-flipped' : ''}`}>
            <img
              src={f.src}
              width={f.size}
              height={f.size}
              className="ocean-fish-bob"
              style={{ animationDelay: `${f.delay * 0.3}s` }}
            />
          </span>
        </div>
      ))}

      <div className="ocean-floor">
        <img src={seaflower} className="ocean-sway" style={{ animationDelay: '-1s' }} width={64} alt="" />
        <img src={coral} className="ocean-sway" style={{ animationDelay: '-3.2s' }} width={80} alt="" />
        <img src={patrick} className="ocean-sway ocean-sway--slow" style={{ animationDelay: '-2s' }} width={56} alt="" />
        <img src={coral} className="ocean-sway" style={{ animationDelay: '-4.6s' }} width={60} alt="" />
      </div>
    </div>
  );
}
