# La Rumba hero slider — design

**Date:** 2026-09-15
**Status:** approved, ready to plan
**Follows:** `docs/superpowers/specs/2026-08-25-la-rumba-page-design.md`

## Goal

Turn the `/la-rumba` hero's single photograph into a slider that cross-fades
through several images — and, where the owner has video hosted elsewhere, video
clips — while the headline, facts line and CTA stay fixed.

## What already exists

Grounding, so the plan does not reinvent any of it:

| Thing | Where | Note |
|---|---|---|
| The hero being changed | `src/app/la-rumba/page.tsx`, section 1 | `rumba-night relative isolate overflow-hidden`, one `<Img … priority>` plus a `bg-ink-950/70` scrim, all behind `-z-10` |
| `heroPhoto` | `content-schema.ts:819` | `{src, alt}`, defaults to `/photos/DSC_0095.jpg` |
| Browser format negotiation | `src/components/Hero.tsx:111-112` | `<source type="video/webm">` then `type="video/mp4">` — the browser already picks. Reuse verbatim. |
| Client-side image downscaling | `src/lib/image-downscale.ts` + `ImageUploader.tsx` | Uploads are resized in the BROWSER; the Worker only sniffs bytes and caps size |
| A marquee, NOT a slider | `src/components/PhotoCarousel.tsx` | Continuously-scrolling strip used on `/about`. Different job — do not extend it. Do follow its idioms: `'use client'`, the `Img` wrapper, inline `<style>`, explicit reduced-motion handling. |
| Public client-bundle guard | `src/lib/client-bundle.test.ts` | No public `'use client'` component may value-import `zod` or `@/lib/content-schema` |

## Scope

**In:** the slider, its schema, its admin editing, and a `video` slide kind fed
by pasted URLs.

**Out — deferred to its own spec:** uploading and compressing video. That is a
separate subsystem and a much larger one. Three independent blockers make it so,
all in `src/app/uploads/[file]/route.ts`:

1. The `IMAGE_TYPES` allowlist forces anything else to `application/octet-stream`
   **with `content-disposition: attachment`** — an uploaded MP4 would download
   rather than play. That is a deliberate control stopping a non-image executing
   in the origin; it must be widened carefully, never removed.
2. No HTTP Range support. `readBinary` returns the whole object; there is no
   `Accept-Ranges` and no 206 path, so video could not be scrubbed.
3. `readBinary` materialises the entire file in a 128 MB isolate, and the upload
   cap is 8 MB.

Plus the transcode itself, which cannot run in the Worker at all (`10ms` free-plan
CPU cap — the reason `image-downscale.ts` exists).

**The video slide kind ships anyway**, taking pasted `webm`/`mp4` URLs exactly as
`Hero.tsx` does today. The schema is then already the right shape, an owner
hosting video elsewhere can use it immediately, and the deferred pipeline only has
to *fill* those fields rather than migrate the structure.

## Schema

Add `pages.laRumba.heroSlides`, a discriminated array:

```
heroSlides: z.array(z.discriminatedUnion('kind', [
  { kind: 'image', src: string, alt: string },
  { kind: 'video', posterSrc: string, posterAlt: string,
    webmUrl: string, mp4Url: string },
])).default([])
```

Defaults to `[]`, **not** to a list of photos. That is deliberate — see the
fallback below.

### `heroPhoto` is retired, never removed

`heroPhoto` stays in the schema permanently and stops being editable. This is not
tidiness: the first admin save bakes the then-current defaults into R2, and stored
bytes shadow defaults forever, so a document in production may already carry
`heroPhoto`. Deleting the field would fail to parse it.

This codebase has already done exactly this, with `pages.home.nextBatches`:
*"Retired render site 2026-08-24 … Fields kept so stored documents parse; not
editable in admin."* Mark `heroPhoto` the same way.

### The fallback is what makes this migration-free

`resolveSlides()` returns `heroSlides` when non-empty, and otherwise
`[{ kind: 'image', ...heroPhoto }]`. So a stored document that has never heard of
slides renders **exactly** as it does today, with no migration step, no data
backfill and no deploy ordering constraint.

## Components

### `src/lib/hero-slides.ts` — pure, tested

All decisions live here; the component only renders. Mirrors `book-label.ts` and
`board-card-copy.ts`.

- `resolveSlides(laRumba): Slide[]` — the union above plus the `heroPhoto`
  fallback. Drops slides that cannot render (an image with a blank `src`; a video
  with neither `webmUrl` nor `mp4Url`) so a half-filled admin row degrades to
  absence rather than to a broken frame.
- `advanceIndex(current, total): number` — wraps at the end. Returns `0` for a
  zero or one-slide list so the caller needs no special case.

Structural types only — **no import from `content-schema`**, so nothing drags
`zod` toward the public bundle.

