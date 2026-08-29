# La Rumba — a page of its own — design

**Date:** 2026-08-25
**Branch:** conversion-journey
**Status:** approved, ready to plan

## Goal

Give La Rumba — the weekly Latin social — a first-class page at `/la-rumba`, and
make its home-page section read like a night out rather than another content
band. One URL to paste into an Instagram bio, and one place that answers what a
nervous first-timer actually wants to know.

PRODUCT.md already states the strategy this serves: *"Classes teach; La Rumba
retains. The social is the product."* The social currently has no page.

## The fact base — what is actually true

The truth constraint on this codebase is absolute, so the page is built from
these and nothing else. Confirmed from `tonight` in the live content document
and from the owner on 2026-08-25:

| Fact | Value | Source |
|---|---|---|
| Name | La Rumba · Latin Social | `tonight.headline` |
| When | Every Saturday · 7 PM | `tonight.when`, `weekday`, `startTime` |
| Where | Over the Moon Brew Co, Gachibowli, Hyderabad | `tonight.venueName`, `venueLocality` |
| Who | All levels welcome | `tonight.body` |
| Entry | Paid at the venue; **varies by the night** | owner, 2026-08-25 |
| Format | **Varies week to week** — no fixed lesson or set list | owner, 2026-08-25 |
| End time | Not known | `tonight.endTime` is empty |
| Themed editions | Not a current concern; weekly social only | owner, 2026-08-25 |
| Photography | 8 real event photos in `public/photos` | filesystem |

**What we may not say:** a price, a cover charge, a door time other than 7 PM,
an end time, a lesson-then-social structure, or that an edition is coming.

## The central design decision

Entry varies and format varies, so the page **cannot publish a schedule or a
price**. A page that repeats "it varies" is worthless, and inventing a number is
forbidden.

So the variability becomes the mechanism rather than a hedge: the four permanent
facts carry the page, and **WhatsApp answers "what's on this Saturday?"** This is
the only channel that can actually be current, it is already the site's primary
conversion surface (`EnquiryCTA` everywhere), and it turns the one soft spot in
the fact base into the reason to make contact.

Every CTA on the page follows from this. The page does not apologise for not
knowing; it tells you exactly who does.

## Approach decision — a real route, not a custom page

`/p/la-rumba` via the existing admin custom-page system would need zero code.
Rejected for three reasons:

1. **The facts would go stale.** `RumbaBand` deliberately renders day, time and
   venue from `tonight` and never duplicates them (see its header comment). A
   custom page hardcodes "Saturday 7 PM at Over the Moon" into prose, and the day
   the venue changes the site contradicts itself in two places.
2. **No Event structured data.** `tonightEventLd()` already builds a valid
   recurring-Event node with venue and schedule. A dedicated event page is that
   node's strongest home; today it sits on `/`.
3. **`/la-rumba` is the better URL** than `/p/la-rumba` for a brand name that
   goes in bios and on posters for years.

## Phase 1 — Schema (`src/lib/content-schema.ts`)

Add `pages.laRumba`. All copy editable, defaults reproducing the shipped page so
a document that has never been edited renders correctly.

```
laRumba: {
  seoTitle: string = ''            // blank falls back to PAGE_SEO_DEFAULTS
  seoDescription: string = ''
  intro: PageIntroSchema           // eyebrow, headline, lead
  heroPhoto: { src, alt }
  // Block 2 — the fear block. Same shape as pages.home.board.countIn, which
  // already answers the four documented beginner fears on the booking board.
  reassure: { eyebrow, headline, items: [{ title, body }] }
  gallery: { eyebrow, headline, photos: [{ src, alt }] }
  voices: { eyebrow, headline, testimonialIds: string[] }
  // Block 5 — the honest logistics block. The spine of the page.
  weekly: { eyebrow, headline, body, ctaLabel, ctaContext }
  classCta: { eyebrow, headline, body, ctaLabel }
}
```

