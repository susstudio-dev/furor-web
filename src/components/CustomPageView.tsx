import { Accentuate } from './Accentuate';
import type { CustomPage, CustomBlock } from '@/lib/content-schema';

// Public renderer for admin-built pages at /p/<slug>. An intro header followed
// by an ordered list of content blocks (heading / text / image / button). For
// pages created before blocks existed, falls back to the legacy text sections.
export function CustomPageView({ page }: { page: CustomPage }) {
  const { intro, blocks, sections } = page;
  const hasBlocks = blocks.length > 0;

  return (
    <article className="container-x pt-20 pb-24 max-w-3xl">
      {intro.eyebrow ? (
        <p className="display text-sm uppercase tracking-widest text-ember-400">{intro.eyebrow}</p>
      ) : null}
      {intro.headline ? (
        <h1 className="mt-3 display text-4xl font-extrabold sm:text-5xl tracking-tight">
          <Accentuate text={intro.headline} />
        </h1>
      ) : null}
      {intro.lead ? (
        <p className="mt-6 text-lg text-cream/80 leading-relaxed">{intro.lead}</p>
      ) : null}

      {hasBlocks ? (
        <div className="mt-10 space-y-6 text-cream/80 leading-relaxed">
          {blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
      ) : sections.length > 0 ? (
        <div className="mt-10 space-y-6 text-cream/80 leading-relaxed">
          {sections.map((s, i) =>
            s.heading || s.body ? (
              <section key={i}>
                {s.heading ? (
                  <h2 className="display text-xl font-semibold text-cream">{s.heading}</h2>
                ) : null}
                {s.body ? <p className="mt-2 whitespace-pre-line">{s.body}</p> : null}
              </section>
            ) : null,
          )}
        </div>
      ) : null}
    </article>
  );
}

function BlockView({ block }: { block: CustomBlock }) {
  switch (block.type) {
    case 'heading':
      return block.text ? (
        <h2 className="display text-2xl font-semibold text-cream pt-2">
          <Accentuate text={block.text} />
        </h2>
      ) : null;

    case 'text':
      return block.body ? <p className="whitespace-pre-line">{block.body}</p> : null;

    case 'image':
      return block.url ? (
        <figure className="my-2">
          {/* Plain img: custom pages allow arbitrary admin-pasted/uploaded URLs,
              which next/image would reject unless every host is allow-listed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            loading="lazy"
            className="w-full rounded-2xl border border-cream/10"
          />
          {block.caption ? (
            <figcaption className="mt-2 text-sm text-cream/55">{block.caption}</figcaption>
          ) : null}
        </figure>
      ) : null;

    case 'button':
      return block.label && block.href ? (
        <div>
          <a
            href={block.href}
            className={`${block.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} magnetic inline-flex`}
            {...(/^https?:\/\//.test(block.href)
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {block.label}
          </a>
        </div>
      ) : null;

    default:
      return null;
  }
}
