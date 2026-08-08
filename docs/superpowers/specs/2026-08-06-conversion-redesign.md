# Homepage conversion redesign — "On the One"

**Date:** 2026-08-06
**Trigger:** owner-run conversion test performed badly; owner feedback: level-jumbled batch
board, "Reserve my seat" → "Book Trial", weak homepage CTA.
**Process:** 7-agent workflow — 2 evidence researchers (web), 3 independent creative concepts,
2 adversarial judges (truth/brand + feasibility/perf). This spec is the synthesis of the two
top-scoring concepts with every judge-demanded fix applied.

---

## 1. What the evidence says (researched, sourced in the workflow output)

1. **Paid low-cost trials beat free ones** — 50–80% trial→member conversion vs <45% for free
   across studio-platform data (Mindbody, Glofox, vibefam). The ₹500 token is the right model;
   the site just never *sells* it as a trial. The fix is framing, not pricing.
2. **Specific, first-person, price-honest buttons win** — "Book **my** first class · ₹500"
   beats both "Reserve my seat" (reads as committing to ₹6,900) and a bare "Book Trial"
   (hides that the click lands on a payment page — trading clicks for unmeasurable
   payment-page abandonment).
3. **Attention ratio** — Unbounce's 20k-page dataset: one goal per viewport converts best. The
   hero currently has two co-equal buttons; every batch card has two. Hierarchy, not removal:
   WhatsApp demotes to text-link weight — in India it's a *superior* lead channel
   (40–60% lower CPL than forms) and must never disappear.
4. **The four documented beginner blockers** for adult dance: no partner / I'll look silly /
   never danced / what do I wear. None answered anywhere near the booking action today —
   and all four answers already exist as live FAQ copy.
5. **Honest scarcity only** — real seat counts phrased softly convert; manufactured urgency
   measurably backfires with anxious audiences. The site's real 18–20 seat counts are exactly
   the approved form.
6. **Deposit credit is the cheapest trust lever** — 72% of consumers pay a deposit happily IF
   it counts toward the final price. **Owner decision needed** (§6).

## 2. The core reframe

Today the site sells an 8-week ₹6,900 commitment and hides its real product — a ₹500 first
class — in sentence four of the hero. Every surface flips that hierarchy: **₹500 is the price
of the product** (one real class, then you decide); ₹6,900 is quiet context. The nervous
beginner stops being asked to commit and starts being invited to try.

## 3. What ships (the synthesis)

### Hero
- Headline + count-in unchanged (brand equity).
- Sub-headline: 5 sentences → 3 (admin content; local data + seed updated):
  *"Learn Salsa, Bachata and West Coast Swing with India's most loved Latin dance school —
  Jubilee Hills & HUDA Colony, Hyderabad. Never danced a step? Foundation is built for exactly
  you. ₹500 books your first class — feel the music once, then decide on the full program."*
  (No year claim: judge caught "teaching Hyderabad since 2009" as false — Hyderabad opened 2010.)
- CTA hierarchy: **one** filled primary — "Book my first class · ₹500" (price derived from
  live batch data, never hardcoded) — a zero-JS anchor to the booking board, with click-trigger
  microcopy: *"One real class. Then decide."* WhatsApp demotes to link weight. "See batches"
  leaves the hero (the board it points past already links there).
- **The downbeat**: the button pulses once at `calc(var(--beat) * 4)` — the exact moment the
  5-6-7-8 count-in resolves. The page counts you in; the button lands on the 1. ~6 lines of
  CSS, motion-gated, button visible early (never delayed — LCP).

### The board (QuickEnroll)
- **Level-first composition**: up to 3 soonest Foundation batches + 1 soonest higher-level;
  falls back to a straight level-sorted slice when data is sparse.
- **Spotlight card**: the first Foundation card gets its own mini lit ember top edge, a solid
  badge "First-timers start here", and the line "No partner, no experience needed."
  (both claims are live site copy).
- **Price flip** on every card: "Trial class ₹500" at full weight; "Full program ₹6,900" quiet
  beneath. Both via `formatInr()` from batch data.
