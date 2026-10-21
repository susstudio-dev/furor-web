---
target: furor-web public journey (home + funnel)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 5
timestamp: 2026-08-24T07-00-42Z
slug: src-app-page-tsx
---
Method: dual-agent (A: 5 surface reviewers + synthesis subagent · B: detector subagent), via Workflow run wf_3c8cc1ef-b13, 2026-08-24.

# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Lapsed batches still say "Open"/"Filling Fast"; static `seatsLeft: 20` never decrements |
| 2 | Match System / Real World | 2 | Unglossed jargon at first contact: "Foundation", "La Rumba · Latin Social", "leaders and followers", seven salsa sub-style names; "small token" for the ₹500 |
| 3 | User Control and Freedom | 3 | "or chat first" escape beside every payment ask; deduction: board's style-finder link teleports the undecided past both persuasion sections |
| 4 | Consistency and Standards | 1 | Ten WhatsApp label variants; one label with two behaviors (anchor vs. Razorpay); two card grammars for the same batch; three names for the ₹500 |
| 5 | Error Prevention | 1 | Google Form stored as `razorpayLink` passes schema silently; no admin warning for lapsed batches or unset welcome redirects; seatsLeft 0 still renders a buy button |
| 6 | Recognition Rather Than Recall | 3 | Price-on-button is exemplary; deduction: /batches makes the visitor recall the ₹500/₹6,900 distinction the board taught |
| 7 | Flexibility and Efficiency | 2 | StyleFinder result (highest intent) drops the fast booking path; no booking shortcut in site chrome on any breakpoint |
| 8 | Aesthetic and Minimalist Design | 2 | ~24–27 conversion CTAs on home; three identical infinite beat-rings in one viewport; duplicate batch strip; 2s entrance choreography hides the primary CTA |
| 9 | Error Recovery | 2 | Visible half good (unconfirmed-payment state with retry); invisible half is a black hole: no failure redirect, dead webhook loses `payment.failed` |
| 10 | Help and Documentation | 2 | FAQ tone right, but the ₹500 first class is never explained; venue answer factually wrong for current intake; no answer ends in an action |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

