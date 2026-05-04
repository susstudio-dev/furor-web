'use client';

import { useMemo, useState } from 'react';
import type { Batch, DanceStyle, SiteContent, Studio } from '@/lib/content-schema';
import { batchesForStyle } from '@/lib/content-helpers';
import { formatBatchDate, formatInr } from '@/lib/format';
import { EnquiryCTA } from './EnquiryCTA';

type FeelAnswer = 'Confident' | 'Connected' | 'Free';
type PartnerAnswer = 'Solo' | 'With a partner' | 'Either';
type WhenAnswer = 'Weekday evenings' | 'Weekends' | 'Either';

const Q1: { key: FeelAnswer; copy: string }[] = [
  { key: 'Confident', copy: 'Confident' },
  { key: 'Connected', copy: 'Connected' },
  { key: 'Free', copy: 'Free' },
];
const Q2: { key: PartnerAnswer; copy: string }[] = [
  { key: 'Solo', copy: 'Solo' },
  { key: 'With a partner', copy: 'With a partner' },
  { key: 'Either', copy: 'Either' },
];
const Q3: { key: WhenAnswer; copy: string }[] = [
  { key: 'Weekday evenings', copy: 'Weekday evenings' },
  { key: 'Weekends', copy: 'Weekends' },
  { key: 'Either', copy: 'Either' },
];

function recommend(a1: FeelAnswer, a2: PartnerAnswer, _a3: WhenAnswer): string {
  // Deterministic mapping
  if (a1 === 'Confident') return 'salsa';
  if (a1 === 'Connected') return 'bachata';
  if (a1 === 'Free') return 'west-coast-swing';
  if (a2 === 'Solo') return 'salsa';
  return 'salsa';
}

export function StyleFinder({ content }: { content: SiteContent }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [a1, setA1] = useState<FeelAnswer | null>(null);
  const [a2, setA2] = useState<PartnerAnswer | null>(null);
  const [a3, setA3] = useState<WhenAnswer | null>(null);

  const recommendedSlug = useMemo(() => {
    if (step !== 3 || !a1 || !a2 || !a3) return null;
    return recommend(a1, a2, a3);
  }, [a1, a2, a3, step]);

  const recommendedStyle: DanceStyle | undefined = useMemo(
    () => content.danceStyles.find((s) => s.slug === recommendedSlug),
    [content.danceStyles, recommendedSlug],
  );
  const matchingBatches = useMemo(() => {
    if (!recommendedStyle || !a3) return [];
    let bs = batchesForStyle(content, recommendedStyle.slug);
    if (a3 === 'Weekday evenings') {
      bs = bs.filter((b) => b.daysOfWeek.some((d) => d !== 'Sat' && d !== 'Sun'));
    } else if (a3 === 'Weekends') {
      bs = bs.filter((b) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun'));
    }
    return bs.slice(0, 1);
  }, [content, recommendedStyle, a3]);

  const recommendedBatch: Batch | undefined = matchingBatches[0];
  const branch: Studio | undefined = recommendedBatch
    ? content.studios.find((s) => s.slug === recommendedBatch.branchSlug)
    : undefined;

  const reset = () => {
    setStep(0);
    setA1(null);
    setA2(null);
    setA3(null);
  };

  return (
    <section className="container-x py-24 sm:py-28">
      <div className="rounded-3xl border border-cream/10 bg-ink-900/60 p-6 sm:p-10 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Style Finder</p>
          {step > 0 ? (
            <button onClick={reset} className="btn-ghost text-xs">
              Reset
            </button>
          ) : null}
        </div>
        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">
          Three taps. One dance.
        </h2>
        <p className="mt-2 text-cream/70 max-w-xl">
          Not sure where to start? Answer three questions and we&apos;ll suggest a style and the next batch that fits.
        </p>
        {step === 0 ? (
          <div className="mt-8 grid gap-4">
            <p className="display text-xl">How do you want to feel?</p>
            <Choices
              options={Q1}
              onPick={(v) => {
                setA1(v);
                setStep(1);
              }}
            />
          </div>
        ) : null}
        {step === 1 ? (
          <div className="mt-8 grid gap-4">
            <p className="display text-xl">Solo or with a partner?</p>
            <Choices
              options={Q2}
              onPick={(v) => {
                setA2(v);
                setStep(2);
              }}
            />
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-8 grid gap-4">
            <p className="display text-xl">Weekday or weekend?</p>
            <Choices
              options={Q3}
              onPick={(v) => {
                setA3(v);
                setStep(3);
              }}
            />
          </div>
        ) : null}
        {step === 3 && recommendedStyle ? (
          <div className="mt-8 rounded-2xl border border-ember-500/30 bg-ember-500/5 p-6">
            <p className="display text-sm uppercase tracking-widest text-ember-400">We recommend</p>
            <h3 className="mt-1 display text-3xl font-bold">{recommendedStyle.name}</h3>
            <p className="mt-2 text-cream/80">{recommendedStyle.tagline}</p>
            {recommendedBatch && branch ? (
              <div className="mt-5 rounded-xl border border-cream/10 bg-ink-950/40 p-4">
                <p className="text-cream/60 text-xs uppercase tracking-widest">Next batch that fits you</p>
                <p className="mt-1 text-cream font-semibold">
                  {recommendedBatch.level} · {branch.name} · {recommendedBatch.daysOfWeek.join('–')} {recommendedBatch.time}
                </p>
                <p className="text-cream/70 text-sm">
                  Starts {formatBatchDate(recommendedBatch.startDate)} · {formatInr(recommendedBatch.priceInr)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-cream/70">
                No upcoming batches yet — chat with us to be notified when the next {recommendedStyle.name} batch starts.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                instagramHandle={content.site.instagramHandle}
                ctx={{
                  source: 'style_finder',
                  style: { slug: recommendedStyle.slug, name: recommendedStyle.name },
                  branch: branch ? { slug: branch.slug, name: branch.name } : undefined,
                  styleFinderRecommendation: {
                    styleName: recommendedStyle.name,
                    level: recommendedBatch?.level ?? 'Foundation',
                    branchName: branch?.name,
                  },
                }}
                variant="primary"
                label="Chat on WhatsApp"
              />
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                instagramHandle={content.site.instagramHandle}
                ctx={{
                  source: 'style_finder',
                  style: { slug: recommendedStyle.slug, name: recommendedStyle.name },
                  styleFinderRecommendation: {
                    styleName: recommendedStyle.name,
                    level: recommendedBatch?.level ?? 'Foundation',
                    branchName: branch?.name,
                  },
                }}
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Choices<T extends string>({
  options,
  onPick,
}: {
  options: { key: T; copy: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          className="rounded-2xl border border-cream/15 bg-ink-950/40 px-5 py-6 text-left text-cream transition hover:border-ember-500/60 hover:bg-ember-500/5"
        >
          <span className="display text-lg font-semibold">{o.copy}</span>
        </button>
      ))}
    </div>
  );
}
