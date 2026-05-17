import Link from 'next/link';
import { getContent } from '@/lib/content';
import { InstructorsPageEditor } from './InstructorsPageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Instructors page
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Instructors page</h1>
      <p className="mt-2 text-cream/70">
        Header, testimonials section header, and closing CTA on <code>/instructors</code>. The instructor profiles themselves live under <Link href="/admin/instructors" className="text-ember-400 hover:text-ember-300">Instructors</Link>.
      </p>
      <InstructorsPageEditor initial={c} />
    </div>
  );
}
