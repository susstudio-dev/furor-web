# La Rumba Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/la-rumba` — a first-class page for the weekly Latin social — and rework the home-page band so it reads like a night out and links through to it.

**Architecture:** A server-rendered Next.js App Router route reading the shared content document. Every *fact* about the social (day, hour, venue, locality) renders live from `content.tonight`; only *copy* lives in the new `pages.laRumba` schema block. Copy decisions are pure functions in `src/lib/` with unit tests, mirroring `book-label.ts` and `board-card-copy.ts`; the components only render.

**Tech Stack:** Next.js 15 App Router, React server components, Zod (content schema), Tailwind, Vitest (node environment, `src/**/*.test.ts` only — there is no component-test harness).

**Spec:** `docs/superpowers/specs/2026-08-25-la-rumba-page-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Truth.** Only these facts exist: name "La Rumba · Latin Social"; every Saturday; 7 PM; Over the Moon Brew Co, Gachibowli, Hyderabad; all levels welcome; entry paid at the venue and varies by the night; format varies week to week. **Never** state a price, a cover charge, an end time, a door time other than 7 PM, a lesson-then-social structure, or that a themed edition is coming.
- **Facts render from `content.tonight`, never duplicated into `pages.laRumba`.** A second stored copy of "Saturday 7 PM at Over the Moon" contradicts the first the night the venue changes.
- **The retired word.** `content-schema.test.ts` sweeps schema defaults *and* seed prose and fails if the word the studio stopped using for a single paid class (t-r-i-a-l) reappears in any renderable string. Write in the "first class" vocabulary. Code identifiers like `trialFromInr` are exempt — only rendered strings matter.
- **Typographic apostrophes.** Use `’` (U+2019), never `'`, in any string the site renders. There is already a commit fixing exactly this regression in La Rumba copy.
- **Stored bytes shadow defaults forever.** The first admin save bakes current defaults into R2, so a default that is wrong at ship time can never be fixed by editing the default. Get them right once.
- **Server-rendered.** Add no new `'use client'` component. `EnquiryCTA` is already a client component present on every route. `client-bundle.test.ts` guards this.
- **Blank hides the element** — the convention throughout this content document.
- **Running the tests:** this shell has `NODE_ENV=production` exported, which makes 2 unrelated `preview-token` tests throw. Always run `NODE_ENV=test npx vitest run`. Typecheck with `npx tsc --noEmit`. `next lint` is NOT configured (it prompts interactively) — do not use it as a gate.
- **This is a slow HDD.** A cold `next dev` boot is ~3 minutes and a first route compile ~60s. Budget for it; do not assume a hang.

## File Structure

**Created**
| File | Responsibility |
|---|---|
| `src/lib/la-rumba-page.ts` | Two pure helpers: the fact strip, and testimonial resolution. No JSX, no I/O. |
| `src/lib/la-rumba-page.test.ts` | Unit tests for the above. |
| `src/app/la-rumba/page.tsx` | The public route. Renders only; all decisions imported. |
| `src/app/admin/pages/la-rumba/page.tsx` | Guarded admin shell. |
| `src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx` | The editor form. |

**Modified**
| File | Change |
|---|---|
| `src/lib/content-schema.ts` | `pages.laRumba` block; `pages.home.rumba.pageLink`. |
| `src/lib/content-schema.test.ts` | Defaults, absent-key tolerance, truth guards. |
| `src/lib/enquiry.ts` | `EnquirySource` gains `'la_rumba_page'`. |
| `src/lib/nav.ts` | Nav entry, label key, new `navItemsFor()`. |
| `src/lib/nav.test.ts` | The pinned id list; `navItemsFor` behaviour. |
| `src/lib/label-defaults.ts` | `navLaRumba`. |
| `src/lib/page-meta.ts` | `'laRumba'` key + SEO defaults. |
| `src/lib/public-urls.ts` | `/la-rumba` in `STATIC_PATHS`. |
| `src/lib/public-urls.test.ts` | Assert it is there. |
| `src/app/sitemap.ts` | `/la-rumba` entry. |
| `src/components/Header.tsx` | Read `navItemsFor()`. |
| `src/components/Footer.tsx` | Read `navItemsFor()`. |
| `src/components/RumbaBand.tsx` | Full-bleed night treatment + link through. |
| `src/app/globals.css` | `.full-bleed` + `.rumba-night` utilities. |
| `src/app/admin/pages/page.tsx` | Index card for the new editor. |

**Deliberately NOT modified:** `src/app/admin/labels/LabelsEditor.tsx`. See Task 4 — the spec was wrong about this.

---

### Task 1: `pages.laRumba` schema and `rumba.pageLink`

**Files:**
- Modify: `src/lib/content-schema.ts`
- Test: `src/lib/content-schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `content.pages.laRumba` with fields `seoTitle`, `seoDescription`, `intro{eyebrow,headline,lead}`, `heroPhoto{src,alt}`, `heroCtaLabel`, `reassure{eyebrow,headline,items:[{title,body}]}`, `gallery{eyebrow,headline,photos:[{src,alt}]}`, `voices{eyebrow,headline,testimonialIds:string[]}`, `weekly{eyebrow,headline,body,ctaLabel,ctaContext}`, `classCta{eyebrow,headline,body,ctaLabel}`. Also `content.pages.home.rumba.pageLink: string`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('pages.laRumba', () => {
  const lr = () => SiteContentSchema.parse(seed).pages.laRumba;

  it('ships an intro, a hero photo and the five body blocks', () => {
    const p = lr();
    expect(p.intro.headline).toBe('La Rumba');
    expect(p.heroPhoto.src).toBe('/photos/DSC_0095.jpg');
    expect(p.reassure.items.length).toBeGreaterThanOrEqual(4);
    expect(p.gallery.photos.length).toBeGreaterThanOrEqual(6);
    expect(p.voices.testimonialIds).toContain('test-004');
    expect(p.weekly.ctaContext).toBeTruthy();
    expect(p.classCta.ctaLabel).toBeTruthy();
  });

  // The hero asks for a commitment; the weekly block asks for information.
  // Printing one sentence on both buttons reads as a copy-paste bug.
  it('gives the hero a different ask from the weekly block', () => {
    expect(lr().heroCtaLabel).not.toBe(lr().weekly.ctaLabel);
  });

  it('parses a stored document that has never heard of the page', () => {
    const doc = JSON.parse(JSON.stringify(seed));
    delete doc.pages.laRumba;
    expect(() => SiteContentSchema.parse(doc)).not.toThrow();
  });

  // The fact base lives in `tonight`, which RumbaBand already renders from and
  // never duplicates. A default that repeats the day, the hour or the venue is
  // a second copy that silently contradicts the first the night the social moves.
  it('duplicates no fact that `tonight` already owns', () => {
    const json = JSON.stringify(lr());
    for (const fact of ['Saturday', '7 PM', 'Over the Moon', 'Gachibowli']) {
      expect(json).not.toContain(fact);
    }
  });

  // Entry varies by the night and the format varies week to week (owner,
  // 2026-08-25), so a default naming a price or promising a shape is a lie the
  // moment it ships — and stored bytes would then shadow the fix forever.
  it('promises no price and no fixed format', () => {
    const json = JSON.stringify(lr());
    expect(json).not.toMatch(/₹|cover charge|entry fee/i);
    expect(json).not.toMatch(/\blesson\b|\bworkshop\b|\bset list\b/i);
  });

  // Straight apostrophes in rendered copy are a shipped regression here once
  // already ("fix: welcome La Rumba copy uses the site's typographic apostrophe").
  it('uses the typographic apostrophe throughout', () => {
    expect(JSON.stringify(lr())).not.toMatch(/[a-z]'[a-z]/i);
  });
});

describe('pages.home.rumba.pageLink', () => {
  // A blank default would ship the new page with nothing on the home page
  // pointing at it. Blank must stay possible, but as the owner's choice.
  it('defaults to real copy so the band links through out of the box', () => {
    expect(SiteContentSchema.parse(seed).pages.home.rumba.pageLink).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_ENV=test npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'headline')` on `pages.laRumba`.

