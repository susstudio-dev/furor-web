import Link from 'next/link';
import { getContent } from '@/lib/content';
import { Img } from '@/components/Img';

export const metadata = { title: 'Studios' };

export default async function StudiosIndex() {
  const content = await getContent();
  const studios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <>
      <section className="container-x pt-20 pb-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Studios</p>
        <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          Pick your closer one. We&apos;ll see you there.
        </h1>
      </section>
      <section className="container-x pb-12">
        <div className="grid gap-6 md:grid-cols-2">
          {studios.map((s) => (
            <Link
              key={s.slug}
              href={`/studios/${s.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40"
            >
              <div className="relative aspect-[16/9]">
                <Img src={s.photos[0]} alt={s.name} seed={`studio-${s.slug}`} label={s.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="display text-3xl font-bold">{s.name}</p>
                <p className="mt-1 text-sm text-cream/70">{s.address}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
