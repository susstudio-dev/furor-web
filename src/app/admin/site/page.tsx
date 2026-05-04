import { getContent } from '@/lib/content';
import { SiteEditor } from './SiteEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Site & socials</p>
      <h1 className="mt-1 display text-3xl font-extrabold">The basics</h1>
      <p className="mt-2 text-cream/70">Title, tagline, WhatsApp number, Instagram handle, and the live counter.</p>
      <SiteEditor initial={c} />
    </div>
  );
}
