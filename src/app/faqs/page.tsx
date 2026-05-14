import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';

export const metadata = { title: 'FAQs' };

type Faq = { q: string; a: string };

const GENERAL_FAQS: { section: string; items: Faq[] }[] = [
  {
    section: 'Getting started',
    items: [
      {
        q: 'I have never danced before. Can I still join?',
        a: 'Yes. Most of our students walk in having never partner-danced before. Our Foundation track is built for absolute beginners — we teach you the basic step, the connection, and the social etiquette from scratch.',
      },
      {
        q: 'Do I need a partner to join?',
        a: 'No. We rotate partners in class — it is the fastest way to learn and also how social dancing works. You will dance with leaders and followers of every level.',
      },
      {
        q: 'What should I wear to class?',
        a: 'Anything comfortable that lets you move. Smooth-soled shoes help (you turn easier) but they are not required for your first class. Avoid sticky rubber soles if you can.',
      },
      {
        q: 'How fit do I need to be?',
        a: 'You do not need to be particularly fit. We teach dancers from age 16 to 70+. Our oldest beginner started at 64.',
      },
    ],
  },
  {
    section: 'Classes and batches',
    items: [
      {
        q: 'How long is a batch?',
        a: 'Foundation batches run for 2 months — typically 20 hours total, with weekend or weekday sessions. Intermediate and Advanced courses follow the same rhythm.',
      },
      {
        q: 'What does it cost?',
        a: 'Foundation Salsa and Bachata are ₹6,500 for the full 2-month batch. Intermediate courses are ₹7,500. Pricing is per person, not per couple.',
      },
      {
        q: 'What if I miss a class?',
        a: 'We have a flexible make-up policy — message us on WhatsApp and we will find you a session in another batch of the same level.',
      },
      {
        q: 'Where are batches held?',
        a: 'All Furor Hyderabad batches are at our Jubilee Hills studio — 2nd Floor, Alcazar Mall, Road No. 36, Jubilee Hills, Hyderabad 500033.',
      },
    ],
  },
  {
    section: 'About Furor',
    items: [
      {
        q: 'How long has Furor been around?',
        a: 'Furor was founded in 2009 in Bangalore by Alex Diaz, and opened in Hyderabad in 2010 under Rishikesh Chhabra. Today we are India\'s largest Latin dance school across Bangalore, Hyderabad, Pune, Ahmedabad and Gurgaon.',
      },
      {
        q: 'What is La Rumba?',
        a: 'La Rumba is our weekly Latin social — Hyderabad\'s longest-running Salsa and Bachata night. Free for current students, ₹300 for guests. It is where students stop being students and start being dancers.',
      },
      {
        q: 'Do you do corporate workshops or events?',
        a: 'Yes. We design dance experiences for corporates, product launches and private events — one-hour workshops up to multi-week programs. WhatsApp us for a custom quote.',
      },
      {
        q: 'How do I reach you?',
        a: 'WhatsApp is fastest: +91 88860 72572. You can also email furorhyd@dancehyderabad.com or DM @furorhyd on Instagram.',
      },
    ],
  },
];

export default async function FaqsPage() {
  const content = await getContent();
  const all = GENERAL_FAQS.flatMap((s) => s.items);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={ld} />
      <section className="container-x pt-20 pb-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">FAQs</p>
        <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          The questions we hear most.
        </h1>
        <p className="mt-6 max-w-2xl text-cream/75 text-lg">
          Anything missing? WhatsApp us and we&apos;ll answer in minutes.
        </p>
      </section>

      <section className="container-x pb-16 space-y-12">
        {GENERAL_FAQS.map((section) => (
          <div key={section.section}>
            <p className="display text-sm uppercase tracking-widest text-ember-400/90">{section.section}</p>
            <div className="mt-4 grid gap-3">
              {section.items.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-cream/10 bg-ink-900/40 p-5 hover:border-ember-400/30 transition-colors"
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 marker:hidden">
                    <span className="display text-lg font-semibold text-cream">{f.q}</span>
                    <span aria-hidden className="text-ember-400 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                  </summary>
                  <p className="mt-3 text-cream/80 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="container-x py-16">
        <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-10">
          <h2 className="display text-3xl font-bold">Still have questions?</h2>
          <p className="mt-2 text-cream/70 max-w-xl">
            WhatsApp is the fastest way to reach us — we answer in minutes.
          </p>
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
    </>
  );
}
