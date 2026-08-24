# Owner checklist — 2026-08-24

Actions only you can take (production /admin + Razorpay dashboard). Items 1–5
unblock real bookings TODAY; the copy list mirrors what the code update
already applies to fresh installs, so production matches.

## Unblock the funnel (do first)

1. **Refresh the batches.** 5 of 6 batches have past start dates; the last
   visible one (WCS, 29 Aug) disappears from the site on 30 Aug — after the
   update it stays up 14 more days, but it needs real dates either way.
   /admin/batches → update Start date (and optionally "Joinable until") for
   every batch you're actually running. The new amber banner on that page
   tells you when any style has nothing bookable.
2. **Re-enable the Razorpay webhook.** Razorpay Dashboard → Settings →
   Webhooks → re-enable (or recreate) the webhook for
   `https://www.dancehyderabad.com/api/razorpay/webhook`, then re-set the
   secret: `wrangler secret put RAZORPAY_WEBHOOK_SECRET`. Until this is done
   /admin/payments is blind and failed payments vanish untraced.
3. **Check every Payment Page redirect.** Each Razorpay Payment Page must
   redirect to its batch's welcome URL — /admin/batches shows the exact URL
   to paste per batch (the "Razorpay redirect URL" box).
4. **Remove the Google Form link.** Batch "Salsa Intermediate" has
   `https://forms.gle/…` in its Razorpay link field. Clear it (WhatsApp then
   becomes the booking button automatically) or replace it with a real
   Razorpay page. The site promises "No forms".
5. **Sanity-check seats.** `seatsLeft: 20` with status "Filling Fast" reads
   as a lie. Set real numbers or clear the field to hide the count.

## Copy updates to apply on production /admin

The code update carries these for fresh content; production stores its own
copy, so apply them once in /admin (Pages → FAQs / Home / About / Legal,
Site → Tonight, Instructors, Labels):

- FAQs: add first question "Can I try one class before committing?" (₹500,
  one real class, ends with "tap Book my first class / WhatsApp us").
- FAQs "What does it cost?": add the ₹500 first-class sentence.
- FAQs venue answer: stop saying all Latin beginner batches are at Alcazar
  Mall — name both venues and point at the batch card + confirmation.
- FAQs partner answer: explain leads/follows in plain words.
- FAQs + Salsa page attire answers: rewrite (fresh socks in studio, smooth
  soles for socials).
- Home "How it works" step 2: name the ₹500 first class (replaces "small
  token").
- Salsa description: move the seven sub-style names out of the first
  sentence. Bachata foundation outcome: replace "booty vibe" line.
- Tonight chip button: "WhatsApp to RSVP" → "Say you're coming" (entry is at
  the venue; no pre-booking).
- Stories page eyebrow "Blog" → "Stories"; Labels → navBlog → "Stories".
- Terms headline "Terms & Services" → "Terms of Service"; Terms wording:
  prefer "first class" over "trial class" anywhere it survives.
- Privacy "what we collect": drop "our website forms" (there are no forms).
- About headline: add the final period.
- Instructor bios: DJ Ravi (paragraph breaks + drop "credentials speak for
  themselves"), Mitali ("I have" → "She has"), Venkat ("his salsa journey" →
  "my salsa journey" inside his own quote).
- Welcome sign-off: "See you all in class!" → "See you in class!"

## Decisions parked for you

- **"Taste of Salsa" free demo** — the 2025 story still invites people to a
  free demo. Promote it to the home page as a real offer, or retire the post.
- **La Rumba entry price** — the site never states it. If you want it public,
  add it to the Tonight body text.
