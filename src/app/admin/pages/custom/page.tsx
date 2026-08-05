import Link from 'next/link';
import { getContent } from '@/lib/content';
import { CustomPagesEditor } from '@/components/admin/CustomPagesEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('customPages');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Custom pages
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Custom pages</h1>
      <p className="mt-2 text-cream/70">
        Build your own landing/info pages. Each one lives at{' '}
        <code>/p/&lt;slug&gt;</code> and can be linked from the footer.
      </p>
      <CustomPagesEditor initial={c} />
    </div>
  );
}