All 10 heuristics scored (Persuade surface, but #7 and #10 are designed dimensions here: two-audience accelerators exist, and a 12-item FAQ is load-bearing).

# Design Specificity Verdict

**Authored for Furor at the flagship surfaces; category-interchangeable in the connective tissue — and the specificity thins exactly where the money path leaves the home page.**

Authored: hero copy ("The night was made for *dancing*." / "Never danced a step? Foundation is built for exactly you."); the QuickEnroll board's 5-6-7-8 count-in reused as the fear-answering device at the decision point; the honest price flip (₹500 bold, ₹6,900 quiet context); "Foundation · start here" spotlight; the welcome page's "Cheers, Rish", arrive-by-15-min, socks detail; about copy "a room, a song, two people learning to listen"; per-batch WhatsApp prefills.

Interchangeable: the Next-batches strip (second, blander card grammar for the same object the board just showed); /batches facet wall (8 filter groups + 5 presets + sort over one visible row today); FAQ answers as inert paragraphs; header spending its prime slot on three social icons + theme toggle with zero CTA; "Course Registration"; press-kit instructor bios; unlabeled "₹6,900" price cells.

**Deterministic scan:** 1 finding total, and it is a false positive (`broken-image` at Hero.tsx:52 matched the literal string `<img>` inside a JSX prose comment; the real element at line 64 has full src/srcSet/sizes/alt). The public surfaces are mechanically clean — the debt is conversion/content/journey, not craft defects. Browser visualization skipped: no browser automation tool exposed this session.

# Cognitive Load — 6 of 8 FAIL

Fails: single focus (three identical beat-rings claim "act here" in three directions in viewport 1); chunking (strip card carries 8 chunks; salsa description fires seven sub-style names); hierarchy (unlabeled ₹6,900 renders above the ₹500 button on strip and /batches; the reassurance line is smallest, faintest, last-arriving); one-thing-at-a-time (5 conversion controls in one mobile viewport at the closing panel, identical label twice within ~100px); minimal choices (~24–27 conversion CTAs on home); working memory (₹500-vs-₹6,900 semantics must be carried between surfaces; FAQ says Alcazar Mall while the batch is at PUP Unleash).
Passes: grouping and progressive disclosure — both concentrated in the QuickEnroll board, proof the team knows exactly how to do this.

# Emotional Journey (nervous beginner)

Warm start → self-inflicted valley (CTA + ₹500 invisible ~1.15–2s; 224px chip fades in over the headline on <lg; board peek is 0px at 553–584px visual viewports, i.e. the IG in-app browser) → genuine peak at the board (today an apology: one WCS card, zero Salsa/Bachata) → proof-free trough (/batches: unlabeled ₹6,900, "20 seats left" = empty room, "Filling Fast" at 20/20 reads as a lie; no faces anywhere between board and footer) → unattended payment hand-off (no trust marker, no failure redirect, dead webhook) → conditionally excellent peak-end (/welcome is the best moment in the funnel, but nothing verifies the Razorpay redirect is configured, and La Rumba is absent from the moment of maximum enthusiasm).

# What's Working

1. **The QuickEnroll board** — the best persuasion surface in the review; every fix elsewhere should copy its grammar.
2. **Price-on-button honesty + escape-hatch discipline** (`book-label.ts`; "or chat first" beside every payment ask; anchors never deep-link checkout).
3. **The content-document architecture** — most fixes are content edits, not code.
4. **The confirmed welcome page** (vCard, .ics with alarms, arrive-by time, venue/parking, personal sign-off) with server-decided confirmation.

# Priority Issues

1. **[P0] The funnel's inventory has lapsed — and hits zero on 2026-08-30.** 5 of 6 batches have past start dates (data/site-content.json:198–316); a "Latin dance school" hero currently sells zero Salsa/Bachata. *Fix:* owner refreshes batches via /admin now; code adds a joinable grace window (`joinUntil`) so batches don't vanish the day after starting (terms promise mid-batch joins), plus an /admin zero-Foundation-inventory warning (same pattern as the webhook-silence banner).
2. **[P0] The post-payment chain is blind end to end.** Webhook deactivated while welcome-confirm.ts delegates payment truth to "the webhook log"; `payment.failed` (the only abandonment signal) is lost; nothing verifies each Razorpay page's redirect points at `/welcome/<track>?d=<date>`; batch-004 stores a Google Form as `razorpayLink` ("Course Registration · ₹4,700" fires a GA conversion and collects nothing, under a "No forms" promise). *Fix:* owner re-enables webhook + re-puts secret; per-link redirect checklist; strip the form URL (WhatsApp auto-promotes); admin write-path warning when `razorpayLink` host isn't razorpay.com/rzp.io.
3. **[P0] TonightFloat covers the trust pill and headline on every phone/tablet.** `absolute right-3 top-3 z-20 w-[14rem]` over the z-10 hero column; fades in 1.7s+ onto text being read, carrying a social-RSVP prefill wrong for beginners; 32px dismiss target under the site's own 44px minimum. *Fix:* keep the chip ≥lg (owner wants it); below lg render La Rumba as an in-flow strip or one-line mention.
4. **[P1] The hero hides its own ask for ~2s and loses the fold on the devices that matter.** CTA block absent until 1.15s; board peek 0px at 553–584px visual viewports; count-in permanently reserves 32px after it finishes. *Fix (CSS numbers only):* compress stagger (pill 0 / sub 0.3s / CTA 0.45s); count-in `absolute` on <sm; `pt-8`→`pt-5`.
5. **[P1] The ₹500 story is incoherent; the trust layer contradicts the data layer.** "₹500" appears nowhere in the document's prose; three names for one fee; FAQ venue answer says Alcazar Mall while the current Latin intake is at PUP Unleash; "WhatsApp to RSVP" contradicts "no pre-booking needed". *Fix (content edits):* first-position FAQ naming ₹500 ending in the booking action; rewrite howItWorks step 2; standardize "first class"; correct venue prose; align RSVP copy.
6. **[P1] Price framing inverts everywhere outside the board.** /batches rows print only unlabeled ₹6,900; the strip injects the program fee above the ₹500 button. *Fix:* lift the board's labeled price-flip templates into `pages.batches.browser` and the strip.
7. **[P1] StyleFinder answers the highest-intent moment with the slowest channel.** Result panel shows full batch details but offers only WhatsApp/Instagram — no `BookTrialLink` even when `razorpayLink` exists; machine-written prefill suppresses sends. *Fix:* board's exact grammar (BookTrialLink primary, "or chat first" demoted), drop Instagram there, humanize the template.
8. **[P1] The home body shows the syllabus, not the life.** The strip duplicates the board while 4 real testimonials, 8 captioned La Rumba photos, and `stats.studentsThisWeek: 124` render on zero public surfaces; test-004 (the positioning quote) appears nowhere. *Fix (server-rendered, zero client JS):* replace the strip with a proof band (2–3 photos, test-004, the 124 line) behind a `pages.home.rumba` schema object; rotate the board's pinned testimonial.

# Persona Red Flags

**Jordan (first-timer):** "Foundation" unglossed in the hero; "La Rumba · Latin Social" is scene jargon in his first overlay; salsa page opens with seven sub-style names; the dance-in-socks fact is hidden inside two garbled attire answers — he discovers it on arrival, the exact embarrassment he fears; /batches greets him with an unlabeled ₹6,900.

**Casey (distracted mobile):** CTA invisible ~2s in the IG webview; chip lands over the headline mid-read; board peek 0px on her 584px visual viewport; 32px dismiss target; the closing panel shows the identical "Book my first class · ₹500" twice within ~100px.

**Riley (stress tester):** bare visit to `/welcome/wcs` renders a full confirmed page (defensible only while the webhook — the designated "real payment record" — is alive; it isn't); "● 0 seats left" next to a live buy button; "Filling Fast" at 20/20; `daysOfWeek.join('–')` produces "Sat–Sun" style ranges that falsely imply continuity in four call sites including the WhatsApp prefill; the "No forms" page links a Google Form; abandoning a Payment Page produces zero trace.

**Priya (nervous beginner):** FAQ tells her all Latin beginner batches are at Alcazar Mall while hers is at "PUP – Paws Unleash Play", which nothing explains; can't find what ₹500 buys without reading Terms; "the iconic Bachata booty vibe" is the one line likely to close her tab; "leaders and followers" unglossed; "we'll answer in minutes" unqualified at 11pm.

**Arjun (returning dancer):** nothing addresses "danced before?" until the board footer; the one CTA aimed at him is "Course Registration" → a Google Form; Intermediate pricing contradicts itself (₹4,700 monthly vs "same rhythm" as the 2-month Foundation); La Rumba's end time and entry price absent; newest story is 13 months old with past events in future tense; the welcome page never invites anyone to La Rumba.

# Minor Observations

- Hardcoded public strings violating the content-document rule: Hero.tsx:156, Hero.tsx:194, FloatingTalkToUs.tsx:63, QuickEnroll.tsx:264, page.tsx:224, contact tile actions.
- `pages.home.whatWeTeach.headline` stored and admin-editable but never rendered (page.tsx:158).
- Trust pill fails AA on light theme (~3.2:1 at 12px); dark-theme `.accent` makes "*dancing*." the dimmest word in the headline.
- Light-theme mobile scrim erases ~90% of the hero photo while still paying its AVIF preload.
- Reduced-motion leaks: MagneticInit and HeroSpotlight check only `pointer: fine`.
- Instructor style/branch pills are inert spans — no path from convinced to class; DJ Ravi's bio renders as run-on soup; Mitali/Venkat bios contain person-shift misquotes of real people.
- Story pages have no closing CTA; "Taste of Salsa" says "Message us on WhatsApp" as unlinked plain text.
- Nav "Blog" → "Stories" mismatch; "Terms & Services" → "Terms of Service"; privacy policy mentions "our website forms" on a no-forms site; welcome "See you all in class!" addresses a crowd of one.
- Header carries no booking/WhatsApp CTA on any breakpoint.

# Questions to Consider

1. If the social is the product, why is it never the ask? What would the funnel look like if "come see La Rumba this Saturday" were the zero-fear first conversion, with the ₹500 class as the follow-up?
2. Is "batch" the right sellable primitive? Every P0 traces to cohort records that expire. Should the visitor buy "your first class" (evergreen, next-date resolved server-side) while batches remain internal scheduling objects?
3. Why does any batch surface exist that isn't the board? Could /batches literally be the board with filters — one grammar site-wide?
4. Is "Taste of Salsa" (free demo) alive? Promote it to the home page or retire the promise — owner decision.
5. Who is the admin's user? Every P0 is an ops failure the code allowed silently. Should /admin open with a funnel-health panel?
