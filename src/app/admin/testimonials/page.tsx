import { getContent } from '@/lib/content';
import { TestimonialsEditor } from './TestimonialsEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Testimonials</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.testimonials.length} testimonials</h1>
      <p className="mt-2 text-cream/70">Short student quotes that surface across the home and about pages.</p>
      <TestimonialsEditor initial={c} />
    </div>
  );
}