### `src/components/LaRumbaHeroSlider.tsx` — `'use client'`

Props are plain data (`slides: Slide[]`), never a slice of `SiteContent`.

Renders every slide absolutely stacked, cross-fading on `opacity`. `Img` is
already a client component (it holds `useState` for its error fallback), so it
nests fine.

## The three things that decide whether this is any good

**LCP.** Slide one is the page's largest contentful paint. It keeps `priority`;
every other image slide is lazy; every video slide carries `preload="none"` until
it becomes active. Without this, adding a slider straightforwardly regresses a
hero that has already had commits spent tuning it (`eee06b9`).

**Battery.** Auto-advance pauses when the section leaves the viewport
(`IntersectionObserver`) and when the tab is hidden (`visibilitychange`). A
looping muted video in a backgrounded tab is a real user complaint, not a
hypothetical.

**Reduced motion.** Under `prefers-reduced-motion: reduce` there is no
auto-advance at all — slide one, with the dots still operable. Commit `b53ed4e`
already made the magnetic and spotlight effects respect this; the slider matches
rather than inventing its own policy.

### Timing

Image slides hold `SLIDE_HOLD_MS = 5000`, a named constant in `hero-slides.ts`,
not an admin field — nobody has asked to tune it and a wrong value is a one-line
fix. A video slide advances on its `ended` event, so a clip is never cut
mid-shot. A video that fails to load falls through to its poster and then to the
normal timer, so one bad URL cannot stall the slider permanently.

Auto-advance stops for the rest of the page visit on the first manual
interaction — dot, swipe or arrow key. Something that starts moving again under
the visitor's cursor after they took control is hostile.

### One slide is the common case, and must cost nothing

`resolveSlides` returns a single slide for every document that has not been
edited yet — which at launch is all of them. In that case the route renders the
**existing static hero markup** and does not mount the slider at all: no client
component, no timer, no observers, no dots, no extra JS on the page.

This is what makes the migration-free claim real. An untouched document is not
merely *rendered* the same, it is *served* the same, so shipping this feature
cannot regress the hero for anyone who has not opted in. The slider is mounted
only when there are two or more slides.

## Accessibility

- The slide region carries `aria-roledescription="carousel"`; each slide
  `aria-roledescription="slide"` with an `aria-label` of its position.
- Dots are real `<button>`s with `aria-label` naming the slide and
  `aria-current` on the active one, at a 44px hit target — the size the rest of
  this codebase uses.
- Auto-advance stops permanently on first manual interaction. Something that
  moves again under the visitor's cursor after they took control is hostile.
- Decorative video is `muted` + `playsInline` + `loop`; the poster carries the
  alt text, since the clip itself conveys nothing a screen reader can use.

## Admin

`LaRumbaPageEditor`'s single hero-photo field becomes a slide list: add, remove,
reorder, and a per-slide kind toggle.

- Image slides use the existing `ImageUploader`, which already downscales in the
  browser.
- Video slides take pasted `webm`/`mp4` URLs plus a poster image, with a hint
  saying plainly that uploading video is not yet supported and what the fields
  expect. An editor that silently accepts a field it cannot fulfil is worse than
  one that says so.
- `heroPhoto` disappears from the editor entirely. Its value survives in storage
  and still feeds the fallback.

## Testing

- `src/lib/hero-slides.test.ts` — `resolveSlides` with: a populated list, an
  empty list falling back to `heroPhoto`, an image slide with a blank `src`, a
  video slide with no URLs, and a mixed list. `advanceIndex` at the wrap
  boundary and for 0- and 1-slide lists. Critically, a test pinning that an
  untouched document yields exactly one slide — that is the invariant the
  no-regression claim rests on.
- No component test. There is no component-test harness here — `vitest` runs
  `src/**/*.test.ts` in the `node` environment — so the slider's behaviour is
  verified by hand in a browser and the report must state exactly which parts
  were and were not checked.
- Existing suites that must stay green: `client-bundle.test.ts` (the new client
  component must not reach `zod`), `content-schema.test.ts` (the new defaults
  must not reintroduce the retired single-class word, and must not duplicate a
  fact `tonight` owns).

## Deliverables

1. `heroSlides` schema + `heroPhoto` marked retired-but-parsed.
2. `src/lib/hero-slides.ts` + tests.
3. `LaRumbaHeroSlider.tsx`, and the route rendering it **only when there are two
   or more slides** — with the headline, facts line and CTA fixed outside it.
4. Admin slide-list editor replacing the single photo field.

## Out of scope

- **Video upload, compression and streaming.** Its own spec, per the blockers
  above.
- **The home hero.** It has its own video fields and its own tuned LCP path;
  changing it is not required by this and would put that tuning at risk.
- **Per-slide captions or CTAs.** The message stays fixed — that was the explicit
  design decision, and per-slide copy is what makes hero carousels lose
  conversions.
