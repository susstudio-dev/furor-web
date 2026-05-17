import { getContent } from '@/lib/content';
import { HeroEditor } from './HeroEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Hero</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Headline & poster</h1>
      <p className="mt-2 text-cream/70">
        The big top-of-page block. If a video is set, the poster image is shown until it plays.
      </p>
      <HeroEditor initial={c} />
    </div>
  );
}