- [ ] **Step 3: Write the schema**

In `src/lib/content-schema.ts`, inside `HomePageSchema`'s `rumba` object, add alongside `classLink`:

```ts
        /** Link through to /la-rumba. Defaults to real copy on purpose: a blank
         *  default would ship the page with nothing on the home page pointing at
         *  it. Blank still hides it, as everywhere else in this document — but
         *  that has to be the owner's decision, not an accident of the default. */
        pageLink: z.string().default('See what a Saturday looks like'),
```

Then add `laRumba` to `PagesSchema`, as a sibling of `about`:

```ts
    // The La Rumba page at /la-rumba.
    //
    // COPY ONLY. Every fact about the social — the day, the hour, the venue,
    // the locality — renders from `content.tonight` at request time and is
    // deliberately absent here, exactly as RumbaBand does it. The alternative
    // is two stored copies of "Saturday 7 PM at Over the Moon" that disagree
    // the night the venue changes, and nothing in the system to notice.
    //
    // What the page may not say is as load-bearing as what it says: entry is
    // paid at the venue and varies by the night, and the format varies week to
    // week (owner, 2026-08-25). So there is no price field and no schedule
    // field — the page converts to WhatsApp for both, which is the only channel
    // that can actually be current.
    laRumba: z
      .object({
        seoTitle: z.string().default(''),
        seoDescription: z.string().default(''),
        intro: PageIntroSchema.default({
          eyebrow: 'The weekly social',
          headline: 'La Rumba',
          lead: 'Our Latin social night in Hyderabad — every level on one floor, beginners very much included. Come to dance, or come to watch.',
        }),
        heroPhoto: z
          .object({ src: z.string(), alt: z.string() })
          .default({
            src: '/photos/DSC_0095.jpg',
            alt: 'A packed floor at La Rumba, mid-song',
          }),
        /** The hero's ask. Deliberately distinct from `weekly.ctaLabel`: the
         *  hero asks for a commitment ("say you're coming"), the weekly block
         *  asks for information ("what's on this Saturday?"). They share a
         *  WhatsApp context because they open the same conversation, but two
         *  buttons on one page carrying the identical sentence reads as a bug. */
        heroCtaLabel: z.string().default('Say you’re coming'),
        reassure: z
          .object({
            eyebrow: z.string().default('Before you talk yourself out of it'),
            headline: z.string().default('You don’t need a partner, or a single step.'),
            items: z
              .array(
                z.object({
                  title: z.string().default(''),
                  body: z.string().default(''),
                }),
              )
              .default([
                {
                  title: 'Come on your own.',
                  body: 'You don’t need to bring anyone. Partners change through the night — that is what makes it a social rather than a performance.',
                },
                {
                  title: 'Watching is allowed.',
                  body: 'Take a table, watch a set, leave when you like. Nobody is going to pull you onto the floor.',
                },
                {
                  title: 'Every level is in the room.',
                  body: 'All levels are welcome, and all levels turn up. Nobody is auditioning you.',
                },
                {
                  title: 'Wear what you’d wear out.',
                  body: 'Anything you can move in. Smooth soles make turning easier; nothing else matters.',
                },
              ]),
          })
          .default({}),
        gallery: z
          .object({
            eyebrow: z.string().default('The room'),
            headline: z.string().default('What a Saturday actually looks like.'),
            photos: z
              .array(z.object({ src: z.string(), alt: z.string() }))
              .default([
                { src: '/photos/DSC09776.jpg', alt: 'Two dancers laughing through a song' },
                { src: '/photos/DSC_0052.jpg', alt: 'A turn in an emerald dress — Bachata on the floor' },
                { src: '/photos/DSC09698.jpg', alt: 'Dancers on the floor at La Rumba' },
                { src: '/photos/DSC09730.jpg', alt: 'Dancers on the floor at La Rumba' },
                { src: '/photos/DSC09736.jpg', alt: 'Dancers on the floor at La Rumba' },
                { src: '/photos/DSC_0166.jpg', alt: 'Dancers on the floor at La Rumba' },
                { src: '/photos/DSC_9973.jpg', alt: 'Dancers on the floor at La Rumba' },
              ]),
          })
          .default({}),
        voices: z
          .object({
            eyebrow: z.string().default('In their words'),
            headline: z.string().default('From people who dance here.'),
            /** Resolved against `content.testimonials`; ids that no longer
             *  exist are skipped rather than rendered as a hole. */
            testimonialIds: z.array(z.string()).default(['test-004']),
          })
          .default({}),
        // The spine of the page. Entry and format both vary, so this block does
        // not hedge — it says so plainly and hands the visitor the one channel
        // that can answer for this particular Saturday.
        weekly: z
          .object({
            eyebrow: z.string().default('One thing to know'),
            headline: z.string().default('Every week is a little different.'),
            body: z
              .string()
              .default(
                'Entry is sorted at the venue, and what happens on the night changes week to week. Message us and we’ll tell you exactly what’s on this Saturday — before you travel across town.',
              ),
            ctaLabel: z.string().default('Ask what’s on this Saturday'),
            ctaContext: z.string().default('what’s on at La Rumba this Saturday'),
          })
          .default({}),
        classCta: z
          .object({
            eyebrow: z.string().default('From the floor to the classroom'),
            headline: z.string().default('Liked the room? Learn the dance.'),
            body: z
              .string()
              .default(
                'Our beginner batches run every weekend — no partner, no experience needed.',
              ),
            ctaLabel: z.string().default('See beginner batches'),
          })
          .default({}),
      })
      .default({}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_ENV=test npx vitest run src/lib/content-schema.test.ts`