- **Count-in reassurance strip** *inside* the board, above the footer — the four blockers
  answered in brand voice, numbered like the count:
  5 — Come alone. Partners rotate all class. · 6 — Foundation assumes zero experience. ·
  7 — Wear anything you can move in. · 8 — A warm-up, the basic step, real music.
  Resolving: *"…and on the 1, you're dancing."* (All four lines are backed by live FAQ copy;
  no duration claim — one batch runs 2 hours.)
- **Proof at the point of decision**: Suhavi Jaswal's real quote (rendered from the content
  document, not hardcoded) as the board's final hairline row.
- Footer adds the experienced-dancer lane: "Danced before? Intermediate & Advanced →"
  (`/batches?level=Intermediate,Advanced` — URL params the browser already parses).
- Header microcopy becomes batch-agnostic ("Book in ~30 seconds") — one batch's link is a
  Google Form, so no per-card Razorpay claim.

### CTA system (sitewide)
- Every payment link renders through `BookTrialLink` → fires `book_trial_click` with
  batch/level/source/value. **The paid conversion was previously unmeasured.**
- Labels, level-aware, price always from data: Foundation → "Book my first class · ₹500";
  Intermediate/Advanced → "Book my trial class · ₹500".
- WhatsApp always present at link weight: "or chat first on WhatsApp", carrying the existing
  per-batch prefilled message. Promotes to primary when a batch has no booking link.
- Old labels retired everywhere: "Reserve my seat", "Book seat".

### Mobile (the Instagram majority)
- **The After-Band**: a zero-JS sticky bottom bar that appears only after the visitor scrolls
  past the board (position:sticky inside a wrapper that starts below the board — universal
  browser support, no observers, no CLS). Opaque ink fill (no backdrop-blur — this codebase
  already removed one for scroll-frame cost). Contents: "Book my first class · ₹500" anchoring
  to the board (never batch-bound — a judge caught that deep-linking a persistent bar to one
  batch's payment page lets a nervous first-timer pay for a class they never chose) + a 44px
  WhatsApp icon.
- FloatingTalkToUs suppressed below `sm` on the home route so two floating elements never
  stack on a thumb.

### /batches (already shipped in `8e9c2ae`)
- Default sort "Beginner → advanced"; Soonest/Latest kept; price sorts dropped (price filter
  stays). Adds now: ember "first-timers welcome" tag on Foundation rows; quick-pick renamed
  "🔰 Never danced? Start here".

## 4. What deliberately does not change
Headline, count-in, hero video, KineticStrip, StyleFinder, La Rumba tile, testimonials
section, admin. No countdowns, no fake urgency, no discounts, no invented copy, no free
trial, no new dependencies, no forms.

## 5. Performance
Net new client JS ≈ 0.4KB gz (`BookTrialLink` — required for measurement regardless).
Everything else is server markup + CSS on existing tokens (`--beat`, ember ramps, cream
alphas). Home first-load stays ~119KB (already over the 100KB budget; this adds nothing
material — reducing it is separate work worth scheduling).

## 6. Owner decisions & verifications — ANSWERED 2026-08-06
1. **Does the ₹500 count toward the program fee?** **No** (owner-confirmed). The credit line
   is NOT shipped, and no shipped copy claims it — cards say "decide after class one", which
   stays true either way.
2. **Refund experiment**: **Yes** (owner-confirmed). Shipped, amount derived from batch data:
   the hero click-trigger ("Not for you? Your ₹500 back.") and the board's count-8
   ("Nothing to lose. If the first class isn't for you, your ₹500 comes back — just tell us
   on WhatsApp."). Deliberately not repeated on every /batches row — the promise lives at the
   two decision points the conversion test measured. The studio must honor it on request.
3. The Intermediate Salsa "booking link" is a Google Form, not a payment page — replace with
   a real Razorpay link or expect its button to behave differently from its label.
4. PRODUCT.md still says "no payments on the site" — out of date since Razorpay landed;
   worth updating so future work doesn't design against a stale model.

## 7. Measurement
`book_trial_click` (new) vs `enquiry_click` (existing), each with batch/level/source. The
next conversion test can see: hero-anchor engagement → board card clicks by level → paid
clicks vs WhatsApp choices, per surface. Today the paid path is invisible in GA4.
