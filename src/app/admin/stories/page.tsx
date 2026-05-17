import { getContent } from '@/lib/content';
import { StoriesEditor } from './StoriesEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Stories</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.stories.length} stories</h1>
      <p className="mt-2 text-cream/70">
        Blog-style posts. Each one gets its own page at <code>/stories/&lt;slug&gt;</code>.
      </p>
      <StoriesEditor initial={c} />
    </div>
  );
}