Expected: PASS, including the pre-existing retired-copy sweep.

- [ ] **Step 5: Confirm the alt text is honest**

Five gallery photos default to the generic-but-true alt "Dancers on the floor at La Rumba" because only three of the eight images have descriptions anywhere in the repo. Open `public/photos/DSC09698.jpg`, `DSC09730.jpg`, `DSC09736.jpg`, `DSC_0166.jpg`, `DSC_9973.jpg` and replace each with what is actually in the frame. A generic alt is honest; an invented specific one is not. Re-run the test after editing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts
git commit -F- <<'MSG'
feat: the La Rumba page gets its own editable copy block

pages.laRumba holds copy only. Every fact about the social — day, hour, venue,
locality — keeps rendering from `tonight`, the way RumbaBand already does it,
because two stored copies of "Saturday 7 PM at Over the Moon" disagree the night
the venue changes and nothing in the system would notice.

There is deliberately no price field and no schedule field. Entry is paid at the
venue and varies by the night, and the format varies week to week, so any stored
value would be a lie that the first admin save then bakes in permanently.

Tests pin the absences as hard as the presences: no fact `tonight` owns, no
price, no promised format, and the typographic apostrophe throughout.
MSG
```

---

### Task 2: Pure helpers and the analytics source

**Files:**
- Create: `src/lib/la-rumba-page.ts`
- Create: `src/lib/la-rumba-page.test.ts`
- Modify: `src/lib/enquiry.ts`

**Interfaces:**
- Consumes: `Testimonial` type from Task 1's module (`src/lib/content-schema.ts`, already exported).
- Produces: `socialFactsLine(t: SocialFacts): string` and `resolveVoices(testimonials: Testimonial[], ids: string[]): Testimonial[]`, plus `EnquirySource` member `'la_rumba_page'`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/la-rumba-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveVoices, socialFactsLine } from './la-rumba-page';
import type { Testimonial } from './content-schema';

const t = (id: string): Testimonial =>
  ({ id, studentName: id, photo: '', text: `${id} text`, styleSlug: '', publishedAt: '2026-01-01' }) as Testimonial;

describe('socialFactsLine', () => {
  it('joins the facts the tonight block owns', () => {
    expect(
      socialFactsLine({
        when: 'Every Saturday · 7 PM',
        venueName: 'Over the Moon Brew Co',
        venueLocality: 'Gachibowli, Hyderabad',
      }),
    ).toBe('Every Saturday · 7 PM · Over the Moon Brew Co · Gachibowli, Hyderabad');
  });

  // Blank hides the element, everywhere in this document. A venue that has not
  // been filled in must not render as a dangling separator.
  it('drops blanks instead of printing empty separators', () => {
    expect(
      socialFactsLine({ when: 'Every Saturday · 7 PM', venueName: '', venueLocality: '  ' }),
    ).toBe('Every Saturday · 7 PM');
  });

  it('returns an empty string when nothing is known', () => {
    expect(socialFactsLine({ when: '', venueName: '', venueLocality: '' })).toBe('');
  });
});

describe('resolveVoices', () => {
  it('returns the named testimonials in the order the page names them', () => {
    const all = [t('a'), t('b'), t('c')];
    expect(resolveVoices(all, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a']);
  });

  // The owner can delete a testimonial from /admin at any time. The page must
  // skip the gap, not render an undefined blockquote — the same tolerance
  // pages.home.rumba.testimonialId already has.
  it('skips an id that no longer exists', () => {
    expect(resolveVoices([t('a')], ['gone', 'a']).map((x) => x.id)).toEqual(['a']);
  });

  it('returns nothing when the page names nothing', () => {
    expect(resolveVoices([t('a')], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_ENV=test npx vitest run src/lib/la-rumba-page.test.ts`
Expected: FAIL — `Cannot find module './la-rumba-page'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/la-rumba-page.ts`:

```ts
import type { Testimonial } from './content-schema';

/** The subset of `content.tonight` the page's fact strip reads. Structural
 *  rather than a slice of SiteContent, matching `Bookable` in book-label.ts:
 *  this module needs three strings, not the whole content schema. */
export interface SocialFacts {
  when: string;
  venueName: string;
  venueLocality: string;
}

/**
 * The single line of fact under the page's headline.
 *
 * Built here rather than interpolated in JSX so the blank-hiding rule is
 * tested once instead of trusted at four call sites. An unfilled venue must
 * not render as "Every Saturday · 7 PM · ·" — the dangling separators are how
 * a half-configured document looks broken rather than merely incomplete.
 */
export function socialFactsLine(t: SocialFacts): string {
  return [t.when, t.venueName, t.venueLocality]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(' · ');
}

/**
 * The testimonials this page names, in the order it names them.
 *
 * Order comes from the page, not from the testimonial list, so the owner can
 * lead with whichever voice suits the social without reordering the whole
 * collection. Ids that no longer resolve are skipped: the owner can delete a
 * testimonial in /admin at any time, and a page that renders an empty
 * blockquote for a deleted id is worse than one that quietly shows fewer.
 */
export function resolveVoices(testimonials: Testimonial[], ids: string[]): Testimonial[] {
  const out: Testimonial[] = [];
  for (const id of ids) {
    const found = testimonials.find((t) => t.id === id);
    if (found) out.push(found);
  }
  return out;
}
```

In `src/lib/enquiry.ts`, add to the `EnquirySource` union after `'rumba_band'`:

```ts
  | 'la_rumba_page'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_ENV=test npx vitest run src/lib/la-rumba-page.test.ts && npx tsc --noEmit`
