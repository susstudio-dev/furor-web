import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { formatInr } from '@/lib/format';
import { Img } from './Img';
import { Reveal } from './Reveal';
import { RhythmSignature } from './RhythmSignature';
import { EnquiryCTA } from './EnquiryCTA';

// The social rendered as evidence: real photos, a real student's words, the
// live weekly count — and the zero-fear door ("come watch on Saturday")
// beside the quiet paid one. Server-rendered; the only client child is the
// EnquiryCTA already bundled on every route. Renders nothing when the social
// is disabled in the admin — same gate as the TonightFloat chip.
export function RumbaBand({
  content,
  trialFrom,
}: {
  content: SiteContent;
  trialFrom: number | null;
}) {
  const t = content.tonight;
  if (!t.enabled || !t.headline || !t.when) return null;
  const r = content.pages.home.rumba;
  const proof =
    content.testimonials.find((x) => x.id === r.testimonialId) ?? content.testimonials[0] ?? null;
  const students = content.site.stats.studentsThisWeek;

  return (
    <section className="container-x py-12 sm:py-16">
      <Reveal>
        <div className="flex items-center gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">{r.eyebrow}</p>
          <RhythmSignature style="bachata" loop width={84} className="text-ember-500/70" />
        </div>
        <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">{r.headline}</h2>
        <p className="mt-3 max-w-2xl text-cream/70">{r.body}</p>
        <p className="mt-2 text-sm font-semibold text-ember-400">
          {t.headline} · {t.when}
          {t.venueName ? ` · ${t.venueName}` : ''}
        </p>
      </Reveal>
      {r.photos.length > 0 ? (
        <Reveal stagger className="mt-8 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
          {r.photos.slice(0, 3).map((p, i) => (
            <div
              key={`${p.src}-${i}`}
              className={`relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${
                i === 0 ? 'col-span-2 md:col-span-1' : ''
              }`}
            >
              <Img
                src={p.src}
                alt={p.alt}
                seed={`rumba-${i}`}
                fill
                className="object-cover transition duration-700 hover:scale-[1.04]"
              />
            </div>
          ))}
        </Reveal>
      ) : null}
      {proof || (typeof students === 'number' && students > 0 && r.statTemplate) ? (
        <Reveal className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          {proof ? (
            <figure className="max-w-xl">
              <blockquote className="italic text-cream/85">&ldquo;{proof.text}&rdquo;</blockquote>
              <figcaption className="mt-1 text-xs text-cream/55">— {proof.studentName}</figcaption>
            </figure>
          ) : null}
          {typeof students === 'number' && students > 0 && r.statTemplate ? (
            <p className="display text-sm font-semibold uppercase tracking-widest text-gold-400">
              {r.statTemplate.replace('{n}', String(students))}
            </p>
          ) : null}
        </Reveal>
      ) : null}
      <Reveal className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <EnquiryCTA
          whatsappNumber={content.site.whatsappNumber}
          ctx={{ source: 'rumba_band', customNote: t.ctaContext }}
          variant="primary"
          labels={content.labels}
          templates={content.site.whatsappTemplates}
          label={r.rsvpLabel}
        />
        <Link
          href="#start-this-week"
          className="inline-flex min-h-[44px] items-center py-2 text-sm text-cream/75 underline decoration-cream/30 underline-offset-4 transition hover:text-cream"
        >
          {r.classLink}
          {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
        </Link>
      </Reveal>
    </section>
  );
}
