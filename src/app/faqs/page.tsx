import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';

export const metadata = { title: 'FAQs' };

export default async function FaqsPage() {
  const content = await getContent();
  const f = content.pages.faqs;
  const all = f.sections.flatMap((s) => s.items);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      <JsonLd data={ld} />
      <section className="container-x pt-20 pb-12">
        {f.intro.eyebrow ? (
          <p className="display text-sm uppercase tracking-widest text-ember-400">{f.intro.eyebrow}</p>
        ) : null}
        {f.intro.headline ? (
          <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            {f.intro.headline}
          </h1>
        ) : null}
        {f.intro.lead ? (
          <p className="mt-6 max-w-2xl text-cream/75 text-lg">{f.intro.lead}</p>
        ) : null}
      </section>

      <section className="container-x pb-16 space-y-12">
        {f.sections.map((section, si) => (
          <div key={si}>
            <p className="display text-sm uppercase tracking-widest text-ember-400/90">{section.section}</p>
            <div className="mt-4 grid gap-3">
              {section.items.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-cream/10 bg-ink-900/40 p-5 hover:border-ember-400/30 transition-colors"
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 marker:hidden">
                    <span className="display text-lg font-semibold text-cream">{item.q}</span>
                    <span aria-hidden className="text-ember-400 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                  </summary>
                  <p className="mt-3 text-cream/80 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      {f.closingCta.headline ? (
        <section className="container-x py-16">
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-10">
            <h2 className="display text-3xl font-bold">{f.closingCta.headline}</h2>
            {f.closingCta.body ? (
              <p className="mt-2 text-cream/70 max-w-xl">{f.closingCta.body}</p>
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
    </>
  );
}