Expected: 8 tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/la-rumba-page.ts src/lib/la-rumba-page.test.ts src/lib/enquiry.ts
git commit -F- <<'MSG'
feat: pure helpers for the La Rumba page's facts line and voices

socialFactsLine drops blanks rather than printing dangling separators — a
half-filled venue should read as incomplete, not broken. resolveVoices honours
the page's order rather than the collection's, and skips ids the owner has since
deleted in /admin, the same tolerance pages.home.rumba.testimonialId has.

EnquirySource gains la_rumba_page so the new page's WhatsApp clicks are
attributable in GA4 instead of being counted as the home band's.
MSG
```

---

### Task 3: The `/la-rumba` route

**Files:**
- Create: `src/app/la-rumba/page.tsx`
- Modify: `src/lib/page-meta.ts`

**Interfaces:**
- Consumes: `socialFactsLine`, `resolveVoices` (Task 2); `content.pages.laRumba` (Task 1); existing `tonightEventLd`, `trialFromInr`, `resolvePageMeta`, `EnquiryCTA`, `JsonLd`, `Img`, `Reveal`.
- Produces: the route `/la-rumba`; `PageMetaKey` gains `'laRumba'`.

- [ ] **Step 1: Add the SEO key**

In `src/lib/page-meta.ts`, add `| 'laRumba'` to the `PageMetaKey` union, change the leading comment's "eleven routes" to "twelve routes", and add to `PAGE_SEO_DEFAULTS`:

```ts
  laRumba: {
    title: 'La Rumba — Latin Social Night',
    description:
      'La Rumba, the weekly Latin social in Hyderabad. All levels welcome, no partner needed.',
  },
```

- [ ] **Step 2: Write the route**

Create `src/app/la-rumba/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicContent, visibleBatches, formatInr } from '@/lib/content';
import { resolvePageMeta } from '@/lib/page-meta';
import { trialFromInr } from '@/lib/book-label';
import { tonightEventLd } from '@/lib/tonight-event';
import { todayIso } from '@/lib/format';
import { resolveVoices, socialFactsLine } from '@/lib/la-rumba-page';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';

