import Link from 'next/link';
import { getContent, visibleBatches } from '@/lib/content';

export default async function AdminDashboard() {
  const c = await getContent();
  const stats = [
    { label: 'Dance styles', value: c.danceStyles.length, href: '/admin/styles' },
    { label: 'Studios', value: c.studios.length, href: '/admin/studios' },
    { label: 'Open batches', value: visibleBatches(c).length, href: '/admin/batches' },
    { label: 'Instructors', value: c.instructors.length, href: '/admin/instructors' },
    { label: 'Testimonials', value: c.testimonials.length, href: '/admin/testimonials' },
    { label: 'Stories', value: c.stories.length, href: '/admin/stories' },
  ];
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Dashboard</p>
      <h1 className="mt-1 display text-3xl sm:text-4xl font-extrabold">What would you like to update?</h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 hover:border-ember-500/40 hover:bg-ember-500/5 transition"
          >
            <p className="text-cream/60 text-sm">{s.label}</p>
            <p className="display text-3xl font-bold mt-1">{s.value}</p>
            <p className="mt-3 text-ember-400 text-sm">Manage →</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/site" className="btn-secondary">Site & socials</Link>
        <Link href="/admin/hero" className="btn-secondary">Hero</Link>
        <Link href="/admin/json" className="btn-secondary">Raw JSON editor</Link>
      </div>

      <div className="mt-10 rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
        <p className="display text-sm uppercase tracking-widest text-cream/60">Pro tip</p>
        <p className="mt-2 text-cream/85">
          All content is stored as a single JSON file. Use any per-section editor for friendly editing,
          or the <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link> editor for power-user changes.
          Every save is versioned — you can roll back from <Link href="/admin/versions" className="text-ember-400 hover:text-ember-300">Versions</Link>.
        </p>
      </div>
    </div>
  );
}