Facts are **never** duplicated into these fields. Day, time, venue and locality
render from `content.tonight` at render time, exactly as `RumbaBand` does.

`voices.testimonialIds` resolves against `content.testimonials`, falling back to
an empty section when an id no longer exists — the same tolerance
`pages.home.rumba.testimonialId` already applies.

## Phase 2 — The route (`src/app/la-rumba/page.tsx`)

Server component. `export const dynamic = 'force-dynamic'` so admin edits appear
without a redeploy, matching `/about`.

Seven blocks:

1. **Hero** — "La Rumba" at wordmark scale over `heroPhoto`, full-bleed. One
   facts line built live from `tonight`. Primary CTA: `EnquiryCTA` asking
   *"what's on this Saturday?"*
2. **Reassure** — `reassure.items` in the count-in idiom. All levels, no partner,
   come and watch.
3. **Gallery** — `gallery.photos`, using all 8 real photos rather than 3.
4. **Voices** — testimonials resolved from `voices.testimonialIds`.
5. **Every week is different** — `weekly`. States plainly that entry is paid at
   the venue and the night changes, and converts to WhatsApp. Stated with
   confidence, not as an apology.
6. **Floor to classroom** — `classCta`, linking `/batches` and the first-class
   price via `trialFromInr()` so the number can never disagree with the board.
7. **`JsonLd`** with `tonightEventLd(content, todayIso())`.

Returns `notFound()` when `tonight.enabled` is false — the same gate `RumbaBand`
and `TonightFloat` already use. A page about a social that is switched off must
not be reachable or indexed.

## Phase 3 — Nav, SEO, sitemap

- `src/lib/nav.ts`: add `{ id: 'la-rumba', href: '/la-rumba' }` and a
  `'la-rumba': 'navLaRumba'` entry in `NAV_LABEL_KEY`. Placed after `batches` —
  classes first, then the social.
- `src/lib/label-defaults.ts`: `navLaRumba: 'La Rumba'`.
- `src/app/admin/labels/LabelsEditor.tsx`: surface `navLaRumba`.
  **Required** — `labels-wired.test.ts` fails a label key with no admin field.
- `src/lib/page-meta.ts`: add `'laRumba'` to `PageMetaKey` and
  `PAGE_SEO_DEFAULTS`. Update the "eleven routes" comment to twelve.
- `src/app/sitemap.ts`: add `/la-rumba` to `fixed`, `changeFrequency: 'weekly'`,
  `priority: 0.8`. It is a weekly event page and should be crawled as one.
- `src/lib/public-urls.ts`: add `/la-rumba` to `STATIC_PATHS`. **Easy to miss
  and it breaks the admin.** This list is not the sitemap — it feeds
  `revalidatePath()` and the Cloudflare edge purge after a published save. A
  route absent from it is cached but never purged, so every edit the owner makes
  to the La Rumba page appears to do nothing until the cache expires on its own.

### The nav item and the page must agree

The route returns `notFound()` when `tonight.enabled` is false, so the nav entry
has to disappear with it — a nav link to a 404 is worse than no link. `Header`
renders `NAV_ITEMS` statically today, so filtering is a real (small) change:
filter the item out when the social is switched off, in both the desktop and
mobile nav lists. `nav.test.ts` covers the resulting rule.

## Phase 4 — Admin editor

- `src/app/admin/pages/la-rumba/page.tsx` + `LaRumbaPageEditor.tsx`, following
  `AboutPageEditor` — the closest existing shape (intro + gallery + sections).
- Must call `requireSubject()`; `admin-pages-guarded.test.ts` fails any admin
  page that does not guard server-side.
- Add a card to the `PAGES` list in `src/app/admin/pages/page.tsx`.
- The editor states, in a hint, that day / time / venue are **not** edited here —
  they come from the Site editor's social block — so nobody types a second copy
  of a fact into the page and then wonders why it does not change.

