# La Rumba Hero Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/la-rumba` hero's single photograph into a cross-fading slider of images and video clips, while the headline, facts line and CTA stay fixed.

**Architecture:** All decisions live in a pure, unit-tested `src/lib/hero-slides.ts`; a `'use client'` component only renders. The route mounts the slider **only when it is actually needed** — an untouched document falls back to the existing single static photo and ships no slider JS at all.

**Tech Stack:** Next.js 15 App Router, React client component, Zod (content schema), Tailwind, Vitest (node environment, `src/**/*.test.ts` only — there is no component-test harness).

**Spec:** `docs/superpowers/specs/2026-09-15-la-rumba-hero-slider-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Typographic apostrophes.** Use `’` (U+2019), never `'`, in any string the site renders or the admin displays. There is already a commit in this repo fixing exactly this regression in La Rumba copy.
- **The retired word.** `content-schema.test.ts` sweeps schema defaults *and* seed prose and fails if the word the studio stopped using for a single paid class (t-r-i-a-l) appears in any renderable string. Code identifiers are exempt; rendered strings are not.
- **Stored bytes shadow defaults forever.** The first admin save bakes current defaults into R2, so a default that is wrong at ship time can never be fixed by editing the default. This is why `heroPhoto` is retired rather than deleted.
- **No `zod` in the public client bundle.** `src/lib/client-bundle.test.ts` fails any public `'use client'` component that transitively *value*-imports `zod` or `@/lib/content-schema`. `import type` is erased and is fine. This is why `hero-slides.ts` uses structural types.
- **Facts render from `content.tonight`.** Unchanged by this plan — do not move or duplicate the facts line.
- **Blank hides the element** — the convention throughout this content document.
- **Running the tests:** this shell exports `NODE_ENV=production`, which makes 2 unrelated `preview-token` tests throw. Always run `NODE_ENV=test npx vitest run`. Typecheck with `npx tsc --noEmit`. `next lint` is NOT configured (it prompts interactively) — never use it as a gate.
- **Baseline:** 744 tests passing across 52 files before this plan starts. Flag it if you see different.
- **This is a slow HDD.** A cold `next dev` boot is ~3 minutes and a first route compile ~60s. Budget for it; do not assume a hang.

## File Structure

**Created**
| File | Responsibility |
|---|---|
| `src/lib/hero-slides.ts` | Slide type, `resolveSlides`, `needsSlider`, `advanceIndex`, `SLIDE_HOLD_MS`. Pure. No JSX, no I/O, no schema import. |
| `src/lib/hero-slides.test.ts` | Unit tests for the above. |
| `src/components/LaRumbaHeroSlider.tsx` | The client slider. Renders only. |

**Modified**
| File | Change |
|---|---|
| `src/lib/content-schema.ts` | Add `pages.laRumba.heroSlides`; mark `heroPhoto` retired-but-parsed. |
| `src/lib/content-schema.test.ts` | Defaults, back-compat, both slide kinds. |
| `src/app/la-rumba/page.tsx` | Render the slider when needed, static photo otherwise. |
| `src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx` | Slide-list editor replaces the two hero-photo fields. |

---

### Task 1: `heroSlides` schema, `heroPhoto` retired

**Files:**
- Modify: `src/lib/content-schema.ts` (the `laRumba` block, around line 819)
- Test: `src/lib/content-schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `content.pages.laRumba.heroSlides`, an array of
  `{ kind: 'image', src: string, alt: string }` or
  `{ kind: 'video', posterSrc: string, posterAlt: string, webmUrl: string, mp4Url: string }`,
  defaulting to `[]`.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('pages.laRumba', …)` block in `src/lib/content-schema.test.ts`:

```ts
  // Empty ON PURPOSE. resolveSlides() falls back to heroPhoto, so a document
  // that has never been edited renders — and is served — exactly as before.
  // A non-empty default here would silently opt every existing page into the
  // slider on first parse.
  it('ships no hero slides by default', () => {
    expect(lr().heroSlides).toEqual([]);
  });

  // heroPhoto is retired as an editable field but must never be removed:
  // stored bytes shadow defaults forever, so a document saved before the
  // slider still carries it and would fail to parse without it.
  it('keeps heroPhoto so a pre-slider document still parses', () => {
    expect(lr().heroPhoto.src).toBe('/photos/DSC_0095.jpg');
    expect(lr().heroPhoto.alt).toBeTruthy();
  });

  it('parses a stored document that predates the slider', () => {
    const doc = JSON.parse(JSON.stringify(seed));
    if (doc.pages?.laRumba) delete doc.pages.laRumba.heroSlides;
    expect(() => SiteContentSchema.parse(doc)).not.toThrow();
  });

  it('accepts both slide kinds and discriminates them', () => {
    const doc = JSON.parse(JSON.stringify(seed));
    doc.pages = doc.pages ?? {};
    doc.pages.laRumba = {
      ...(doc.pages.laRumba ?? {}),
      heroSlides: [
        { kind: 'image', src: '/photos/DSC_0095.jpg', alt: 'A packed floor' },
        {
          kind: 'video',
          posterSrc: '/photos/DSC09776.jpg',
          posterAlt: 'Two dancers laughing',
          webmUrl: 'https://cdn.example.com/rumba.webm',
          mp4Url: 'https://cdn.example.com/rumba.mp4',
        },
      ],
    };
    const slides = SiteContentSchema.parse(doc).pages.laRumba.heroSlides;
    expect(slides).toHaveLength(2);
    expect(slides[0].kind).toBe('image');
    expect(slides[1].kind).toBe('video');
  });

  it('rejects a slide with an unknown kind rather than storing it', () => {
    const doc = JSON.parse(JSON.stringify(seed));
    doc.pages = doc.pages ?? {};
    doc.pages.laRumba = {
      ...(doc.pages.laRumba ?? {}),
      heroSlides: [{ kind: 'audio', src: '/x.mp3' }],
    };
    expect(() => SiteContentSchema.parse(doc)).toThrow();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_ENV=test npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `heroSlides` is undefined.

- [ ] **Step 3: Add the schema**

In `src/lib/content-schema.ts`, inside the `laRumba` object, REPLACE the existing `heroPhoto` field with the commented version below and add `heroSlides` immediately after it:

```ts
        /** RETIRED as an editable field on 2026-09-15, superseded by
         *  `heroSlides` — but never removed. Stored bytes shadow defaults
         *  forever: a document saved before the slider carries this key, and
         *  deleting the field would fail to parse it. `resolveSlides()` still
         *  falls back to this value, which is precisely what lets the slider
         *  ship with no migration, no backfill and no deploy ordering.
         *  Same treatment as `pages.home.nextBatches`. Not editable in admin. */
        heroPhoto: z
          .object({ src: z.string(), alt: z.string() })
          .default({
            src: '/photos/DSC_0095.jpg',
            alt: 'A packed floor at La Rumba, mid-song',
          }),
        /** The hero's cross-fading slides.
         *
         *  Defaults to EMPTY on purpose. `resolveSlides()` treats an empty
         *  list as "fall back to heroPhoto", so an untouched document renders
         *  the single static photo it always did — and the route does not
         *  mount the slider for it at all. A non-empty default here would opt
         *  every existing page into the slider the moment this parsed.
         *
         *  A video slide carries pasted URLs because the Worker cannot
         *  transcode video (the 10ms free-plan CPU cap that image-downscale.ts
         *  exists to work around) and the uploads route cannot serve it yet.
         *  The upload pipeline is a separate spec; it will FILL these fields
         *  rather than change their shape. */
        heroSlides: z
          .array(
            z.discriminatedUnion('kind', [
              z.object({
                kind: z.literal('image'),
                src: z.string().default(''),
                alt: z.string().default(''),
              }),
              z.object({
                kind: z.literal('video'),
                posterSrc: z.string().default(''),
                posterAlt: z.string().default(''),
                webmUrl: z.string().default(''),
                mp4Url: z.string().default(''),
              }),
            ]),
          )
          .default([]),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_ENV=test npx vitest run src/lib/content-schema.test.ts`
Expected: PASS. Then the whole suite: `NODE_ENV=test npx vitest run` (expect 749 passing — 744 baseline + 5 new) and `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts
git commit -m "feat: the La Rumba hero gains a slide list, and heroPhoto retires"
```

---

### Task 2: The pure slide helpers

**Files:**
- Create: `src/lib/hero-slides.ts`
- Test: `src/lib/hero-slides.test.ts`

**Interfaces:**
- Consumes: the shape of `pages.laRumba` from Task 1, but **structurally** — no import from `content-schema`.
- Produces:
  - `type Slide = { kind: 'image'; src: string; alt: string } | { kind: 'video'; posterSrc: string; posterAlt: string; webmUrl: string; mp4Url: string }`
  - `const SLIDE_HOLD_MS = 5000`
  - `resolveSlides(p: HeroSlideSource): Slide[]`
  - `needsSlider(slides: Slide[]): boolean`
  - `advanceIndex(current: number, total: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/hero-slides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceIndex, needsSlider, resolveSlides, SLIDE_HOLD_MS, type Slide } from './hero-slides';

