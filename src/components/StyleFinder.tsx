'use client';

import { useMemo, useState } from 'react';
import type { Batch, SiteContent, Studio } from '@/lib/content-schema';
import { visibleBatches } from '@/lib/content-helpers';
import { formatBatchDate, formatInr, todayIso } from '@/lib/format';
import { EnquiryCTA } from './EnquiryCTA';
import { label } from '@/lib/labels';

// Beginners have exactly two tracks, split by when they run:
//   • Weekend mornings → Latin (Salsa + Bachata)
//   • Weekend evenings → West Coast Swing
// The finder only ever recommends the Foundation (beginner) batch — it must
// never surface Intermediate/Advanced.
type TrackId = 'latin' | 'wcs';

interface Track {
  id: TrackId;
  when: string; // option headline
  name: string; // result headline
  tagline: string;
  styleSlugs: string[]; // for batch lookup + enquiry context
  ctaSlug: string; // representative style slug for the WhatsApp/Instagram message
  tod: 'AM' | 'PM'; // preferred time-of-day for the matching batch
}

const TRACKS: Track[] = [
  {
    id: 'latin',
    when: 'Weekend mornings',
    name: 'Latin — Salsa & Bachata',
    tagline:
      'Two dances, one beginner track. Salsa’s spark and Bachata’s connection — the fastest way onto any social floor.',
    styleSlugs: ['salsa', 'bachata'],
    ctaSlug: 'salsa',
    tod: 'AM',
  },
  {
    id: 'wcs',
    when: 'Weekend evenings',
    name: 'West Coast Swing',
    tagline:
      'Smooth, modern and danceable to almost any song — the improviser’s partner dance.',
    styleSlugs: ['west-coast-swing'],
    ctaSlug: 'west-coast-swing',
    tod: 'PM',
  },
];

// Always returns a Foundation batch (or undefined) for the track. Prefers a
// weekend batch in the track's time-of-day, then any weekend Foundation batch,
// then any Foundation batch of that style. Never returns Intermediate/Advanced.
function findFoundationBatch(content: SiteContent, track: Track): Batch | undefined {
  const pool = visibleBatches(content).filter(
    (b) => b.level === 'Foundation' && b.styleSlugs.some((s) => track.styleSlugs.includes(s)),
  );
  const isWeekend = (b: Batch) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const matchesTod = (b: Batch) => (track.tod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time));
  const weekend = pool.filter(isWeekend);
  return weekend.find(matchesTod) ?? weekend[0] ?? pool.find(matchesTod) ?? pool[0];
}

export function StyleFinder({ content }: { content: SiteContent }) {
  const [track, setTrack] = useState<Track | null>(null);

  const recommendedBatch = useMemo(
    () => (track ? findFoundationBatch(content, track) : undefined),
    [content, track],
  );
  const branch: Studio | undefined = recommendedBatch
    ? content.studios.find((s) => s.slug === recommendedBatch.branchSlug)
    : undefined;

  const reset = () => setTrack(null);
  const f = content.pages.home.styleFinder;
  const today = todayIso();

  return (
    <section id="style-finder" className="container-x py-12 sm:py-16 scroll-mt-24">
      <div className="rounded-3xl border border-cream/10 bg-ink-900/60 p-6 sm:p-10 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="display text-sm uppercase tracking-widest text-ember-400">{f.eyebrow}</p>
          {track ? (
            <button onClick={reset} className="btn-ghost text-xs">
              {f.resetLabel}
            </button>
          ) : null}
        </div>
        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{f.headline}</h2>
        <p className="mt-2 text-cream/70 max-w-xl">{f.lead}</p>

        {!track ? (
          <div className="mt-8 grid gap-4">
            <p className="display text-xl">{f.question}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrack(t)}
                  className="rounded-2xl border border-cream/15 bg-ink-950/40 px-5 py-6 text-left text-cream transition hover:border-ember-500/60 hover:bg-ember-500/5"
                >
                  <span className="block display text-lg font-semibold">{t.when}</span>
                  <span className="mt-1 block text-cream/70 text-sm">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // The one genuinely interactive moment on the page deserves to land
          // rather than snap. Reuses the existing disclosure language rather
          // than inventing a new one.
          <div className="animate-fade-up mt-8 rounded-2xl border border-ember-500/30 bg-ember-500/5 p-6">
            <p className="display text-sm uppercase tracking-widest text-ember-400">{f.recommendEyebrow}</p>
            <h3 className="mt-1 display text-3xl font-bold">{track.name}</h3>
            <p className="mt-2 text-cream/80">{track.tagline}</p>
            {recommendedBatch && branch ? (
              <div className="mt-5 rounded-xl border border-cream/10 bg-ink-950/40 p-4">
                <p className="text-cream/60 text-xs uppercase tracking-widest">{f.nextBatchLabel}</p>
                <p className="mt-1 text-cream font-semibold">
                  {recommendedBatch.level} · {branch.name} · {recommendedBatch.daysOfWeek.join('–')}{' '}
                  {recommendedBatch.time}
                </p>
                <p className="text-cream/70 text-sm">
                  {(recommendedBatch.startDate < today ? f.startedTemplate : f.startsTemplate)
                    .replace('{date}', formatBatchDate(recommendedBatch.startDate))
                    .replace('{price}', formatInr(recommendedBatch.priceInr))}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-cream/70">
                {label(content.labels, 'emptyNoFinderBatch').replace('{track}', track.name)}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                instagramHandle={content.site.instagramHandle}
                ctx={{
                  source: 'style_finder',
                  style: { slug: track.ctaSlug, name: track.name },
                  branch: branch ? { slug: branch.slug, name: branch.name } : undefined,
                  styleFinderRecommendation: {
                    styleName: track.name,
                    level: 'Foundation',
                    branchName: branch?.name,
                  },
                }}
                variant="primary"
                labels={content.labels}
                templates={content.site.whatsappTemplates}
              />
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                instagramHandle={content.site.instagramHandle}
                ctx={{
                  source: 'style_finder',
                  style: { slug: track.ctaSlug, name: track.name },
                  styleFinderRecommendation: {
                    styleName: track.name,
                    level: 'Foundation',
                    branchName: branch?.name,
                  },
                }}
                channel="instagram"
                variant="secondary"
                labels={content.labels}
                templates={content.site.whatsappTemplates}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
