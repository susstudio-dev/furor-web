import { getContent } from '@/lib/content';
import { StudiosEditor } from './StudiosEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Studios</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.studios.length} studios</h1>
      <p className="mt-2 text-cream/70">
        Shown on the home page (&ldquo;Visit us&rdquo;), the contact page, and as chips on the
        instructors page. Coordinates feed the embedded map; address is used for directions.
      </p>
      <StudiosEditor initial={c} />
    </div>
  );
}
