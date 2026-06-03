import Link from 'next/link';
import { getContent } from '@/lib/content';
import { LegalPageEditor } from '@/components/admin/LegalPageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Terms
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Terms &amp; Services</h1>
      <p className="mt-2 text-cream/70">
        Edit headline, last-updated date and the section list on the public <code>/terms</code> page.
      </p>
      <LegalPageEditor initial={c} pageKey="terms" />
    </div>
  );
}
