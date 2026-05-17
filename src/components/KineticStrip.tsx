import type { DanceStyle } from '@/lib/content-schema';
import { RhythmSignature } from './RhythmSignature';

export function KineticStrip({ styles }: { styles: DanceStyle[] }) {
  const tokens = styles.flatMap((s) => [s.name, '·']);
  // duplicate for seamless loop
  const display = [...tokens, ...tokens, ...tokens, ...tokens];
  const firstStyle = styles[0]?.slug ?? 'salsa';
  return (
    <section
      aria-hidden
      className="relative overflow-hidden border-y border-cream/10 bg-ink-900/40 py-6"
    >
      <div className="flex w-[200%] animate-marquee whitespace-nowrap">
        {display.map((t, i) =>
          t === '·' ? (
            <span
              key={i}
              className="beat-dot display mx-6 text-5xl sm:text-7xl lg:text-8xl font-extrabold text-ember-500"
              style={{ animationDelay: `${(i % 4) * 0.18}s` }}
            >
              {t}
            </span>
          ) : (
            <span
              key={i}
              className="display mx-6 text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-cream/80"
            >
              {t}
            </span>
          ),
        )}
      </div>
      {/* Living clave under the words — the actual beat of the room, not a
          decoration hidden behind a hover. It sways like a body keeping
          time: you feel it before you notice it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
        <span className="sway">
          <RhythmSignature
            style={firstStyle}
            loop
            width={180}
            className="text-cream/30"
          />
        </span>
      </div>
    </section>
  );
}
