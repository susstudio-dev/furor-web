import Link from 'next/link';

const PAGES = [
  { href: '/admin/pages/home', label: 'Home', desc: '"What we teach", "How it works", closing CTA, "Visit us"' },
  { href: '/admin/pages/about', label: 'About', desc: 'Headline, intro paragraphs, gallery, stats, timeline, more' },
  { href: '/admin/pages/faqs', label: 'FAQs', desc: 'Page intro, sections + questions, closing CTA' },
  { href: '/admin/pages/contact', label: 'Contact', desc: 'Page intro, the 3 channel tiles, closing CTA' },
  { href: '/admin/pages/instructors', label: 'Instructors page', desc: 'Page intro, testimonials header, closing CTA' },
  { href: '/admin/pages/dance-styles', label: 'Dance Styles index', desc: 'Headline at top of /dance-styles' },
  { href: '/admin/pages/batches', label: 'Batches index', desc: 'Headline at top of /batches' },
  { href: '/admin/pages/stories', label: 'Stories (Blog) index', desc: 'Headline at top of /stories' },
];

export default function PagesIndex() {
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Pages</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Page copy</h1>
      <p className="mt-2 text-cream/70 max-w-2xl">
        Edit the headlines, intro paragraphs, and section copy that appears on each public page.
        Anything else (style images, instructor bios, batches, etc.) lives in its own section in the sidebar.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 hover:border-ember-500/40 hover:bg-ember-500/5 transition"
          >
            <p className="display text-lg font-bold">{p.label}</p>
            <p className="mt-1 text-cream/60 text-sm">{p.desc}</p>
            <p className="mt-3 text-ember-400 text-sm">Edit →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
