import Link from 'next/link';
import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';

export const metadata = { title: 'About' };

export default async function AboutPage() {
  const content = await getContent();
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
        <p className="display text-sm uppercase tracking-widest text-ember-400">About</p>
        <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          Sixteen years. Five cities. One love letter to dance.
        </h1>
        <div className="mt-8 max-w-3xl space-y-5">
          <p className="text-cream/80 text-lg leading-relaxed">
            Furor began in 2009 in Bangalore with a single Salsa class. Today we&apos;re India&apos;s largest Latin
            dance school — across Bangalore, Hyderabad, Pune, Ahmedabad and Gurgaon — but we&apos;ve never lost
            the thing that started it: a room, a song, two people learning to listen.
          </p>
          <p className="text-cream/80 text-lg leading-relaxed">
            In Hyderabad our home is the Jubilee Hills studio, and our weekly Latin social — La Rumba —
            is where students stop being students and start being dancers.
          </p>
        </div>
      </section>

      {/* Moments — gallery */}
      <section className="container-x py-12">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="display text-sm uppercase tracking-widest text-ember-400">Moments</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
              Inside the studio. Inside the social.
            </h2>
          </div>
          <p className="max-w-sm text-cream/70">
            A few frames from our nights at La Rumba and afternoons in class.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-2">
          {[
            { src: '/photos/DSC09730.jpg', alt: 'Furor social night', span: 'md:col-span-2 md:row-span-2 aspect-square md:aspect-auto' },
            { src: '/photos/DSC_0052.jpg', alt: 'Salsa class in motion', span: 'aspect-square' },
            { src: '/photos/DSC_0095.jpg', alt: 'Bachata partner work', span: 'aspect-square' },
            { src: '/photos/DSC09736.jpg', alt: 'West Coast Swing flow', span: 'aspect-square' },
            { src: '/photos/DSC09698.jpg', alt: 'Studio floor before class', span: 'aspect-square' },
            { src: '/photos/DSC_0166.jpg', alt: 'Jubilee Hills studio', span: 'aspect-square hidden md:block' },
            { src: '/photos/DSC_9973.jpg', alt: 'Students at La Rumba', span: 'aspect-square hidden md:block' },
            { src: '/photos/DSC09776.jpg', alt: 'Dancers on the floor', span: 'aspect-square hidden md:block' },
          ].map((p) => (
            <div
              key={p.src}
              className={`group relative overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${p.span}`}
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
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section className="container-x py-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { k: '16+', v: 'Years of dancing' },
            { k: '5', v: 'Cities in India' },
            { k: '10,000+', v: 'Students trained' },
            { k: '1', v: 'Hyderabad home — Jubilee Hills' },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
              <p className="display text-3xl sm:text-4xl font-extrabold text-ember-400">{s.k}</p>
              <p className="mt-2 text-sm text-cream/70">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline / Our journey */}
      <section className="container-x py-16">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Our journey</p>
        <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
          From one Salsa class in Bangalore to five cities.
        </h2>
        <ol className="mt-12 relative border-l border-cream/15 ml-3 space-y-10">
          {[
            { year: '2009', title: 'Furor begins in Bangalore', body: 'Founded by Creative Director Alex Diaz with one mission: transform India’s Salsa scene.' },
            { year: '2010', title: 'Hyderabad opens', body: 'Rishikesh Chhabra brings Furor to Hyderabad — regular classes and Saturday socials from day one.' },
            { year: '2013', title: 'Ahmedabad joins in', body: 'Jayvir Mehta starts Furor Ahmedabad, building the Latin scene from scratch.' },
            { year: '2016', title: 'Pune officially launches', body: 'After three years as enMotion Pune, the city joins the Furor family under Yatin Ranade and Supreme Kaur Bhamra.' },
            { year: '2020', title: 'Online classes go live', body: 'The pandemic pushes us online — hybrid teaching becomes part of how we work.' },
            { year: '2024', title: 'Gurgaon — city number five', body: 'Furor opens its fifth city under Pummy Kumari, cementing its place as India’s largest Latin dance academy.' },
          ].map((m) => (
            <li key={m.year} className="pl-6">
              <span className="absolute -left-[7px] mt-2 h-3 w-3 rounded-full bg-ember-500 ring-4 ring-ink-950" />
              <p className="display text-sm uppercase tracking-widest text-ember-400">{m.year}</p>
              <p className="mt-1 display text-xl font-bold">{m.title}</p>
              <p className="mt-1 text-cream/70 max-w-2xl">{m.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* What we bring */}
      <section className="container-x py-16">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Beyond the classroom</p>
        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">
          A studio, a stage and a worldwide community.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { title: 'Corporate & events', body: 'We design dance experiences for companies, product launches and private events — from one-hour workshops to season-long programs.' },
            { title: 'Performance team', body: 'Our students and instructors have represented India at Salsa congresses around the world.' },
            { title: 'International artists', body: 'We host visiting choreographers and dancers from around the world for workshops in Hyderabad each year.' },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-cream/10 bg-ink-900/30 p-6">
              <p className="display text-xl font-semibold">{c.title}</p>
              <p className="mt-2 text-cream/70">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="display text-sm uppercase tracking-widest text-ember-400">The team</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-xl">
              Meet the people you&apos;ll dance with.
            </h2>
          </div>
          <Link href="/instructors" className="btn-secondary">See instructors</Link>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-10">
          <h2 className="display text-3xl font-bold">Want to come dance?</h2>
          <p className="mt-2 text-cream/70 max-w-xl">We&apos;re one tap away. WhatsApp is fastest.</p>
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

      {personLd.map((d, i) => <JsonLd key={i} data={d} />)}
    </>
  );
}
