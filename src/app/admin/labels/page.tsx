import { getContent } from '@/lib/content';
import { LabelsEditor } from './LabelsEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('labels');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-4xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Buttons &amp; labels</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Every button, menu item and badge</h1>
      <p className="mt-2 text-cream/70">
        The short strings that repeat all over the site. Leave a field blank to keep the wording we
        ship — the grey text in each box is that default.
      </p>
      <LabelsEditor initial={c} />
    </div>
  );
}
