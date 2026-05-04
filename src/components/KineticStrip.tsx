import type { DanceStyle } from '@/lib/content-schema';

export function KineticStrip({ styles }: { styles: DanceStyle[] }) {
  const tokens = styles.flatMap((s) => [s.name, '·']);
  // duplicate for seamless loop
  const display = [...tokens, ...tokens, ...tokens, ...tokens];
  return (
    <section
      aria-hidden
      className="relative overflow-hidden border-y border-cream/10 bg-ink-900/40 py-6"
    >
      <div className="flex w-[200%] animate-marquee whitespace-nowrap">
        {display.map((t, i) => (
          <span
            key={i}
            className={`display mx-6 text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight ${
              t === '·' ? 'text-ember-500' : 'text-cream/80'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
