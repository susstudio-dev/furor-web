import Link from 'next/link';
import { getContent } from '@/lib/content';
import { FaqsPageEditor } from './FaqsPageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · FAQs
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">FAQs page</h1>
      <p className="mt-2 text-cream/70">
        The grouped questions and answers on <code>/faqs</code>. These are the general site FAQs; per-style FAQs live inside each dance style.
      </p>
      <FaqsPageEditor initial={c} />
    </div>
  );
}