export async function generateMetadata() {
  const c = await getPublicContent();
  const p = c.pages.laRumba;
  const meta = resolvePageMeta('laRumba', {
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    brand: c.site.title,
    derivedDescription: p.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/la-rumba' },
    // A social that is switched off must not be indexed even if a crawler
    // still holds the URL from when it was on.
    ...(c.tonight.enabled ? {} : { robots: { index: false, follow: false } }),
  };
}

// Render per request so admin edits show immediately, matching /about.
export const dynamic = 'force-dynamic';

// The page for the half of the product that classes do not cover: PRODUCT.md's
// "classes teach; La Rumba retains".
//
// The shaping constraint is what we DON'T know. Entry is paid at the venue and
// varies by the night, and the format varies week to week (owner, 2026-08-25),
// so this page cannot publish a schedule or a price and must not invent one. A
// page that hedges four times is worthless, so the variability is made the
// mechanism instead: the permanent facts carry the page and WhatsApp answers
// "what's on this Saturday?" — the only channel that can actually be current.
export default async function LaRumbaPage() {
  const content = await getPublicContent();
  // Same gate RumbaBand and TonightFloat use. A page describing a social that
  // is switched off must not be reachable, not merely empty.
  if (!content.tonight.enabled) notFound();

  const p = content.pages.laRumba;
  const t = content.tonight;
  const facts = socialFactsLine(t);
  const voices = resolveVoices(content.testimonials, p.voices.testimonialIds);
  const trialFrom = trialFromInr(visibleBatches(content));
  const eventLd = tonightEventLd(content, todayIso());

  return (
    <>
      {eventLd ? <JsonLd data={eventLd} /> : null}

      {/* 1 — Hero. The name at wordmark scale over one real photograph. */}
      <section className="relative isolate overflow-hidden">
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
        <div className="container-x py-24 sm:py-32 lg:py-40">
          {p.intro.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.intro.eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 display text-5xl font-extrabold tracking-tight text-cream sm:text-7xl">
            {p.intro.headline}
          </h1>
          {facts ? (
            <p className="mt-4 display text-sm font-semibold uppercase tracking-widest text-gold-400">
              {facts}
            </p>
          ) : null}
          {p.intro.lead ? (
            <p className="mt-4 max-w-2xl text-lg text-cream/80">{p.intro.lead}</p>
          ) : null}
          <div className="mt-8">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'la_rumba_page', customNote: p.weekly.ctaContext }}
              variant="primary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={p.heroCtaLabel}
            />
          </div>
        </div>
      </section>

      {/* 2 — Reassure. The fears, answered before they are asked. */}
      {p.reassure.items.length > 0 ? (
        <section className="container-x py-16 sm:py-20">
          <Reveal>
            {p.reassure.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.reassure.eyebrow}
              </p>
            ) : null}
            {p.reassure.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">
                {p.reassure.headline}
              </h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {p.reassure.items.map((item, i) => (
              <div key={`${item.title}-${i}`}>
                <p className="display font-bold text-cream">{item.title}</p>
                <p className="mt-1.5 text-sm text-cream/70">{item.body}</p>
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 3 — Gallery. The strongest asset on the page: real nights. */}
      {p.gallery.photos.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            {p.gallery.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.gallery.eyebrow}
              </p>
            ) : null}
            {p.gallery.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.gallery.headline}</h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {p.gallery.photos.map((photo, i) => (
              <div
                key={`${photo.src}-${i}`}
                className={`relative overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${
                  i % 5 === 0 ? 'aspect-[4/3] sm:col-span-2' : 'aspect-square'
                }`}
              >
                <Img
                  src={photo.src}
                  alt={photo.alt}
                  seed={`la-rumba-${i}`}
                  fill
                  className="object-cover transition duration-700 hover:scale-[1.04]"
                />
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 4 — Voices. */}
      {voices.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            {p.voices.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.voices.eyebrow}
              </p>
            ) : null}
            {p.voices.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.voices.headline}</h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-6 md:grid-cols-2">
            {voices.map((v) => (
              <figure key={v.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
                <blockquote className="italic text-cream/85">&ldquo;{v.text}&rdquo;</blockquote>
                <figcaption className="mt-2 text-xs text-cream/55">— {v.studentName}</figcaption>
              </figure>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 5 — The spine. What we don't know, said plainly, with the one channel
          that does know attached to it. */}
      <section className="container-x py-12 sm:py-16">
        <Reveal className="rounded-3xl border border-ember-500/30 bg-ember-500/5 p-8 sm:p-12">
          {p.weekly.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.weekly.eyebrow}
            </p>
          ) : null}
          {p.weekly.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">
              {p.weekly.headline}
            </h2>
          ) : null}
          {p.weekly.body ? (
            <p className="mt-3 max-w-2xl text-cream/75">{p.weekly.body}</p>
          ) : null}
          <div className="mt-6">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'la_rumba_page', customNote: p.weekly.ctaContext }}
              variant="primary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={p.weekly.ctaLabel}
            />
          </div>
        </Reveal>
      </section>

      {/* 6 — Floor to classroom. The price comes from the same helper the board
          uses, so the two surfaces can never print different numbers. */}
      <section className="container-x pb-20 sm:pb-28">
        <Reveal>
          {p.classCta.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.classCta.eyebrow}
            </p>
          ) : null}
          {p.classCta.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.classCta.headline}</h2>
          ) : null}
          {p.classCta.body ? <p className="mt-3 max-w-2xl text-cream/75">{p.classCta.body}</p> : null}
          <Link
            href="/batches"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-ember-600 px-5 py-2 text-sm font-semibold text-on-ember transition hover:bg-ember-700"
          >
            {p.classCta.ctaLabel}
            {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
          </Link>
        </Reveal>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify it typechecks and the suite still passes**

Run: `npx tsc --noEmit && NODE_ENV=test npx vitest run`
Expected: typecheck clean, all tests pass.

- [ ] **Step 4: Verify the page renders**

Run: `NODE_ENV=development npx next dev` (allow ~3 min to boot on this drive), then load `http://localhost:3000/la-rumba`.

Check by eye: the hero photo loads with the name over it; the facts line reads "Every Saturday · 7 PM · Over the Moon Brew Co · Gachibowli, Hyderabad"; all four reassure items show; the gallery shows 7 photos; one testimonial renders; both WhatsApp buttons open a prefilled message mentioning this Saturday; the batches button shows a price.

Then confirm the gate: in `data/site-content.json` set `tonight.enabled` to `false`, reload, expect a 404, and **set it back to `true`**.

- [ ] **Step 5: Commit**

```bash
git add src/app/la-rumba/page.tsx src/lib/page-meta.ts
git commit -F- <<'MSG'
feat: La Rumba gets a page of its own at /la-rumba

PRODUCT.md's strategy is that classes teach and the social retains, and the
social had no page. This is it: the fears answered before they are asked, the
real photographs, the voices, and a way through to a beginner batch.

The page is shaped by what we do not know. Entry is paid at the venue and varies
by the night; the format varies week to week. So it publishes neither, and makes
that the mechanism rather than a hedge — the permanent facts carry the page and
WhatsApp answers what is on this Saturday, being the only channel that can
actually be current.

Facts render from `tonight`, never from stored page copy. The recurring-Event
node moves onto the page it actually describes. notFound() when the social is
switched off, because a page about a cancelled thing should not be reachable.
MSG
```

---

### Task 4: Nav, sitemap, and the edge-purge path

**Files:**
- Modify: `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/lib/label-defaults.ts`
- Modify: `src/lib/public-urls.ts`, `src/lib/public-urls.test.ts`
- Modify: `src/app/sitemap.ts`, `src/components/Header.tsx`, `src/components/Footer.tsx`

**Interfaces:**
- Consumes: the `/la-rumba` route (Task 3).
- Produces: `navItemsFor(opts: { socialEnabled: boolean }): NavItem[]`, label key `navLaRumba`.

> **Spec correction — do NOT edit `LabelsEditor.tsx`.** The spec claims `labels-wired.test.ts` fails a label key with no admin field. That is backwards. The test excludes `src/app/admin/**` and requires a key to be rendered **outside** the admin; `NAV_LABEL_KEY` in `nav.ts` satisfies it. And `LabelsEditor` groups keys by *prefix* (`k.startsWith('nav')`), so `navLaRumba` appears in its "Menu items" group automatically. Editing it is unnecessary.

- [ ] **Step 1: Write the failing tests**

In `src/lib/nav.test.ts`, update the pinned id list and add the filtering describe:

```ts
  it('ships the nine primary destinations Header and Footer share', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'home',
      'about',
      'dance-styles',
      'instructors',
      'batches',
      'la-rumba',
      'blog',
      'faqs',
      'contact',
    ]);
  });
```

Add at the end of the file (and extend the import to `import { NAV_ITEMS, navItemsFor, navLabel } from './nav';`):

```ts
describe('navItemsFor', () => {
  it('offers La Rumba while the social is running', () => {
    expect(navItemsFor({ socialEnabled: true }).map((i) => i.id)).toContain('la-rumba');
  });

  // /la-rumba returns notFound() when the social is switched off, so a menu
  // item pointing at it would be a link to a 404 — worse than no link at all.
  it('drops La Rumba when the social is switched off', () => {
    expect(navItemsFor({ socialEnabled: false }).map((i) => i.id)).not.toContain('la-rumba');
  });

  it('changes nothing else either way', () => {
    const on = navItemsFor({ socialEnabled: true }).map((i) => i.id);
    const off = navItemsFor({ socialEnabled: false }).map((i) => i.id);
    expect(on.filter((id) => id !== 'la-rumba')).toEqual(off);
  });

  it('resolves a label for the new destination', () => {
    expect(navLabel(byId('la-rumba'), labels())).toBe('La Rumba');
  });
});
```

In `src/lib/public-urls.test.ts`, extend the static-route assertion:

```ts
  it('includes every static public route', () => {
    const paths = publicPathsFor(doc());
    for (const p of ['/', '/about', '/batches', '/contact', '/faqs', '/instructors', '/la-rumba', '/sitemap.xml']) {
      expect(paths).toContain(p);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_ENV=test npx vitest run src/lib/nav.test.ts src/lib/public-urls.test.ts`
Expected: FAIL — `navItemsFor` is not exported, id list mismatch, `/la-rumba` missing.

- [ ] **Step 3: Implement**

`src/lib/label-defaults.ts` — add beside the other nav labels:

```ts
  navLaRumba: 'La Rumba',
```

`src/lib/nav.ts` — add the item after `batches` (classes first, then the social), the label mapping, and the filter:

```ts
  { id: 'la-rumba', href: '/la-rumba' },
```

```ts
  'la-rumba': 'navLaRumba',
```

```ts
/**
 * The nav, minus destinations that are currently switched off.
 *
 * /la-rumba returns notFound() when `tonight.enabled` is false, so its menu
 * entry has to vanish with it — a nav item pointing at a 404 is worse than no
 * nav item. Header and Footer both read this instead of NAV_ITEMS directly, so
 * the desktop menu, the mobile menu and the footer cannot drift apart.
 */
export function navItemsFor(opts: { socialEnabled: boolean }): NavItem[] {
  return NAV_ITEMS.filter((item) => item.id !== 'la-rumba' || opts.socialEnabled);
}
```

`src/lib/public-urls.ts` — add to `STATIC_PATHS`, after `'/batches'`:

```ts
  '/la-rumba',
```

`src/app/sitemap.ts` — add to `fixed`, after the `/batches` entry:

```ts
    { url: `${BASE}/la-rumba`, changeFrequency: 'weekly', priority: 0.8 },
```

`src/components/Header.tsx` — change the import to `import { navItemsFor, navLabel, type NavItem } from '@/lib/nav';` and replace `NAV_ITEMS.map((item) => {` with:

```tsx
  const navWithDropdowns: NavWithChildren[] = navItemsFor({
    socialEnabled: content.tonight.enabled,
  }).map((item) => {
```

`src/components/Footer.tsx` — change the import to `import { navItemsFor, navLabel } from '@/lib/nav';` and replace `NAV_ITEMS.filter(` with `navItemsFor({ socialEnabled: content.tonight.enabled }).filter(`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_ENV=test npx vitest run && npx tsc --noEmit`
Expected: all tests pass (including `labels-wired.test.ts`, which now finds `navLaRumba` quoted in `nav.ts`), typecheck clean.

- [ ] **Step 5: Verify the sitemap by hand**

`src/app/sitemap.ts` has **no test coverage at all**, so a green suite proves nothing here. With `next dev` running, load `http://localhost:3000/sitemap.xml` and confirm `https://www.dancehyderabad.com/la-rumba` appears.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts src/lib/label-defaults.ts src/lib/public-urls.ts src/lib/public-urls.test.ts src/app/sitemap.ts src/components/Header.tsx src/components/Footer.tsx
git commit -F- <<'MSG'
feat: /la-rumba joins the nav, the sitemap and the purge list

The nav entry is filtered rather than static: the route 404s when the social is
switched off, and a menu item pointing at a 404 is worse than no menu item.
Header and Footer both read navItemsFor() so the desktop menu, the mobile menu
and the footer cannot drift apart.

STATIC_PATHS is the one that would have bitten silently. It is not the sitemap —
it feeds revalidatePath() and the Cloudflare purge after a published save, so a
route missing from it is cached and never purged, and every edit the owner makes
to the page appears to do nothing until the cache expires on its own.
MSG
```

---

### Task 5: The admin editor

**Files:**
- Create: `src/app/admin/pages/la-rumba/page.tsx`
- Create: `src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx`
- Modify: `src/app/admin/pages/page.tsx`

**Interfaces:**
- Consumes: `content.pages.laRumba` (Task 1).
- Produces: the `/admin/pages/la-rumba` screen.

- [ ] **Step 1: Write the guarded shell**

Create `src/app/admin/pages/la-rumba/page.tsx`:

```tsx
import Link from 'next/link';
import { getContent } from '@/lib/content';
import { LaRumbaPageEditor } from './LaRumbaPageEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('pages');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · La Rumba
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">La Rumba page</h1>
      <p className="mt-2 text-cream/70">
        Edit the copy, photos and calls to action on the public <code>/la-rumba</code> page.
      </p>
      <LaRumbaPageEditor initial={c} />
    </div>
  );
}
```

`requireWriteAccess('pages')` is the capability the other page editors use — not the blanket `requireSubject()`. `admin-pages-guarded.test.ts` accepts any of the three guards, but this is the correct one for a page editor.

- [ ] **Step 2: Write the editor**

Create `src/app/admin/pages/la-rumba/LaRumbaPageEditor.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { SiteContent, Pages } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { ImageGalleryEditor } from '@/components/admin/ImageUploader';
import { SeoFields } from '@/components/admin/SeoFields';
import { saveSiteContent } from '@/lib/admin-save';
import { useAutosave } from '@/lib/autosave';
import { AutosaveBanner } from '@/components/admin/AutosaveBanner';

