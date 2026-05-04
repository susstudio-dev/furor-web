import { getContent } from '@/lib/content';
import { BatchesEditor } from './BatchesEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Batches</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Open batches</h1>
      <p className="mt-2 text-cream/70">Add, edit, or close batches. Past-dated batches are hidden from the public site automatically.</p>
      <BatchesEditor initial={c} />
    </div>
  );
}
