import Link from 'next/link';
import { getContent } from '@/lib/content';
import { StyleFinder } from '@/components/StyleFinder';
import { Img } from '@/components/Img';
import { RhythmSignature } from '@/components/RhythmSignature';

export const metadata = { title: 'Dance Styles' };

export default async function StylesIndex() {
  const content = await getContent();
  const styles = content.danceStyles.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <>
      <section className="container-x pt-20 pb-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Dance Styles</p>
        <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          The dances we teach. The reasons people stay.
        </h1>
      </section>
      <section className="container-x pb-12">
        <div className="grid gap-6 md:grid-cols-3">
          {styles.map((s) => (
            <Link
              key={s.slug}
              href={`/dance-styles/${s.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40"
            >
              <div className="relative aspect-[4/5]">
                <Img
                  src={s.heroImage}
                  alt={s.name}
                  seed={`style-${s.slug}`}
                  label={s.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="flex items-center justify-between">
                  <p className="display text-3xl font-bold">{s.name}</p>
                  <RhythmSignature style={s.slug} width={120} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-1 text-sm text-cream/70">{s.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <StyleFinder content={content} />
    </>
  );
}
