import { Accentuate } from './Accentuate';
import type { LegalPage } from '@/lib/content-schema';

// Long-form legal / page-with-sections renderer. One source of truth for
// /privacy, /terms and any admin-created /p/[slug] page that uses the same
// intro + sections shape.
export function LegalDoc({
  intro,
  lastUpdated,
  sections,
}: Pick<LegalPage, 'intro' | 'lastUpdated' | 'sections'>) {
  return (
    <article className="container-x pt-20 pb-24 max-w-3xl">
      {intro.eyebrow ? (
        <p className="display text-sm uppercase tracking-widest text-ember-400">{intro.eyebrow}</p>
      ) : null}
      {intro.headline ? (
        <h1 className="mt-3 display text-4xl font-extrabold sm:text-5xl tracking-tight">
          <Accentuate text={intro.headline} />
        </h1>
      ) : null}
      {lastUpdated ? (
        <p className="mt-3 text-sm text-cream/50">Last updated: {lastUpdated}</p>
      ) : null}
      {intro.lead ? (
        <p className="mt-6 text-lg text-cream/80 leading-relaxed">{intro.lead}</p>
      ) : null}

      {sections.length > 0 ? (
        <div className="mt-10 space-y-6 text-cream/80 leading-relaxed">
          {sections.map((s, i) =>
            s.heading || s.body ? (
              <section key={i}>
                {s.heading ? (
                  <h2 className="display text-xl font-semibold text-cream">{s.heading}</h2>
                ) : null}
                {s.body ? <p className="mt-2 whitespace-pre-line">{s.body}</p> : null}
              </section>
            ) : null,
          )}
        </div>
      ) : null}
    </article>
  );
}