type LaRumbaPage = Pages['laRumba'];

export function LaRumbaPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  // Subtree only, matching the other page editors: stashing the whole document
  // means a restore reverts every section this tab holds a stale copy of.
  const autosave = useAutosave('pages.laRumba', c.pages.laRumba, dirty);

  function patch(p: Partial<LaRumbaPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, laRumba: { ...prev.pages.laRumba, ...p } },
    }));
    setDirty(true);
  }

  const p = c.pages.laRumba;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
    autosave.clear();
  }

  return (
    <>
      {autosave.stash ? (
        <AutosaveBanner
          savedAt={autosave.stash.savedAt}
          matchesVersion={autosave.stashMatchesVersion}
          onRestore={() => {
            const laRumba = autosave.stash!.value;
            setC((prev) => ({ ...prev, pages: { ...prev.pages, laRumba } }));
            setDirty(true);
            autosave.clear();
          }}
          onDiscard={autosave.clear}
        />
      ) : null}

      <div className="mt-8 grid gap-5">
        {/* The whole reason this page gets a real editor instead of a generic
            custom page. Without this notice someone types "Saturday 7 PM" into
            a copy field and cannot work out why editing it changes nothing. */}
        <p className="rounded-2xl border border-ember-500/30 bg-ember-500/5 p-4 text-sm text-cream/75">
          The day, the time and the venue are <strong>not</strong> edited here — they
          come from <strong>Site → the social block</strong>, and this page reads them
          live. Change them once, there, and every surface follows.
        </p>

        <SeoFields
          pageKey="laRumba"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patch(next)}
        />

        <Section title="Header">
          <PageIntroFields value={p.intro} onChange={(v) => patch({ intro: v })} />
          <Field label="Hero photo" hint="The full-width photo behind the page title.">
            <ImageGalleryEditor
              label="Hero photo"
              values={p.heroPhoto.src ? [p.heroPhoto.src] : []}
              onChange={(srcs) =>
                patch({ heroPhoto: { ...p.heroPhoto, src: srcs[0] ?? '' } })
              }
            />
          </Field>
          <Field label="Hero photo description" hint="Read aloud by screen readers.">
            <input
              value={p.heroPhoto.alt}
              onChange={(e) => patch({ heroPhoto: { ...p.heroPhoto, alt: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Hero button" hint="The main ask at the top of the page.">
            <input
              value={p.heroCtaLabel}
              onChange={(e) => patch({ heroCtaLabel: e.target.value })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="Reassurance">
          <Field label="Eyebrow">
            <input
              value={p.reassure.eyebrow}
              onChange={(e) => patch({ reassure: { ...p.reassure, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.reassure.headline}
              onChange={(e) => patch({ reassure: { ...p.reassure, headline: e.target.value } })}
              className="input"
            />
          </Field>
          {p.reassure.items.map((item, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-cream/10 p-3">
              <Field label={`Point ${i + 1} — title`}>
                <input
                  value={item.title}
                  onChange={(e) => {
                    const items = p.reassure.items.slice();
                    items[i] = { ...items[i], title: e.target.value };
                    patch({ reassure: { ...p.reassure, items } });
                  }}
                  className="input"
                />
              </Field>
              <Field label={`Point ${i + 1} — body`}>
                <textarea
                  rows={2}
                  value={item.body}
                  onChange={(e) => {
                    const items = p.reassure.items.slice();
                    items[i] = { ...items[i], body: e.target.value };
                    patch({ reassure: { ...p.reassure, items } });
                  }}
                  className="input"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      reassure: {
                        ...p.reassure,
                        items: p.reassure.items.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove point
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() =>
                patch({
                  reassure: {
                    ...p.reassure,
                    items: [...p.reassure.items, { title: '', body: '' }],
                  },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add point
            </button>
          </div>
        </Section>

        <Section title="Gallery">
          <Field label="Eyebrow">
            <input
              value={p.gallery.eyebrow}
              onChange={(e) => patch({ gallery: { ...p.gallery, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.gallery.headline}
              onChange={(e) => patch({ gallery: { ...p.gallery, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <ImageGalleryEditor
            label="Photos"
            values={p.gallery.photos.map((x) => x.src)}
            onChange={(srcs) => {
              const photos = srcs.map((src, i) => ({
                src,
                alt: p.gallery.photos[i]?.alt ?? '',
              }));
              patch({ gallery: { ...p.gallery, photos } });
            }}
          />
          {p.gallery.photos.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-widest text-cream/60">
                Description for each photo (for accessibility)
              </p>
              {p.gallery.photos.map((photo, i) => (
                <Field key={i} label={`Photo ${i + 1}`}>
                  <input
                    value={photo.alt}
                    onChange={(e) => {
                      const photos = p.gallery.photos.slice();
                      photos[i] = { ...photos[i], alt: e.target.value };
                      patch({ gallery: { ...p.gallery, photos } });
                    }}
                    className="input"
                  />
                </Field>
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="Voices">
          <Field label="Eyebrow">
            <input
              value={p.voices.eyebrow}
              onChange={(e) => patch({ voices: { ...p.voices, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.voices.headline}
              onChange={(e) => patch({ voices: { ...p.voices, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="Testimonial IDs"
            hint="Comma-separated, in the order they should appear. Edit the testimonials themselves under Testimonials. An ID that no longer exists is skipped."
          >
            <input
              value={p.voices.testimonialIds.join(', ')}
              onChange={(e) =>
                patch({
                  voices: {
                    ...p.voices,
                    testimonialIds: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
                  },
                })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Every week is different">
          <p className="text-xs text-cream/50">
            The block that says entry is sorted at the venue and the night changes.
            Keep it confident — it is the reason someone messages instead of guessing.
          </p>
          <Field label="Eyebrow">
            <input
              value={p.weekly.eyebrow}
              onChange={(e) => patch({ weekly: { ...p.weekly, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.weekly.headline}
              onChange={(e) => patch({ weekly: { ...p.weekly, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={3}
              value={p.weekly.body}
              onChange={(e) => patch({ weekly: { ...p.weekly, body: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Button label">
            <input
              value={p.weekly.ctaLabel}
              onChange={(e) => patch({ weekly: { ...p.weekly, ctaLabel: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="WhatsApp message context"
            hint="Filled into the prefilled message, e.g. “what’s on at La Rumba this Saturday”."
          >
            <input
              value={p.weekly.ctaContext}
              onChange={(e) => patch({ weekly: { ...p.weekly, ctaContext: e.target.value } })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="Link to classes">
          <Field label="Eyebrow">
            <input
              value={p.classCta.eyebrow}
              onChange={(e) => patch({ classCta: { ...p.classCta, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.classCta.headline}
              onChange={(e) => patch({ classCta: { ...p.classCta, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={p.classCta.body}
              onChange={(e) => patch({ classCta: { ...p.classCta, body: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Button label" hint="The first-class price is added automatically.">
            <input
              value={p.classCta.ctaLabel}
              onChange={(e) => patch({ classCta: { ...p.classCta, ctaLabel: e.target.value } })}
              className="input"
            />
          </Field>
        </Section>
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">{title}</p>
      {children}
    </div>
  );
}
```

Note `SeoFields pageKey="laRumba"` — this only typechecks once Task 3 has added `'laRumba'` to `PageMetaKey`. Do Task 3 first.

- [ ] **Step 3: Add the index card**

In `src/app/admin/pages/page.tsx`, add to the `PAGES` array after the Batches index entry:

```ts
  { href: '/admin/pages/la-rumba', label: 'La Rumba', desc: 'The social page at /la-rumba — intro, reassurance, gallery, voices, CTAs' },
```

- [ ] **Step 4: Verify**

Run: `NODE_ENV=test npx vitest run src/lib/admin-pages-guarded.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

Then with `next dev` running, log into `/admin`, open `/admin/pages/la-rumba`, change the intro headline, save, and confirm `/la-rumba` shows the change. That round trip is what proves the editor is actually wired — a rendering form that does not persist looks identical to one that does.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/pages/la-rumba src/app/admin/pages/page.tsx
git commit -F- <<'MSG'
feat: the owner can edit the La Rumba page without a deploy

Follows the About editor's shape rather than inventing a second one. The notice
at the top of the form is the point: day, time and venue are not editable here,
because the page reads them live from the social block. Without it, someone types
a second copy of "Saturday 7 PM" into a copy field and cannot work out why
editing it changes nothing on the site.
MSG
```

---

### Task 6: The home band becomes an entrance

**Files:**
- Modify: `src/components/RumbaBand.tsx`, `src/app/globals.css`
- Modify: `src/app/admin/pages/home/HomePageEditor.tsx`

**Interfaces:**
- Consumes: `pages.home.rumba.pageLink` (Task 1); the `/la-rumba` route (Task 3).
- Produces: no new exports.

- [ ] **Step 1: Add the CSS utilities**

In `src/app/globals.css`, inside the same `@layer components` block that defines `.container-x`:

```css
  /* Escapes the page's shared max-width so a section can span the viewport.
     The band is not badly built — it is invisible, because it has the same
     container width, the same ground and the same rhythm as every other
     section on the page. Breaking the container is the gear change. */
  .full-bleed {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
  }
  /* The band's own night.
     
     Its photographs are of a dark room, and the light theme's cream ground
     flattens them into thumbnails. This section therefore stays dark in BOTH
     themes.
     
     CAREFUL — the colour tokens are ROLE-based and invert with the theme:
     --c-ink-950 is a near-white (247 243 236) on light and near-black
     (11 7 9) on dark, and --c-cream is the exact opposite. So a naive
     `background: rgb(var(--c-ink-950))` here renders CREAM in light mode —
     the opposite of the intent.
     
     Redeclaring the dark values on this element is what makes it work: every
     descendant utility (text-cream/70, border-cream/10, text-ember-400,
     bg-ink-900/40) resolves against these instead of the page's, so the whole
     subtree is simply "in dark mode" without touching a single child class.
     Values copied verbatim from html[data-theme='dark']. */
  .rumba-night {
    color-scheme: dark;
    --c-ink-950: 11 7 9;
    --c-ink-900: 21 12 16;
    --c-ink-800: 29 16 21;
    --c-ink-700: 40 22 29;
    --c-ink-500: 74 34 48;
    --c-ember-300: 250 140 140;
    --c-ember-400: 240 60 60;
    --c-ember-500: 224 16 16;
    --c-ember-600: 200 0 0;
    --c-ember-700: 160 0 16;
    --c-gold-400: 80 128 232;
    --c-gold-500: 40 88 200;
    --c-cream: 246 239 231;
    --art-bg-a: #1d1015;
    --art-bg-b: #0b0709;
    --art-accent: #e01010;
    --art-accent-2: #a00010;
    --art-gold: #2858c8;
    --art-fg: #f6efe7;
    background:
      radial-gradient(120% 100% at 50% 0%, rgb(var(--c-ember-600) / 0.18), transparent 60%),
      rgb(var(--c-ink-950));
    color: rgb(var(--c-cream));
  }
```

If either token block in `globals.css` gains a colour later, this list needs the same addition — the alternative (a `[data-theme]` wrapper) cannot work here, because the section must be dark while the page around it is light.

- [ ] **Step 2: Apply them to the band**

In `src/components/RumbaBand.tsx`, change the opening `<section>` to wrap its content in a bleed:

```tsx
    <section className="full-bleed rumba-night py-16 sm:py-24">
      <div className="container-x">
```

and close the extra `</div>` before `</section>`. Bump the photo grid so the images carry more weight on the wider ground:

```tsx
        <Reveal stagger className="mt-10 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
```

- [ ] **Step 3: Add the link through**

In `RumbaBand.tsx`, in the final `<Reveal>` row, after the existing `classLink` `<Link>`:

```tsx
        {r.pageLink ? (
          <Link
            href="/la-rumba"
            className="inline-flex min-h-[44px] items-center py-2 text-sm font-semibold text-ember-400 underline decoration-ember-400/40 underline-offset-4 transition hover:text-ember-300"
          >
            {r.pageLink} →
          </Link>
        ) : null}
```

- [ ] **Step 4: Expose the field in the admin**

In `src/app/admin/pages/home/HomePageEditor.tsx`, beside the existing `classLink` field:

```tsx
            <Field label="Link to the La Rumba page" hint="Blank hides the link.">
              <input
                value={h.rumba.pageLink}
                onChange={(e) => patchRumba({ pageLink: e.target.value })}
                className="input"
              />
            </Field>
```

- [ ] **Step 5: Verify visually**

Run: `npx tsc --noEmit && NODE_ENV=test npx vitest run`, then with `next dev` running load `/` and check the band at **1600px and 390px, in both light and dark themes** (the theme toggle is in the header).

The section should span the full viewport width with no horizontal scrollbar, sit visibly darker than the sections above and below it in light theme, and show a working link to `/la-rumba`. Horizontal overflow is the classic `100vw` failure — if a scrollbar appears, that is this change, not a pre-existing bug.

- [ ] **Step 6: Commit**

```bash
git add src/components/RumbaBand.tsx src/app/globals.css src/app/admin/pages/home/HomePageEditor.tsx
git commit -F- <<'MSG'
feat: the home La Rumba band reads like a night, and leads somewhere

The band was not badly built, it was invisible: same container width, same
ground and same rhythm as every other section, with photographs of a dark room
flattened by the light theme. It now breaks full-bleed and carries its own night
in both themes, so the scroll changes gear when it arrives.

It also stops being a dead end — pageLink takes the reader to /la-rumba, and
defaults to real copy so the new page is reachable from home the moment it ships.
MSG
```

---

## Final verification

- [ ] `NODE_ENV=test npx vitest run` — all green (expect 724 + ~15 new).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `/la-rumba` renders; `/sitemap.xml` lists it; nav shows "La Rumba".
- [ ] Set `tonight.enabled` false → page 404s AND the nav item disappears. Set it back to true.
- [ ] Edit the page in `/admin/pages/la-rumba`, save, confirm the change appears on `/la-rumba`.
- [ ] Home band: full-bleed, dark in both themes, no horizontal scrollbar at 390px, links through.

## Owner review before shipping

The reassurance copy in Task 1 (`reassure.items`) makes claims about how the night feels — "partners change through the night", "nobody is going to pull you onto the floor". These follow from "all levels welcome" and from how social dancing works, but they are the owner's promises to make, not mine. **Have the owner read those four items before this goes to production.** Every one is editable in `/admin/pages/la-rumba`, so correcting them costs nothing — but they will be baked into R2 on first save, so correcting them *before* that save is much cheaper than after.
