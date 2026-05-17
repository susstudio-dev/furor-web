import { getContent } from '@/lib/content';
import { StylesEditor } from './StylesEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Dance styles</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.danceStyles.length} styles</h1>
      <p className="mt-2 text-cream/70">
        Copy, hero image, level outcomes, FAQs, and ordering. Each style gets its own page at <code>/dance-styles/&lt;slug&gt;</code>.
      </p>
      <StylesEditor initial={c} />
    </div>
  );
}
