import Link from 'next/link';
import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';

export const metadata = { title: 'About' };

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
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-2">
            {a.moments.photos.map((p, i) => {
              const span =
                i === 0
                  ? 'md:col-span-2 md:row-span-2 aspect-square md:aspect-auto'
                  : i > 4
                    ? 'aspect-square hidden md:block'
                    : 'aspect-square';
              return (
                <div
                  key={`${p.src}-${i}`}
                  className={`group relative overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${span}`}
                >
                  <Img
                    src={p.src}
                    alt={p.alt}
                    seed={p.src}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />
                </div>
              );
            })}
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
