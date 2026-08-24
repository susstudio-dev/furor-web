# Conversion journey improvements — design

Date: 2026-08-24. Status: approved direction (owner picked: everything phased · La Rumba "two front doors" · proof band replaces the strip · copy fixes local + /admin checklist).

Source: dual-agent critique of the public journey, persisted at `.impeccable/critique/2026-08-24T07-00-42Z__src-app-page-tsx.md` (score 20/40; 3 P0, 5 P1). This spec turns its accepted findings into buildable changes.

## Goal

Raise trial-booking and WhatsApp conversion for the primary user (nervous Hyderabad beginner on a phone, arriving from Instagram) without breaking the binding constraints: perf budget (no net client-JS growth), truth constraint (only real proof), all public copy admin-editable, Workers free plan.

## Approach decision

Two structural options existed for the P0 "inventory lapses silently" problem:

- **A (chosen): grace-window on batches.** Batches stay publicly bookable past `startDate` until an explicit or defaulted `joinUntil`; /admin warns when a style's Foundation inventory runs dry. Small diff, no ops retraining; the Terms already promise mid-batch joins.
- **B (rejected for now): evergreen "first class" product** sold date-less, next batch resolved server-side. Kills the failure mode permanently but reprices the content model, admin workflow, and Razorpay page mapping. Revisit if grace windows prove insufficient.

Similarly, /batches keeps its existing browser layout and only adopts the board's price grammar (no full "board with filters" rebuild).

## Phase 0 — Owner actions on production (no code; blocks real conversion today)

Delivered as a paste-ready checklist (see Deliverables). Items:

1. Refresh the five lapsed batches in /admin/batches with real upcoming dates (today only WCS `batch-ua7f9x`, 2026-08-29, is visible; the board goes empty on 2026-08-30).
2. Re-enable the Razorpay webhook and re-put the secret (deactivated in the Vercel→CF cutover; `/lib/welcome-confirm.ts` designates the webhook log as the real payment record).
3. For every Razorpay Payment Page: verify the post-payment redirect points at `https://dancehyderabad.com/welcome/<track>?d=<startDate>` (the live WCS batch needs `/welcome/wcs?d=2026-08-29`).
4. Clear `https://forms.gle/…` out of batch-004's `razorpayLink` (empty link makes WhatsApp the CTA automatically, per `BatchActions`). "No forms" is a public promise.
5. Review/adjust `seatsLeft` and `status` values ("Filling Fast" at 20/20 seats reads as a lie).

## Phase 1 — Funnel-truth guardrails (code)

### 1.1 `joinUntil` grace window

- Schema (`src/lib/content-schema.ts`): optional `joinUntil` (ISO date string) on `Batch`.
- Visibility (`src/lib/content-helpers.ts` `visibleBatches`): a batch is visible while `today <= (joinUntil ?? startDate + 14 days)`. Date math in IST business dates, consistent with `todayIso()`.
- Labeling: wherever a "Starts {date}" template renders for a batch whose `startDate < today`, render a started-variant template instead — new template keys with defaults, e.g. board `startedTemplate` default `"Started {date} · you can still join"`; equivalents for the /batches rows and StyleFinder result. The WhatsApp prefill for a started batch says "that started {date}" rather than "starting {date}".
- Admin: `/admin/batches` editor exposes `joinUntil` (optional date field, helper text explaining the 14-day default).
- PRODUCT.md line "Batches auto-hide when `startDate` is past" is updated to describe the grace window.

### 1.2 Admin funnel-health warnings

Non-blocking banners on `/admin/batches`, same visual pattern as the webhook-silence banner on `/admin/payments`:

- **Zero-inventory:** any dance style with zero visible Foundation batches (using the new visibility rule) — lists the styles.
- **Suspicious payment link:** any batch whose `razorpayLink` host is not `razorpay.com`, a `*.razorpay.com` subdomain, or `rzp.io` — lists batch + host. Warning only; the save path never rejects.
- **Lapsed:** batches past their grace window still in the document (publicly hidden) — labeled "lapsed" so stale records are visible to staff.

### 1.3 Seats-zero honesty

When `seatsLeft === 0`, every booking surface (QuickEnroll board, /batches rows, StyleFinder result, home fallbacks) suppresses the payment button and renders the WhatsApp `EnquiryCTA` with a new label key (default: `"Full — WhatsApp for the next batch"`).

## Phase 2 — Above-fold engagement (mostly CSS)

