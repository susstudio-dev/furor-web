import { getContent } from '@/lib/content';
import { JsonEditor } from './JsonEditor';

export default async function JsonPage() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Raw JSON</p>
      <h1 className="mt-1 display text-3xl font-extrabold">site-content.json</h1>
      <p className="mt-2 text-cream/70 max-w-2xl">
        The single source of truth for the entire site. Edit carefully — schema is validated on save.
      </p>
      <JsonEditor initial={c} />
    </div>
  );
}
