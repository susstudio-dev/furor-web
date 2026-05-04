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
        <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          Sixteen years. Five cities. One love letter to dance.
        </h1>
      </section>

      <section className="container-x py-8 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-cream/80 text-lg leading-relaxed">
            Furor began in 2009 in Bangalore with a single Salsa class. Today we&apos;re India&apos;s largest Latin
            dance school — across Bangalore, Hyderabad, Pune, Ahmedabad and Gurgaon — but we&apos;ve never lost
            the thing that started it: a room, a song, two people learning to listen.
          </p>
          <p className="mt-4 text-cream/80 text-lg leading-relaxed">
            In Hyderabad we run two studios — Jubilee Hills and Kondapur — and a weekly Latin social, La Rumba,
            where students stop being students and start being dancers.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => {
            const allPhotos = content.studios.flatMap((s) => s.photos);
            const src = allPhotos[i];
            return (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                <Img src={src} alt="" seed={`about-${i}`} variant={(i % 4) as 0 | 1 | 2 | 3} fill sizes="33vw" className="object-cover" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="container-x py-16">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Instructors</p>
        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">The people you&apos;ll dance with.</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {content.instructors.map((i, idx) => (
            <div key={i.id} className="rounded-3xl overflow-hidden border border-cream/10 bg-ink-900/40">
              <div className="relative aspect-[4/5]">
                <Img src={i.photo} alt={i.name} seed={`instructor-${i.id}`} label={i.name} variant={(idx % 4) as 0 | 1 | 2 | 3} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="p-5">
                <p className="display text-2xl font-bold">{i.name}</p>
                <p className="text-ember-400 text-sm">{i.role}</p>
                <p className="mt-3 text-cream/80 text-sm leading-relaxed">{i.shortBio}</p>
              </div>
            </div>
          ))}
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
