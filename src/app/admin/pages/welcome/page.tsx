import Link from 'next/link';
import { getContent } from '@/lib/content';
import { WelcomePageEditor } from '@/components/admin/WelcomePageEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('welcome');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Welcome (post-payment)
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Welcome pages</h1>
      <p className="mt-2 text-cream/70 max-w-2xl">
        The post-payment confirmation pages at <code>/welcome/&lt;track&gt;</code> (set as the
        Razorpay “redirect after payment” URL). All the copy is editable here — the intake date,
        venue, class times and calendar links are filled in automatically from your batches.
      </p>
      <WelcomePageEditor initial={c} />
    </div>
  );
}
