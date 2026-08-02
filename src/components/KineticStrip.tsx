import type { DanceStyle } from '@/lib/content-schema';

export function KineticStrip({ styles }: { styles: DanceStyle[] }) {
  const tokens = styles.flatMap((s) => [s.name, '·']);
  // duplicate for seamless loop
  const display = [...tokens, ...tokens, ...tokens, ...tokens];
  return (
    <section
      aria-hidden
      className="relative overflow-clip border-y border-cream/10 bg-ink-900/40 py-6"
    >
      {/* The wrapper takes the scroll nudge; the track keeps its own marquee.
          Two different elements, so the transforms compose instead of
          fighting. See .strip-nudge in globals.css for why the mask matters. */}
      <div className="strip-nudge">
        <div className="flex w-[200%] animate-marquee whitespace-nowrap">
          {display.map((t, i) =>
            t === '·' ? (
              // No per-dot animationDelay: the separators are the count, and a
              // hardcoded 0.18s ladder had them drifting off the very beat
              // they exist to mark. Every dot now lands together.
              <span
                key={i}
                className="beat-dot beat-dot--glyph display mx-6 text-5xl sm:text-7xl lg:text-8xl font-extrabold text-ember-500"
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
      </div>
      {/* THE FOLLOW-SPOT. A warm stage light travels the length of the strip
          and the names brighten as it crosses them — the room's lighting rig
          pointed at the line-up, rather than a small diagram of a rhythm that
          read as stray dots at this size. It is the same language as the hero
          spotlight and the .stage-lights wash, finally applied where the type
          is big enough to catch it. Transform-only, so it is free to run. */}
      <span className="strip-light" aria-hidden />
    </section>
  );
}