### 2.1 Hero entrance compression (`Hero.tsx` + `globals.css`)

- Stagger delays: badge pill 0s (was 60ms), sub-headline 0.3s (was 0.95s), CTA block 0.45s (was 1.15s). CinematicHeadline timing untouched.
- Count-in: on `<sm` it renders absolutely (top-right of the content column, sharing the badge pill's line) so it plays without permanently reserving ~32px of fold height; `sm+` unchanged.
- Content-block top padding `pt-8` → `pt-5` (base breakpoint only).
- Acceptance: on a 375×667 viewport and in a ~584px-tall IG in-app viewport, the QuickEnroll board's lit edge is visible in the first viewport, and the ₹500 CTA is on screen well under 1 second after paint.

### 2.2 TonightFloat containment

- Root becomes `hidden lg:block` — the floating chip (which the owner wants) survives on desktop; on phones/tablets La Rumba is served by the Phase 3 in-flow band instead. No overlay ever touches the headline on `<lg`.
- Dismiss button hit target enlarged to ≥44×44px (visual size may stay smaller).

### 2.3 One pulse per viewport

`FloatingTalkToUs` loses its beat-ring animation (static pill). The board's "Booking open" badge keeps the only pulse in the arrival viewport. (TonightFloat's pulse now exists only ≥lg.)

### 2.4 Hardcoded public strings → content document

Migrate to schema-backed, admin-editable fields with today's text as defaults:

- `Hero.tsx:156` badge pill → `hero.badge` (default "India's largest Latin dance school").
- `Hero.tsx:193-195` reassurance line → `hero.reassurance` (default "One real class. No partner needed. You decide.").
- `QuickEnroll.tsx:264` `` `${book} on WhatsApp` `` → label template.
- `page.tsx:224` "Danced before? No Foundation batch open for {style} right now." → labels.
- `FloatingTalkToUs.tsx:63` string → labels.
- Contact tile actions use the existing unused `ctaGetDirections`/`ctaCall` keys.

/admin/hero (and labels page) gain the new fields.

### 2.5 Theme + motion hygiene

- Light theme: `.pill` on ember tint reaches ≥4.5:1 at rendered size (token adjustment in `globals.css`).
- Dark theme: `.accent` no longer renders the accented headline word dimmer than its surroundings.
- `MagneticInit` and `HeroSpotlight` early-return when `prefers-reduced-motion: reduce` (currently they check only `pointer: fine`).

## Phase 3 — Two front doors + proof (server-rendered; net client JS goes down)

### 3.1 La Rumba proof band replaces the Next-batches strip

- Remove the Next-batches strip section from `src/app/page.tsx` (currently lines ~179–273). Batches remain reachable via the board and /batches; the strip today duplicates the board's single card.
- New server-rendered section in its place, driven by a new `pages.home.rumba` schema object (all defaults shipped in code, admin-editable):
  - `eyebrow`, `headline`, `body` — voice-matched defaults (e.g. headline "Class teaches you. Saturday makes it yours."). Facts (venue, day, time) render from the existing `content.tonight` object — never duplicated into rumba fields.
  - `photos: string[]` — defaults: 2–3 real La Rumba shots from `public/photos/` (exact files chosen at implementation from the captioned set).
  - `testimonialId` — default `test-004` ("La Rumba is where you stop being a student and start being a dancer").
  - `showStat` (default true) + `statTemplate` (default "{n} dancing with us this week") rendering `site.stats.studentsThisWeek`.
  - CTAs: WhatsApp RSVP (primary, reuses `tonight.ctaContext` prefill) and a quiet cross-link "or start with your first class · ₹{trialFrom}" anchoring to `#start-this-week`.
- The retired `pages.home.nextBatches` fields and the never-rendered `pages.home.whatWeTeach.headline` follow the repo's existing retired-copy convention in `SiteContentSchema` and leave the admin home editor.

### 3.2 Welcome-page La Rumba invite

When `tonight.enabled`, the confirmed welcome view gains an invite block after the class logistics: "Your first social is this Saturday — come watch, entry at the venue" rendered from `content.tonight` + a new default template on the welcome copy object. This puts the school's core product at the moment of maximum enthusiasm.

### 3.3 StyleFinder result adopts the board's grammar