## Phase 5 — The home band (`src/components/RumbaBand.tsx`)

The band is not badly built; it is *invisible*. It has the same container width,
the same background and the same rhythm as every other section, while its
photography is of a dark room being shown on a light page.

1. **Break the container.** Full-bleed out of `container-x` so the section is a
   visible gear change in the scroll rather than another row.
2. **Carry its own night treatment** in both themes, so the photographs read as a
   Saturday night instead of being flattened by the light theme.
3. **A way in.** The existing `classLink` keeps pointing at `#start-this-week`;
   add a link to `/la-rumba` so the band becomes an entrance rather than a
   terminus. New editable field `pageLink` on `pages.home.rumba`. It **defaults
   to a real label**, not to blank — a blank default would ship the new page with
   nothing on the home page pointing at it. Blank still hides it, as everywhere
   else, but that has to be a choice the owner makes.

No change to what the band *says* — its copy is already right and already
editable.

## Cross-cutting constraints

- **Truth.** Only the fact base above. No price, no end time, no format promise.
- **The retired word may not come back.** `content-schema.test.ts`'s
  retired-copy sweep walks schema defaults as well as seed prose and fails if the
  word the studio stopped using (for a single paid class) reappears in any new
  default. Write the new copy in the "first class" vocabulary.
- **Stored bytes shadow defaults forever.** The first admin save bakes the
  then-current defaults into R2, so a default that is wrong at ship time cannot
  be fixed later by editing the default. Get the defaults right once.
- **Server-rendered.** No new client component; `EnquiryCTA` is already on every
  route. `client-bundle.test.ts` guards this.
- **Facts render from `tonight`.** Never duplicated into `pages.laRumba`.
- **Blank hides the element** — the convention throughout this document.

## Testing

- `src/lib/la-rumba-page.test.ts` — new pure helpers: testimonial resolution from
  `voices.testimonialIds` (including a stale id), and the facts line built from
  `tonight`.
- `content-schema.test.ts` — `pages.laRumba` defaults parse; a document with no
  `laRumba` key still parses; the retired word appears in no new default.
- `labels-wired.test.ts` — passes with `navLaRumba` (proves the admin field
  exists).
- `admin-pages-guarded.test.ts` — passes with the new admin page.
- `nav.test.ts` — the new item resolves a label, and drops out of the nav when
  the social is switched off.
- `public-urls.test.ts` — `/la-rumba` is in `STATIC_PATHS`, so an admin save
  actually purges it.
- `src/app/sitemap.ts` has **no test coverage at all** today, so the sitemap
  entry is verified by reading the rendered `/sitemap.xml` once, by hand. Worth
  knowing rather than assuming a green suite proves it.
- Visual: the page and the reshaped band at 390px and 1600px, both themes.

## Deliverables

1. `pages.laRumba` schema + defaults.
2. `/la-rumba` route, seven blocks, Event JSON-LD, `notFound()` when disabled.
3. Nav entry (hidden when the social is off), label key, page meta, sitemap,
   and `STATIC_PATHS` so admin edits purge.
4. `/admin/pages/la-rumba` editor + index card + guard.
5. Full-bleed night treatment for `RumbaBand` + `pageLink` through to the page.
6. The tests above, green, plus typecheck.

## Out of scope (explicitly deferred)

- **The announcement widget.** Wiring the dead `content.trial` block — which is
  `enabled: true` in production today and renders nowhere since its render site
  was cut on 2026-08-24 — plus a placement control (banner / float / both / off),
  site-wide, mobile-safe, in its own clearly-named admin section. Owner deferred
  this to its own spec on 2026-08-25. **This is a live bug: the owner has content
  switched on that no visitor can see.** It should be the next spec, not a
  someday.
- **Themed editions.** Christmas Ball and Pool Party stay as Stories posts. No
  editions section, and no implication that another one is scheduled.
- **A ticketing or RSVP system.** WhatsApp is the RSVP.
