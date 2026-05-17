import Link from 'next/link';
import { getContent } from '@/lib/content';
import { ContactPageEditor } from './ContactPageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Contact
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Contact page</h1>
      <p className="mt-2 text-cream/70">
        Edit the headline, the three channel tiles, and the closing CTA on <code>/contact</code>.
      </p>
      <ContactPageEditor initial={c} />
    </div>
  );
}
