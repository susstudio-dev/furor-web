import { getContent, formatBatchDate, formatInr, visibleBatches } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';

export const metadata = { title: 'Batches & Pricing' };

interface SearchParams {
  style?: string;
  branch?: string;
  level?: string;
  sort?: 'asc' | 'desc';
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const content = await getContent();
  let rows = visibleBatches(content);
  if (sp.style) rows = rows.filter((b) => b.styleSlug === sp.style);
  if (sp.branch) rows = rows.filter((b) => b.branchSlug === sp.branch);
  if (sp.level) rows = rows.filter((b) => b.level.toLowerCase() === sp.level!.toLowerCase());
  if (sp.sort === 'desc') rows = rows.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));

  const styles = content.danceStyles.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const studios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const levels = ['Foundation', 'Intermediate', 'Advanced'];

  const courseLd = rows.map((b) => {
    const style = content.danceStyles.find((s) => s.slug === b.styleSlug);
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: `${style?.name ?? b.styleSlug} ${b.level}`,
      description: style?.description ?? '',
      provider: { '@type': 'Organization', name: content.site.title, url: 'https://www.dancehyderabad.com' },
      startDate: b.startDate,
      offers: { '@type': 'Offer', price: b.priceInr, priceCurrency: 'INR' },
    };
  });

  return (
    <>
      <section className="container-x pt-20 pb-8">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Batches & Pricing</p>
        <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          What&apos;s open. What it costs. Real seats, real dates.
        </h1>
        <p className="mt-4 text-cream/70 max-w-2xl">
          No forms. Pick a batch, tap WhatsApp, and we&apos;ll confirm in minutes.
        </p>
      </section>

      <section className="container-x">
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All styles" href={buildHref(sp, { style: undefined })} active={!sp.style} />
          {styles.map((s) => (
            <FilterPill key={s.slug} label={s.name} href={buildHref(sp, { style: s.slug })} active={sp.style === s.slug} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterPill label="All studios" href={buildHref(sp, { branch: undefined })} active={!sp.branch} />
          {studios.map((s) => (
            <FilterPill key={s.slug} label={s.name} href={buildHref(sp, { branch: s.slug })} active={sp.branch === s.slug} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterPill label="All levels" href={buildHref(sp, { level: undefined })} active={!sp.level} />
          {levels.map((l) => (
            <FilterPill key={l} label={l} href={buildHref(sp, { level: l })} active={sp.level === l} />
          ))}
        </div>
      </section>

      <section className="container-x py-12">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-8">
            <p className="text-cream/80">
              No batches match these filters yet. Chat with us about future batches in this combination.
            </p>
            <div className="mt-4">
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                ctx={{ source: 'primary' }}
                variant="primary"
                label="Chat on WhatsApp"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((b) => {
              const style = content.danceStyles.find((s) => s.slug === b.styleSlug)!;
              const branch = content.studios.find((s) => s.slug === b.branchSlug)!;
              return (
                <div key={b.id} className="grid gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-3">
                    <p className="display text-xl font-bold">{style.name}</p>
                    <p className="text-cream/60 text-sm">{b.level}</p>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="text-cream">{branch.name}</p>
                    <p className="text-cream/60 text-sm">{branch.neighborhood}</p>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                    <p className="text-cream/60 text-sm">starts {formatBatchDate(b.startDate)}</p>
                  </div>
                  <div className="lg:col-span-1">
                    <p className="text-cream font-semibold">{formatInr(b.priceInr)}</p>
                    {typeof b.seatsLeft === 'number' ? <p className="text-cream/60 text-xs">{b.seatsLeft} seats</p> : null}
                  </div>
                  <div className="lg:col-span-2 flex flex-wrap gap-2 justify-start lg:justify-end">
                    {b.status === 'Filling Fast' ? <span className="pill bg-gold-500/15 text-gold-400">Filling fast</span> : null}
                    <EnquiryCTA
                      whatsappNumber={content.site.whatsappNumber}
                      ctx={{
                        source: 'batch_row',
                        style: { slug: style.slug, name: style.name },
                        branch: { slug: branch.slug, name: branch.name },
                        batch: b,
                      }}
                      variant="batch-row"
                      label="Enquire"
                    />
                    {b.razorpayLink ? (
                      <a className="btn-ghost text-xs" href={b.razorpayLink} target="_blank" rel="noopener noreferrer">Pre-register</a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {courseLd.map((d, i) => <JsonLd key={i} data={d} />)}
    </>
  );
}

function buildHref(current: SearchParams, patch: Partial<SearchParams>): string {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams();
  if (next.style) qs.set('style', next.style);
  if (next.branch) qs.set('branch', next.branch);
  if (next.level) qs.set('level', next.level);
  if (next.sort) qs.set('sort', next.sort);
  const s = qs.toString();
  return s ? `/batches?${s}` : '/batches';
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`pill ${
        active ? 'bg-ember-500 text-ink-950' : 'bg-cream/5 text-cream/70 hover:bg-cream/10'
      }`}
    >
      {label}
    </Link>
  );
}
