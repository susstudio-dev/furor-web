import { getContent } from '@/lib/content';
import { InstructorsEditor } from './InstructorsEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('instructors');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Instructors</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.instructors.length} instructors</h1>
      <p className="mt-2 text-cream/70">Photo, bio, branches and styles taught.</p>
      <InstructorsEditor initial={c} />
    </div>
  );
}