In the result panel: when the matched batch has a `razorpayLink`, render `BookTrialLink` primary with price (via `bookLabel`/`bookPriceInr`), demote WhatsApp to the "or chat first" link variant, and drop the Instagram button from the result (it remains elsewhere). Humanize the style-finder WhatsApp template default in `content-schema.ts` (first-person, sendable: "Hi! I tried the style finder — {style} looks like me. When does the next batch start?").

### 3.4 /batches price flip

Browser rows render the board's labeled pair when `offersTrial(b)`: bold "First class ₹{trial}" over quiet "Full program ₹{price} — decide after class one"; program-only line otherwise. Template keys live under the batches page's schema object with defaults matching the board's wording. The unlabeled `₹6,900` cell disappears.

## Phase 4 — Copy coherence (edits to `data/site-content.json` + seed + /admin checklist)

Every edit lands in the local dev document and `src/data/site-content.seed.json`, and appears verbatim in the owner checklist for production /admin. Principal edits (final wording tuned at implementation, staying warm/truthful):

1. New first-position global FAQ: "Can I try one class before committing?" — names ₹500, what it buys (one full class, any Foundation batch), non-refundable framing as small commitment, ends in the booking action.
2. `howItWorks` step 2 rewritten to name ₹500 (replaces "a small token").
3. Fee naming standardized to "first class" ("₹500 first class") across howItWorks/FAQ/welcome; Terms wording flagged in the checklist for the owner (legal text, owner-authored).
4. Venue FAQ corrected: no longer claims all Latin beginner batches run at Alcazar Mall; explains per-track venues incl. "PUP Unleash — HUDA Colony".
5. Tonight chip copy "WhatsApp to RSVP" aligned with the FAQ's "no pre-booking needed" (e.g. "Say you're coming" / entry at the venue).
6. Jargon glossed at first use: "Foundation — for people who've never danced"; "leaders and followers" explained; salsa description's seven sub-style names moved out of the first sentence (kept lower for dancers).
7. "the iconic Bachata booty vibe" replaced with voice-true copy; both garbled attire answers rewritten (surface the dance-in-socks fact plainly).
8. Instructor bios: DJ Ravi's run-on fixed (paragraph splits), person-shift misquotes in Mitali/Venkat bios corrected against their plausible first-person originals — flagged in checklist for owner verification since these quote real people.
9. Story "Taste of Salsa": "Message us on WhatsApp" becomes a real link; every story page ends with the standard enquiry CTA (code change in the story template, copy unchanged).
10. Small trust fixes: nav "Blog" → "Stories"; "Terms & Services" → "Terms of Service"; privacy policy's "our website forms" line corrected; welcome "See you all in class!" → singular address; about headline final period.

## Cross-cutting constraints

- **Perf:** no new client components; Phase 3 removes interactive strip content from home. After implementation run `npm run build && npm run audit:bundle` — home must not exceed its current measurement (117.51 KB total / 17.37 KB app-authored as of 2026-08-13) and should improve.
- **Truth:** only assets/quotes already in the content document and `public/photos/`. No invented numbers, names, or claims.
- **Static export:** the GH Pages export workflow must keep passing (no new dynamic-only APIs in public pages).
- **Schema migrations:** all new fields optional-with-defaults so existing production content parses unchanged; retired fields follow the established retired-copy convention.

## Testing

- Unit (Vitest): `visibleBatches` grace-window matrix (no `joinUntil`, explicit `joinUntil`, boundary days, IST date edges); seats-zero rendering decision helper; razorpay-host validation helper; schema defaults for every new field; started-vs-starts template selection.
- Existing schema/roles tests updated for new + retired fields.
- Manual: 375×667 and ~584px-tall viewport fold checks; light/dark theme hero contrast; reduced-motion behavior; /admin warning banners against a fixture document with lapsed batches and a forms.gle link.

## Deliverables

1. Code + schema changes (Phases 1–3) with tests, committed in reviewable slices per phase.
2. Content edits (Phase 4) to `data/site-content.json` + seed.
3. `docs/owner-checklist-2026-08-24.md` — Phase 0 actions + every Phase 4 copy edit as paste-ready /admin steps; also published as a private artifact link for the studio owner.
4. PRODUCT.md updates: grace-window behavior; retire the "batches auto-hide at startDate" line.

## Out of scope (explicitly deferred)

Evergreen "first class" product (option B); /batches full board-grammar rebuild; an /admin funnel-health dashboard page (inline warnings only for now); reviving "Taste of Salsa" as a home-page offer (owner decision); Razorpay `payment.failed` recovery messaging (depends on webhook being re-enabled and observed).
