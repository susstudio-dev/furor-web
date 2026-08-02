import Link from 'next/link';
import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { PhotoCarousel } from '@/components/PhotoCarousel';

export async function generateMetadata() {
  const c = await getContent();
  return {
    title: 'About',
    description:
      c.pages.about.introParagraphs[0] ||
      'The story of Furor — Hyderabad’s home for Salsa, Bachata and West Coast Swing.',
    alternates: { canonical: '/about' },
  };
}

// Render per request so admin edits show immediately (export build strips this).
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const content = await getContent();
  const a = content.pages.about;
  const personLd = content.instructors.map((i) => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: i.name,
    jobTitle: i.role,
    description: i.shortBio,
    sameAs: i.social.instagram ? [i.social.instagram] : undefined,
  }));
  return (
    <>
      <section className="container-x pt-20 pb-12">
        {a.intro.eyebrow ? (
          <p className="display text-sm uppercase tracking-widest text-ember-400">{a.intro.eyebrow}</p>
        ) : null}
        {a.intro.headline ? (
          <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            {a.intro.headline}
          </h1>
        ) : null}
        {a.introParagraphs.length > 0 ? (
          <div className="mt-8 max-w-3xl space-y-5">
            {a.introParagraphs.map((p, i) => (
              <p key={i} className="text-cream/80 text-lg leading-relaxed">{p}</p>
            ))}
          </div>
        ) : null}
      </section>

      {a.moments.photos.length > 0 ? (
        <section className="container-x py-12">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              {a.moments.eyebrow ? (
                <p className="display text-sm uppercase tracking-widest text-ember-400">{a.moments.eyebrow}</p>
              ) : null}
              {a.moments.headline ? (
                <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">{a.moments.headline}</h2>
              ) : null}
            </div>
            {a.moments.lead ? (
              <p className="max-w-sm text-cream/70">{a.moments.lead}</p>
            ) : null}
          </div>
          <div className="mt-10">
            <PhotoCarousel photos={a.moments.photos} />
          </div>
        </section>
      ) : null}

      {a.stats.length > 0 ? (
        <section className="container-x py-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {a.stats.map((s, i) => (
              <div key={i} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
                <p className="display text-3xl sm:text-4xl font-extrabold text-ember-400">{s.k}</p>
                <p className="mt-2 text-sm text-cream/70">{s.v}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {a.timeline.milestones.length > 0 ? (
        <section className="container-x py-16">
          {a.timeline.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">{a.timeline.eyebrow}</p>
          ) : null}
          {a.timeline.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">{a.timeline.headline}</h2>
          ) : null}
          <ol className="mt-12 relative border-l border-cream/15 ml-3 space-y-10">
            {a.timeline.milestones.map((m, i) => (
              <li key={i} className="pl-6">
                <span className="absolute -left-[7px] mt-2 h-3 w-3 rounded-full bg-ember-500 ring-4 ring-ink-950" />
                <p className="display text-sm uppercase tracking-widest text-ember-400">{m.year}</p>
                <p className="mt-1 display text-xl font-bold">{m.title}</p>
                <p className="mt-1 text-cream/70 max-w-2xl">{m.body}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {a.beyond.cards.length > 0 ? (
        <section className="container-x py-16">
          {a.beyond.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">{a.beyond.eyebrow}</p>
          ) : null}
          {a.beyond.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">{a.beyond.headline}</h2>
          ) : null}
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {a.beyond.cards.map((c, i) => (
              <div key={i} className="rounded-2xl border border-cream/10 bg-ink-900/30 p-6">
                <p className="display text-xl font-semibold">{c.title}</p>
                <p className="mt-2 text-cream/70">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {a.teamTeaser.headline ? (
        <section className="container-x py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              {a.teamTeaser.eyebrow ? (
                <p className="display text-sm uppercase tracking-widest text-ember-400">{a.teamTeaser.eyebrow}</p>
              ) : null}
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-xl">{a.teamTeaser.headline}</h2>
            </div>
            <Link href="/instructors" className="btn-secondary">
              {a.teamTeaser.linkLabel || 'See instructors'}
            </Link>
          </div>
        </section>
      ) : null}

      {a.closingCta.headline ? (
        <section className="container-x py-16">
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-10">
            <h2 className="display text-3xl font-bold">{a.closingCta.headline}</h2>
            {a.closingCta.body ? (
              <p className="mt-2 text-cream/70 max-w-xl">{a.closingCta.body}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                ctx={{ source: 'primary' }}
                variant="primary"
                label="Chat on WhatsApp"
              />
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                instagramHandle={content.site.instagramHandle}
                ctx={{ source: 'primary' }}
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
              />
            </div>
          </div>
        </section>
      ) : null}

      {personLd.map((d, i) => <JsonLd key={i} data={d} />)}
    </>
  );
}