const photo = { src: '/photos/DSC_0095.jpg', alt: 'A packed floor' };
const img = (src: string): Slide => ({ kind: 'image', src, alt: 'alt' });
const vid = (mp4Url: string): Slide => ({
  kind: 'video',
  posterSrc: '/p.jpg',
  posterAlt: 'poster',
  webmUrl: '',
  mp4Url,
});

describe('resolveSlides', () => {
  // THE invariant the whole no-regression claim rests on. Every document in
  // production is in this state on the day this ships.
  it('falls back to the retired heroPhoto when no slides are set', () => {
    expect(resolveSlides({ heroSlides: [], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('prefers the slide list once it has one usable slide', () => {
    const slides = [img('/a.jpg')];
    expect(resolveSlides({ heroSlides: slides, heroPhoto: photo })).toEqual(slides);
  });

  // A half-filled admin row must degrade to absence, never to a broken frame.
  it('drops an image slide with no source', () => {
    const out = resolveSlides({ heroSlides: [img(''), img('/b.jpg')], heroPhoto: photo });
    expect(out).toEqual([img('/b.jpg')]);
  });

  it('drops a video slide with neither url', () => {
    const empty: Slide = { kind: 'video', posterSrc: '/p.jpg', posterAlt: 'p', webmUrl: '', mp4Url: '' };
    expect(resolveSlides({ heroSlides: [empty], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('keeps a video slide that has only a webm', () => {
    const webmOnly: Slide = { kind: 'video', posterSrc: '', posterAlt: '', webmUrl: '/v.webm', mp4Url: '' };
    expect(resolveSlides({ heroSlides: [webmOnly], heroPhoto: photo })).toEqual([webmOnly]);
  });

  it('treats whitespace as blank', () => {
    expect(resolveSlides({ heroSlides: [img('   ')], heroPhoto: photo })).toEqual([
      { kind: 'image', src: photo.src, alt: photo.alt },
    ]);
  });

  it('preserves the order the owner arranged', () => {
    const slides = [img('/a.jpg'), vid('/v.mp4'), img('/c.jpg')];
    expect(resolveSlides({ heroSlides: slides, heroPhoto: photo })).toEqual(slides);
  });

  // Blank hides the element: with nothing to show, show nothing.
  it('returns an empty list when even heroPhoto is blank', () => {
    expect(resolveSlides({ heroSlides: [], heroPhoto: { src: '', alt: '' } })).toEqual([]);
  });
});

describe('needsSlider', () => {
  // The point of this predicate: an untouched page must not mount a client
  // component, start a timer, or ship a byte of slider JS.
  it('is false for the single static photo every untouched document has', () => {
    expect(needsSlider(resolveSlides({ heroSlides: [], heroPhoto: photo }))).toBe(false);
  });

  it('is false for no slides at all', () => {
    expect(needsSlider([])).toBe(false);
  });

  it('is true once there are two slides', () => {
    expect(needsSlider([img('/a.jpg'), img('/b.jpg')])).toBe(true);
  });

  // A lone video still needs the component — the static path renders an <Img>
  // and cannot play a clip.
  it('is true for a single video slide', () => {
    expect(needsSlider([vid('/v.mp4')])).toBe(true);
  });
});

describe('advanceIndex', () => {
  it('advances and wraps', () => {
    expect(advanceIndex(0, 3)).toBe(1);
    expect(advanceIndex(2, 3)).toBe(0);
  });

  // Callers need no special case for degenerate lists.
  it('stays at zero for lists that cannot advance', () => {
    expect(advanceIndex(0, 1)).toBe(0);
    expect(advanceIndex(0, 0)).toBe(0);
  });
});

describe('SLIDE_HOLD_MS', () => {
  it('is a sane hold, long enough to read a frame', () => {
    expect(SLIDE_HOLD_MS).toBe(5000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_ENV=test npx vitest run src/lib/hero-slides.test.ts`
Expected: FAIL — `Cannot find module './hero-slides'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/hero-slides.ts`:

```ts
/**
 * A hero slide.
 *
 * Structurally typed, and deliberately NOT derived from content-schema: this
 * module is imported by a public `'use client'` component, and a value import
 * of the schema would drag zod (~13KB gz) into the bundle of every route —
 * the exact regression `client-bundle.test.ts` exists to catch.
 */
export type Slide =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; posterSrc: string; posterAlt: string; webmUrl: string; mp4Url: string };

/** What the hero reads slides out of — the two fields, nothing else. */
export interface HeroSlideSource {
  heroSlides: Slide[];
  heroPhoto: { src: string; alt: string };
}

/**
 * How long an image slide holds before the slider advances.
 *
 * A constant rather than an admin field: nobody has asked to tune it, every
 * editable field is one more thing the owner must understand, and a wrong
 * value here is a one-line change. A video slide ignores this entirely — it
 * advances when the clip ends, so a shot is never cut mid-movement.
 */
export const SLIDE_HOLD_MS = 5000;

/** Whether a slide has enough filled in to render anything at all. */
function renderable(s: Slide): boolean {
  return s.kind === 'image'
    ? s.src.trim() !== ''
    : s.webmUrl.trim() !== '' || s.mp4Url.trim() !== '';
}

/**
 * The slides the hero actually renders.
 *
 * Two jobs, and the second is what makes this feature safe to ship.
 *
 * It drops slides that cannot render — an image with no source, a video with
 * neither URL — so a half-filled admin row degrades to absence rather than to
 * a broken frame on a real business's page.
 *
 * And it falls back to `heroPhoto` when nothing usable remains. `heroSlides`
 * defaults to empty, so EVERY document in production is in that state the day
 * this ships: they all resolve to the single photograph they already showed.
 * No migration, no backfill, no ordering constraint between deploying the code
 * and editing the content. `heroPhoto` is retired from the admin but kept in
 * the schema for exactly this reason.
 */
export function resolveSlides(p: HeroSlideSource): Slide[] {
  const usable = p.heroSlides.filter(renderable);
  if (usable.length > 0) return usable;
  if (p.heroPhoto.src.trim() === '') return [];
  return [{ kind: 'image', src: p.heroPhoto.src, alt: p.heroPhoto.alt }];
}

/**
 * Whether these slides need the interactive slider mounted.
 *
 * False for the one case that describes every untouched page — a single image
 * — and the route then renders plain static markup. That is not an
 * optimisation detail: it means shipping this feature cannot regress the hero
 * of a page whose owner has not opted in, because such a page is not merely
 * rendered identically, it is SERVED identically, with no client component, no
 * timer, no observers and no slider JS.
 *
 * True for a lone video, because static markup renders an `<Img>` and cannot
 * play a clip.
 */
export function needsSlider(slides: Slide[]): boolean {
  if (slides.length > 1) return true;
  return slides.length === 1 && slides[0].kind === 'video';
}

/** Next index, wrapping. Returns 0 for lists that cannot advance so callers
 *  need no special case. */
export function advanceIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  return (current + 1) % total;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_ENV=test npx vitest run src/lib/hero-slides.test.ts`
Expected: PASS (15 tests). Then `NODE_ENV=test npx vitest run` (expect 764 — 744 baseline + 5 from Task 1 + 15 here) and `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hero-slides.ts src/lib/hero-slides.test.ts
git commit -m "feat: pure slide resolution for the La Rumba hero"
```

---

### Task 3: The slider component and the route

**Files:**
- Create: `src/components/LaRumbaHeroSlider.tsx`
- Modify: `src/app/la-rumba/page.tsx` (the hero section, around lines 63-74)

**Interfaces:**
- Consumes: `resolveSlides`, `needsSlider`, `advanceIndex`, `SLIDE_HOLD_MS`, `type Slide` from `@/lib/hero-slides` (Task 2).
- Produces: `<LaRumbaHeroSlider slides={Slide[]} />`.

- [ ] **Step 1: Write the component**

Create `src/components/LaRumbaHeroSlider.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Img } from './Img';
import { advanceIndex, SLIDE_HOLD_MS, type Slide } from '@/lib/hero-slides';

// The hero's cross-fading backdrop. The page's message — headline, facts line
// and CTA — deliberately lives OUTSIDE this component and never moves: a
// visitor who lands mid-rotation must still meet one headline and one ask.
// Rotating the offer is how carousels lose conversions.
//
// Mounted only when `needsSlider()` says so, so an untouched page ships none
// of this.
//
// Props are plain data, never a slice of SiteContent — a value import of the
// schema here would put zod in every route's bundle (client-bundle.test.ts).
export function LaRumbaHeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  // Auto-advance ends permanently on the first manual interaction. Something
  // that starts moving again under the visitor's cursor after they took
  // control is hostile.
  const [auto, setAuto] = useState(true);
  // Two INDEPENDENT reasons to hold: off-screen, and backgrounded tab. Kept as
  // separate flags rather than one, because a single flag forces each source to
  // guess the other's state — the version of this that asked
  // getBoundingClientRect() inside the visibilitychange handler would fight the
  // observer and settle on whichever fired last.
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  // A clip that will not load must not stall the slider forever; it falls
  // through to the normal timer.
  const [videoFailed, setVideoFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Under prefers-reduced-motion nothing advances on its own. The rest of this
  // codebase already honours the setting (the magnetic and spotlight effects
  // do); the slider matches rather than inventing its own policy.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Off-screen, nothing ticks and no clip plays.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Backgrounded, likewise. A muted clip looping in a tab nobody is looking at
  // is a real battery complaint, not a hypothetical one.
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const current = slides[index];
  const isVideo = current?.kind === 'video' && !videoFailed;

  // One predicate, three independent brakes. NOTE it does not include the
  // slide count: a lone video slide still has to play, it simply never
  // advances to anything.
  const canAuto = auto && inView && tabVisible && !reduced;

  // Image slides hold on a timer. Video slides do not — they advance from
  // their own `ended` event below, so a shot is never cut mid-movement.
  useEffect(() => {
    if (!canAuto || isVideo || slides.length <= 1) return;
    const t = setTimeout(() => setIndex((i) => advanceIndex(i, slides.length)), SLIDE_HOLD_MS);
    return () => clearTimeout(t);
  }, [canAuto, isVideo, index, slides.length]);

  // A new slide gets a clean slate: a clip that failed last time may simply
  // have been a flaky network, and one bad load must not permanently demote
  // every later video to the image timer.
  useEffect(() => {
    setVideoFailed(false);
  }, [index]);

  // Drive the active clip explicitly. The `autoplay` attribute alone would
  // also start slides that are off-screen, backgrounded, or not current.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (canAuto) {
      void v.play().catch(() => setVideoFailed(true));
    } else {
      v.pause();
    }
  }, [index, canAuto]);

  function goTo(i: number) {
    setAuto(false);
    setIndex(i);
  }

  return (
    <div ref={rootRef} className="absolute inset-0" aria-roledescription="carousel" aria-label="La Rumba photographs">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={i !== index}
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}`}
        >
          {s.kind === 'image' ? (
            <Img
              src={s.src}
              alt={s.alt}
              seed={`la-rumba-hero-${i}`}
              fill
              // Only the first slide is the LCP candidate. Making them all
              // eager would fetch every photo before the page is usable.
              priority={i === 0}
              className="object-cover"
            />
          ) : (
            <video
              ref={i === index ? videoRef : undefined}
              muted
              playsInline
              // No `loop`: a looping clip never fires `ended`, so the slider
              // would stop on the first video forever.
              preload={i === index ? 'auto' : 'none'}
              poster={s.posterSrc || undefined}
              aria-label={s.posterAlt || undefined}
              className="h-full w-full object-cover"
              onEnded={() => setIndex((c) => advanceIndex(c, slides.length))}
              onError={() => setVideoFailed(true)}
            >
              {s.webmUrl ? <source src={s.webmUrl} type="video/webm" /> : null}
              {s.mp4Url ? <source src={s.mp4Url} type="video/mp4" /> : null}
            </video>
          )}
        </div>
      ))}

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1} of ${slides.length}`}
              aria-current={i === index}
              // 44px target with a small visible dot inside it — the hit-area
              // size the rest of this codebase uses.
              className="inline-flex h-11 w-11 items-center justify-center"
            >
              <span
                className={`block h-2 w-2 rounded-full transition ${
                  i === index ? 'bg-cream' : 'bg-cream/40'
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the route**

In `src/app/la-rumba/page.tsx`:

Add to the imports:

```tsx
import { needsSlider, resolveSlides } from '@/lib/hero-slides';
import { LaRumbaHeroSlider } from '@/components/LaRumbaHeroSlider';
```

Inside the component, next to the other derivations (near `const facts = …`):

```tsx
  // An untouched document resolves to the single photo it always showed, and
  // needsSlider() is false for it — so that page ships no slider JS at all.
  const slides = resolveSlides(p);
  const slider = needsSlider(slides);
  const firstImage = slides[0]?.kind === 'image' ? slides[0] : null;
```

Then REPLACE the hero's backdrop block. It currently reads:

```tsx
        <div className="absolute inset-0 -z-10">
          <Img
            src={p.heroPhoto.src}
            alt={p.heroPhoto.alt}
            seed="la-rumba-hero"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-ink-950/70" />
        </div>
```

with:

```tsx
        <div className="absolute inset-0 -z-10">
          {slider ? (
            <LaRumbaHeroSlider slides={slides} />
          ) : firstImage ? (
            <Img
              src={firstImage.src}
              alt={firstImage.alt}
              seed="la-rumba-hero"
              fill
              priority
              className="object-cover"
            />
          ) : null}
          {/* The scrim sits INSIDE .rumba-night, so bg-ink-950 resolves to the
              locally redeclared dark value in both themes. Moving it out would
              lay 70% near-white over the photo on the light theme. */}
          <div className="absolute inset-0 bg-ink-950/70" />
        </div>
```

- [ ] **Step 3: Verify the suite and types still pass**

Run: `NODE_ENV=test npx vitest run`
Expected: 764 passing, 52 files — unchanged from Task 2, since this task adds no tests.
Run: `npx tsc --noEmit` — must be clean.
`client-bundle.test.ts` must stay green; if it fails, the component has picked up a value import of the schema.

- [ ] **Step 4: Verify in a browser**

Start the dev server if one is not already on port 3000 (`NODE_ENV=development npx next dev` — cold boot ~3 min, first compile ~60s).

Check, and report each explicitly as verified or not:
1. `/la-rumba` with an unedited document — the hero looks **exactly** as before, and `view-source` shows the plain `<img>`, no dots, no slider markup.
2. Temporarily add two slides to `pages.laRumba.heroSlides` in `data/site-content.json` — **back the file up first and restore it byte-identically afterwards, verifying with a checksum.** Confirm cross-fade, dots, that clicking a dot stops auto-advance, and that no horizontal scrollbar appears at 390px.
3. Both themes: the hero must stay dark. If it renders milky in light theme the scrim has escaped `.rumba-night`.

- [ ] **Step 5: Commit**

```bash
git add src/components/LaRumbaHeroSlider.tsx src/app/la-rumba/page.tsx
git commit -m "feat: the La Rumba hero cross-fades through its slides"
```

---

### Task 4: The admin slide-list editor

**Files:**
- Modify: `src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx` (the "Header" section, lines ~71-96)

**Interfaces:**
- Consumes: `pages.laRumba.heroSlides` from Task 1.
- Produces: nothing other tasks read.

- [ ] **Step 1: Replace the two hero-photo fields**

In the `<Section title="Header">` block, DELETE the existing `Field label="Hero photo"` and `Field label="Hero photo description"` blocks entirely (the `heroPhoto` value stays in storage and still feeds the fallback — it is simply no longer edited).

Add `ImageUploader` to the existing import from `@/components/admin/ImageUploader`, then insert in their place:

```tsx
          <Field
            label="Hero slides"
            hint="The full-width media behind the page title. One slide shows a single still photo, exactly as before. Add a second and they cross-fade."
          >
            <div className="grid gap-4">
              {p.heroSlides.map((s, i) => {
                const patchSlide = (next: typeof s) => {
                  const slides = p.heroSlides.slice();
                  slides[i] = next;
                  patch({ heroSlides: slides });
                };
                const move = (to: number) => {
                  if (to < 0 || to >= p.heroSlides.length) return;
                  const slides = p.heroSlides.slice();
                  const [moved] = slides.splice(i, 1);
                  slides.splice(to, 0, moved);
                  patch({ heroSlides: slides });
                };
                return (
                  <div key={i} className="rounded-2xl border border-cream/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="display text-sm uppercase tracking-widest text-cream/60">
                        Slide {i + 1} · {s.kind === 'image' ? 'Photo' : 'Video'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn-ghost" onClick={() => move(i - 1)}>
                          ↑
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => move(i + 1)}>
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-ember-400"
                          onClick={() =>
                            patch({ heroSlides: p.heroSlides.filter((_, j) => j !== i) })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {s.kind === 'image' ? (
                      <div className="grid gap-3">
                        <ImageUploader
                          label="Photo"
                          aspect="wide"
                          value={s.src}
                          onChange={(src) => patchSlide({ ...s, src })}
                        />
                        <Field label="Description" hint="Read aloud by screen readers.">
                          <input
                            value={s.alt}
                            onChange={(e) => patchSlide({ ...s, alt: e.target.value })}
                            className="input"
                          />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <ImageUploader
                          label="Poster image"
                          aspect="wide"
                          value={s.posterSrc}
                          onChange={(posterSrc) => patchSlide({ ...s, posterSrc })}
                        />
                        <Field label="Poster description" hint="Read aloud by screen readers.">
                          <input
                            value={s.posterAlt}
                            onChange={(e) => patchSlide({ ...s, posterAlt: e.target.value })}
                            className="input"
                          />
                        </Field>
                        <Field
                          label="Video URLs"
                          hint="Uploading video here isn’t supported yet — paste links to files you host elsewhere. Give both formats if you can: the browser picks whichever it can play, preferring WebM. MP4 alone works everywhere."
                        >
                          <div className="grid gap-2">
                            <input
                              value={s.webmUrl}
                              placeholder="https://… .webm"
                              onChange={(e) => patchSlide({ ...s, webmUrl: e.target.value })}
                              className="input"
                            />
                            <input
                              value={s.mp4Url}
                              placeholder="https://… .mp4"
                              onChange={(e) => patchSlide({ ...s, mp4Url: e.target.value })}
                              className="input"
                            />
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patch({ heroSlides: [...p.heroSlides, { kind: 'image', src: '', alt: '' }] })
                  }
                >
                  + Add photo slide
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patch({
                      heroSlides: [
                        ...p.heroSlides,
                        { kind: 'video', posterSrc: '', posterAlt: '', webmUrl: '', mp4Url: '' },
                      ],
                    })
                  }
                >
                  + Add video slide
                </button>
              </div>

              {p.heroSlides.length === 0 ? (
                <p className="text-sm text-cream/60">
                  No slides yet — the page is showing the single hero photo it always has. Add one
                  to take over, or leave this empty to keep it.
                </p>
              ) : null}
            </div>
          </Field>
```

- [ ] **Step 2: Verify types and suite**

Run: `npx tsc --noEmit` — clean. The discriminated union means TypeScript will reject a `patchSlide` that mixes fields across kinds; if it complains, the narrowing is wrong, not the types.
Run: `NODE_ENV=test npx vitest run` — 764 passing, unchanged.

- [ ] **Step 3: Verify in the admin**

With the dev server up, open `/admin/pages/la-rumba`. Confirm: adding a photo slide, uploading into it, adding a video slide, reordering, removing, and that saving then reloading round-trips the list. Report explicitly if you could not exercise the save path.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx
git commit -m "feat: the owner can build the La Rumba hero slide list"
```

---

## Verification Checklist

- [ ] An untouched document renders the hero **identically** and ships no slider JS.
- [ ] Two or more slides cross-fade; a dot click stops auto-advance for the visit.
- [ ] A video slide advances when its clip ends, not on the image timer.
- [ ] `prefers-reduced-motion` stops auto-advance; dots still work.
- [ ] The hero stays dark in BOTH themes (the scrim must remain inside `.rumba-night`).
- [ ] No horizontal scrollbar at 390px.
- [ ] `client-bundle.test.ts` green — no zod in the public bundle.
- [ ] `NODE_ENV=test npx vitest run` → 764 passing; `npx tsc --noEmit` clean.

## Out of Scope

- **Video upload, compression and streaming.** Its own spec. The Worker cannot transcode (10ms free-plan CPU cap), and the uploads route would serve an MP4 as an attachment, has no Range support, and materialises whole files in a 128MB isolate against an 8MB cap.
- **The home hero.** It has its own video fields and its own tuned LCP path.
- **Per-slide captions or CTAs.** The message stays fixed — that was the explicit design decision.
