import { z } from 'zod';
import { LABEL_DEFAULT_LITERALS as L } from './label-defaults';
import { HERO_POSTER_ALT_DEFAULT } from './hero-defaults';

// zod's .url() only checks `new URL()` parseability, so javascript:, data: and
// vbscript: URIs pass it — and several of these fields are rendered as raw
// <a href> / <source src> on every public page. Restrict admin-editable link
// fields to http(s) absolute URLs or root-relative paths.
const isSafeUrl = (v: string) =>
  v === '' || v.startsWith('/') || /^https?:\/\//i.test(v);
const safeUrl = (message = 'Must be an http(s) URL or a /relative path') =>
  z.string().refine(isSafeUrl, { message });

// The tokens that make a prefilled WhatsApp message unsafe or obviously broken.
//
// `<` and `>` because the message is interpolated into an href and read back by
// a client that renders it; `{{` and `}}` because they are a template syntax
// nothing here implements, so they would ship to a visitor verbatim; and the
// literal word `undefined`, which is what a missing value used to produce.
//
// Checked at SAVE time (src/lib/integrity.ts), never on the read path. A Zod
// refine here would be evaluated by getContent() on every request, and
// content.ts serves the bundled seed for the ENTIRE public site when the parse
// throws — so one bad character would be a site-wide outage rather than a form
// error.
export const FORBIDDEN_MESSAGE_TOKENS = ['<', '>', '{{', '}}', 'undefined'] as const;

export function firstForbiddenToken(msg: string): string | null {
  for (const token of FORBIDDEN_MESSAGE_TOKENS) {
    if (msg.includes(token)) return token;
  }
  return null;
}

// The six prefilled WhatsApp messages, plus the optional studio fragment that
// is substituted into {where}. Single-brace {placeholders} are filled at render
// time from live records — the studio can rewrite the prose, it cannot make the
// batch details wrong.
export const WhatsappTemplatesSchema = z
  .object({
    batch: z
      .string()
      .default(
        "Hi Furor, I'm interested in the {style} {level} batch at {branch} ({days}, {time}, starting {date}). Please share details.",
      ),
    /** The per-batch prefill once the batch has already started (grace
     *  window). "starting {date}" in a sent message about a July batch in
     *  August embarrasses the sender; this asks the honest question. */
    batchStarted: z
      .string()
      .default(
        "Hi Furor, I'd like to join the {style} {level} batch at {branch} ({days}, {time} — it started {date}). Can I still join?",
      ),
    styleFinder: z
      .string()
      .default(
        'Hi Furor! {style} {level}{where} looks right for me. When does the next batch start?',
      ),
    /** Substituted into {where} when a studio is known; dropped entirely when not. */
    styleFinderWhere: z.string().default(' at {branch}'),
    style: z
      .string()
      .default("Hi Furor, I'm interested in {style} classes — please share details."),
    branch: z.string().default("Hi Furor, I'd like to know about classes at your {branch} studio."),
    custom: z.string().default("Hi Furor, I'd like to come to {note}."),
    generic: z.string().default("Hi Furor, I'd like to know more about your dance classes."),
  })
  .default({});

export const SiteSettingsSchema = z.object({
  title: z.string().min(1),
  tagline: z.string().min(1),
  whatsappNumber: z.string().regex(/^\d{10,15}$/, 'Digits only, no + or spaces'),
  instagramHandle: z.string().regex(/^[a-zA-Z0-9._]+$/),
  email: z.string().email().optional().or(z.literal('')),
  socials: z
    .object({
      instagram: safeUrl().optional().or(z.literal('')),
      facebook: safeUrl().optional().or(z.literal('')),
      youtube: safeUrl().optional().or(z.literal('')),
    })
    .partial(),
  footerCopy: z.string().optional().default(''),
  notice: z.string().optional().default(''),
  whatsappTemplates: WhatsappTemplatesSchema,
  stats: z
    .object({
      studentsThisWeek: z.number().int().nonnegative().nullable().optional(),
    })
    .partial()
    .default({}),
});

export const HeroSchema = z.object({
  headline: z.string().min(1),
  subHeadline: z.string().min(1),
  videoMp4Url: safeUrl().optional().or(z.literal('')),
  videoWebmUrl: safeUrl().optional().or(z.literal('')),
  posterImage: z.string().default(''),
  // Not decorative: this is the one photo that shows a visitor what a Furor
  // night actually looks like, so it gets a real description rather than the
  // alt="" an audit flagged as missing text.
  posterAlt: z.string().default(HERO_POSTER_ALT_DEFAULT),
  // The trust badge over the headline and the reassurance line under the
  // CTAs — shipped literals promoted to editable fields ("only the truth,
  // and all of it is editable"). Blank hides the element.
  badge: z.string().default("India's largest Latin dance school"),
  reassurance: z.string().default('One real class. No partner needed. You decide.'),
});

export const TonightSchema = z
  .object({
    enabled: z.boolean().default(false),
    headline: z.string().default(''),
    body: z.string().default(''),
    when: z.string().default(''),
    ctaLabel: z.string().default('Say you’re coming'),
    ctaContext: z.string().default(''),
    // Structured facts for the schema.org Event node. `when` above stays the
    // human sentence shown on the tile; these are what a search engine needs.
    //
    // The social runs at a third-party bar, not at either studio, so there is
    // nothing in `studios` to derive a location from — hence its own fields
    // rather than a branchSlug. All defaulted: the Event node is emitted only
    // when venueName, weekday and startTime are all filled, so an
    // unconfigured document simply ships no node instead of an invalid one.
    venueName: z.string().default(''),
    venueStreet: z.string().default(''),
    venueLocality: z.string().default(''),
    weekday: z
      .enum(['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
      .default(''),
    /** 24-hour local start, e.g. '19:00'. */
    startTime: z.string().default(''),
    /** 24-hour local end, optional — omitted from the node when blank. */
    endTime: z.string().default(''),
  })
  .refine(
    (t) => !t.enabled || (t.headline && t.body && t.when && t.ctaContext),
    { message: 'When enabled, headline, body, when and ctaContext are required', path: ['headline'] },
  );

// A generic "featured offer" ribbon on the home page (kept the `trial` key so
// existing stored content keeps working). Primary CTA can be either an
// internal link (e.g. "See weekend batches" → /batches?days=Weekend) OR a
// WhatsApp message. The schema makes no claims about price — fill the copy
// to match whatever you actually offer.
export const TrialSchema = z
  .object({
    enabled: z.boolean().default(false),
    eyebrow: z.string().default('Weekend'),
    headline: z.string().default(''),
    body: z.string().default(''),
    when: z.string().default(''),
    ctaLabel: z.string().default('See weekend batches'),
    // If set, the primary CTA becomes a Link to this href instead of WhatsApp.
    ctaHref: z.string().default(''),
    // If ctaHref is set, WhatsApp shows as a secondary "Or chat" link.
    // If ctaHref is empty, WhatsApp IS the primary CTA.
    whatsappLabel: z.string().default('Or chat on WhatsApp'),
    ctaContext: z.string().default(''),
    footnote: z.string().default(''),
  })
  .refine(
    (t) => !t.enabled || !!t.headline,
    { message: 'When enabled, headline is required', path: ['headline'] },
  );

export const DanceStyleSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  whoItsFor: z.string().min(1),
  heroImage: z.string().default(''),
  heroVideo: z.string().optional().default(''),
  levelOutcomes: z.object({
    foundation: z.string().min(1),
    intermediate: z.string().min(1),
    advanced: z.string().min(1),
  }),
  faqs: z
    .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
    .default([]),
  displayOrder: z.number().int().default(0),
});

export const StudioSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  neighborhood: z.string().min(1),
  address: z.string().min(1),
  geo: z.object({ lat: z.number(), lng: z.number() }),
  hours: z.string().min(1),
  telephone: z.string().min(1),
  photos: z.array(z.string()).default([]),
  parkingNotes: z.string().optional().default(''),
  styleSlugs: z.array(z.string()).default([]),
  displayOrder: z.number().int().default(0),
});



// A batch can now combine multiple dance styles (e.g. "Salsa + Bachata"
// taught together in one course). Older records used a single `styleSlug`
// string — preprocessed here into a one-item array so existing data still
// validates without manual migration.
export const BatchSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
    let v = val as Record<string, unknown>;

    if ('styleSlug' in v && !('styleSlugs' in v)) {
      const { styleSlug, ...rest } = v;
      v = {
        ...rest,
        styleSlugs: typeof styleSlug === 'string' && styleSlug ? [styleSlug] : [],
      };
    }

    // `reservationInr` → `trialInr`. The old field was a plain number with a
    // 500 default, so there was no way to record "this batch has no trial" —
    // and every booking surface read the absence as ₹500 rather than as
    // nothing. Migrated here so stored documents need no hand edit, and only
    // when `trialInr` is genuinely absent: an explicit null is the studio
    // saying "no trial" and must survive.
    if (!('trialInr' in v) && typeof v.reservationInr === 'number') {
      v = { ...v, trialInr: v.reservationInr };
    }

    return v;
  },
  z.object({
    id: z.string().min(1),
    styleSlugs: z.array(z.string().min(1)).min(1, 'Pick at least one dance style'),
    level: z.enum(['Foundation', 'Intermediate', 'Advanced']),
    branchSlug: z.string().min(1),
    daysOfWeek: z.array(
      z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
    ).min(1),
    time: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    // The last calendar day this batch may still be sold to a new joiner.
    // Blank means startDate + 14 days (DEFAULT_JOIN_GRACE_DAYS in
    // content-helpers.ts): the Terms promise mid-batch joins with make-up
    // classes, so a batch must not vanish from every public surface the
    // morning after it starts — which is exactly how the site dropped to a
    // single visible class in Aug 2026. Defaulted so stored documents parse
    // with no migration.
    joinUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
      .or(z.literal(''))
      .default(''),
    priceInr: z.number().int().nonnegative(),
    // What the trial class costs — and, by being nullable, WHETHER this batch
    // runs one at all. `null` means no trial: the booking CTA then advertises
    // the full programme price instead of inventing a deposit.
    //
    // One field rather than a boolean beside a number, so "offers a trial" and
    // "the trial costs ₹X" can never disagree. Its predecessor
    // (`reservationInr`, a plain number defaulting to 500) could only say
    // "yes, ₹500", which is how an Intermediate batch whose booking link is a
    // Google Form came to advertise a ₹500 trial and report a ₹500 conversion.
    //
    // Defaulted, never required: a required field throws on the READ path and
    // content.ts then serves the bundled seed for the entire public site.
    trialInr: z.number().int().nonnegative().nullable().default(500),
    seatsLeft: z.number().int().nonnegative().nullable().optional(),
    status: z.enum(['Open', 'Filling Fast', 'Closed']),
    razorpayLink: safeUrl().nullable().optional(),
    // The post-payment message for THIS intake, shown on the confirmation
    // page after someone pays. Empty means "use the track's standard copy",
    // so a batch created and never edited still ships a warm confirmation
    // rather than a blank space.
    //
    // Prose only. Venue, date, time and contact details are derived from the
    // batch and its studio (see welcome-contact.ts) precisely so a note can
    // never contradict the record it sits beside — which is exactly how
    // /p/latinl1july2026 ended up naming the wrong venue and arrival time.
    //
    // Defaulted, so every stored batch stays valid with no migration.
    welcomeNote: z.string().default(''),
  }),
);

export const InstructorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  photo: z.string().default(''),
  role: z.string().min(1),
  shortBio: z.string().min(1),
  branchSlugs: z.array(z.string()).default([]),
  styleSlugs: z.array(z.string()).default([]),
  social: z
    .object({
      instagram: safeUrl().optional().or(z.literal('')),
    })
    .partial()
    .default({}),
});

export const TestimonialSchema = z.object({
  id: z.string().min(1),
  studentName: z.string().min(1),
  photo: z.string().optional().default(''),
  text: z.string().min(1),
  styleSlug: z.string().optional().or(z.literal('')),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (t) => new Date(t.publishedAt) <= new Date(),
  { message: 'publishedAt cannot be in the future', path: ['publishedAt'] },
);

export const StorySchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  // Provenance for the Author role, whose grant is "stories where authorId is
  // me". Defaulted so every already-stored story stays valid — a required
  // field here would fail validation on read and serve the seed site-wide.
  authorId: z.string().default(''),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  heroImage: z.string().optional().default(''),
  excerpt: z.string().optional().default(''),
  body: z.string().min(1),
});

// ─── Page copy schemas ─────────────────────────────────────────────────────
// Reusable shapes for blocks that recur across many pages.

const PageIntroSchema = z.object({
  eyebrow: z.string().default(''),
  headline: z.string().default(''),
  lead: z.string().default(''),
});

const CtaBlockSchema = z.object({
  headline: z.string().default(''),
  body: z.string().default(''),
});

const SectionHeaderSchema = z.object({
  eyebrow: z.string().default(''),
  headline: z.string().default(''),
});

const HomePageSchema = z
  .object({
    // The SERP title and description for this page. Blank means "use the
    // literal this route already shipped" — that literal lives once, in
    // PAGE_SEO_DEFAULTS (src/lib/page-meta.ts), so the schema, the route and
    // the admin placeholder cannot drift apart. Both still run through
    // fitTitle / fitDescription at render time, so an over-long value is
    // trimmed rather than shipped broken.
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    // The booking board — the conversion surface. Its own object because every
    // string here belongs to that one block, not to the site at large.
    board: z
      .object({
        speed: z.string().default('Book in ~30 seconds'),
        headline: z.string().default('Start dancing'),
        /** Rendered inside <span class="accent"> — the highlighted tail. */
        headlineAccent: z.string().default('this week.'),
        // {price} is filled from live batch data. Never hardcode a rupee figure
        // in prose: the copy would lie the day the deposit changes.
        // "Every batch opens with a {price} trial class" was the shipped
        // default and it was untrue twice over: the studio runs no trial at
        // all — {price} buys one real class off the batch's own syllabus —
        // and the board can carry batches that sell no single class either
        // (BatchSchema.trialInr). Universal quantifiers over batch data do not
        // belong in static copy — the same trap as hardcoding a rupee figure.
        leadWithPrice: z
          .string()
          .default(
            'First class from {price} — come once, meet the room, then decide on the full program.',
          ),
        leadNoPrice: z
          .string()
          .default('Come once, meet the room, then decide on the full program.'),
        spotlitNote: z.string().default('No partner, no experience needed.'),
        higherLevelNote: z.string().default('For dancers with the basics down.'),
        startsTemplate: z.string().default('Starts {date}'),
        trialPrice: z.string().default('First class {price}'),
        fullProgram: z.string().default('Full program {price} — decide after class one.'),
        // The whole price block for a card whose batch sells NO single class.
        // Emphatically NOT `fullProgram`: that line's "decide after class one"
        // promises a single class first. These batches are Intermediate and
        // Advanced — nobody is sampling them to decide. They know what the
        // programme is, they register, and they pay the whole fee up front, so
        // the line says that instead of leaving the terms unstated.
        fullProgramOnly: z
          .string()
          .default('Full program {price} — pay in full to register.'),
        // Two forms, because "1 seats left" is what one template produces.
        seatsLeftOne: z.string().default('● {n} seat left'),
        seatsLeftMany: z.string().default('● {n} seats left'),
        startedTemplate: z.string().default('Started {date} · you can still join'),
        // The count-in strip: the four documented first-class fears, answered at
        // the point of decision. Items 5-7 are backed by live site copy (FAQ,
        // hero) — none of these lines ships unverified. Item 8 used to promise
        // the fee back; the owner corrected that on 2026-08-08 — the paid first
        // class is NON-REFUNDABLE, so the risk reversal is the size of the
        // commitment, never money back.
        countIn: z
          .array(
            z.object({
              count: z.string().default(''),
              title: z.string().default(''),
              body: z.string().default(''),
            }),
          )
          .default([
            {
              count: '5',
              title: 'Come alone.',
              body: 'No partner needed — partners rotate all class, so you’ll dance with everyone.',
            },
            {
              count: '6',
              title: 'Never danced?',
              body: 'Foundation assumes zero experience. Most of the room started exactly there.',
            },
            {
              count: '7',
              title: 'Wear anything.',
              body: 'Anything comfortable you can move in — fresh socks or smooth soles beat fancy shoes.',
            },
            {
              count: '8',
              title: 'One class, not a course.',
              body: '{price} books a single class — no package, no sign-up. You decide on the full program after.',
            },
          ]),
        /**
         * Substituted for a {price} card body when no first-class price is
         * known. Led with "The token", which framed the fee as a deposit held
         * against something else; it buys the class outright.
         */
        countInFallbackBody: z
          .string()
          .default(
            'Booking covers a single class — no package, no sign-up. You decide on the full program after.',
          ),
        resolveLine: z.string().default("…and on the 1, you're dancing."),
        proofSuffix: z.string().default(', {style} student'),
        styleFinderLink: z.string().default('Not sure which? Take the 30-second style finder →'),
        advancedLink: z.string().default('Danced before? Intermediate & Advanced →'),
        allBatchesLink: z.string().default('See all batches & prices'),
        emptyNote: z
          .string()
          .default('Hi! I want to join a dance batch — please let me know the next start dates.'),
      })
      .default({}),
    whatWeTeach: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),
    // Was a bare SectionHeaderSchema; the eyebrow and headline keep their exact
    // shape and their stored values, and the three card templates join them.
    // Retired render site 2026-08-24 (strip replaced by the rumba band). Fields kept so stored documents parse; not editable in admin.
    nextBatches: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        starts: z.string().default('Starts {date} · {price}'),
        /** Renders inside a .pill — keep it short. */
        seatsLeft: z.string().default('{n} seats left'),
        /** Appended after the studio name when one batch teaches two styles. */
        combinedSuffix: z.string().default(' · taught together'),
      })
      .default({}),
    // The La Rumba proof band — replaced the Next-batches strip on
    // 2026-08-24 (the strip duplicated the board's cards; this shows the
    // life around the classes instead). Facts — day, time, venue — render
    // from `tonight`, never duplicated here; only words and proof assets.
    rumba: z
      .object({
        eyebrow: z.string().default('Saturday night'),
        headline: z.string().default('Class teaches you. Saturday makes it yours.'),
        body: z
          .string()
          .default(
            'La Rumba is our weekly Latin social — every level on one floor, beginners very much included. Come watch, come dance, come meet the people you’ll learn beside.',
          ),
        photos: z
          .array(z.object({ src: z.string(), alt: z.string() }))
          .default([
            { src: '/photos/DSC_0095.jpg', alt: 'La Rumba social — a packed floor on a Saturday night' },
            { src: '/photos/DSC09776.jpg', alt: 'Pure joy — two dancers laughing through a song' },
            { src: '/photos/DSC_0052.jpg', alt: 'A formal turn in emerald — Bachata at the social' },
          ]),
        /** Which testimonial anchors the band; falls back to the first stored
         *  testimonial when the id no longer exists. */
        testimonialId: z.string().default('test-004'),
        /** {n} = site.stats.studentsThisWeek. Blank hides the line. */
        statTemplate: z.string().default('{n} dancing with us this week'),
        rsvpLabel: z.string().default('Say you’re coming — WhatsApp'),
        /** Anchors to #start-this-week; the page appends " · ₹500" live. */
        classLink: z.string().default('or book your first class'),
      })
      .default({}),
    howItWorks: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        steps: z
          .array(z.object({ title: z.string(), body: z.string() }))
          .default([]),
      })
      .default({ eyebrow: '', headline: '', steps: [] }),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
    visitUs: z
      .object({
        eyebrow: z.string().default(''),
        headlineTemplate: z.string().default('Find us in {neighborhood}, Hyderabad.'),
        // The four card headings. Address / Hours / Parking each render at two
        // sites on this page, which is why they get one field rather than two.
        addressLabel: z.string().default('Address'),
        hoursLabel: z.string().default('Hours'),
        parkingLabel: z.string().default('Parking'),
        teachHereLabel: z.string().default('What we teach here'),
        // Templates, not prose: the phone number, the studio name and the photo
        // caption are all filled from the studio record, so hand-typed copy can
        // never disagree with it. This is the same rule the confirmation page's
        // contact block follows, and for the same reason.
        callTemplate: z.string().default('Call {phone}'),
        mapTitle: z.string().default('Map to {studio}'),
        photoAlt: z.string().default('Inside {studio}'),
      })
      .default({}),
    // The style finder. Its two TRACKS stay in code: their ids key the batch
    // lookup and DENY_IDS blocks *.id / *.*.id for every role including owner,
    // so the array cannot move into content without splitting one record across
    // two homes. The chrome around it is all editable.
    styleFinder: z
      .object({
        eyebrow: z.string().default('Style Finder'),
        headline: z.string().default('Two beginner tracks. Find yours.'),
        lead: z
          .string()
          .default(
            'Both are built for first-timers — no experience, no partner needed. Pick the time that suits you and we’ll point you to the next beginner batch.',
          ),
        resetLabel: z.string().default('Reset'),
        question: z.string().default('When can you make it?'),
        recommendEyebrow: z.string().default('We recommend'),
        nextBatchLabel: z.string().default('Next beginner batch'),
        startsTemplate: z.string().default('Starts {date} · {price}'),
        startedTemplate: z.string().default('Started {date} · {price}'),
      })
      .default({}),
    /** The eyebrow above the Why Furor block. Its headline and points already
     *  live in whyFuror, which /admin/site owns; only this word was stranded. */
    whyFurorEyebrow: z.string().default('Why Furor'),
  })
  .default({});

const AboutPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    introParagraphs: z.array(z.string()).default([]),
    moments: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        lead: z.string().default(''),
        photos: z
          .array(z.object({ src: z.string(), alt: z.string() }))
          .default([]),
      })
      .default({ eyebrow: '', headline: '', lead: '', photos: [] }),
    stats: z
      .array(z.object({ k: z.string(), v: z.string() }))
      .default([]),
    timeline: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        milestones: z
          .array(
            z.object({
              year: z.string(),
              title: z.string(),
              body: z.string(),
            }),
          )
          .default([]),
      })
      .default({ eyebrow: '', headline: '', milestones: [] }),
    beyond: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        cards: z
          .array(z.object({ title: z.string(), body: z.string() }))
          .default([]),
      })
      .default({ eyebrow: '', headline: '', cards: [] }),
    teamTeaser: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        linkLabel: z.string().default('See instructors'),
      })
      .default({ eyebrow: '', headline: '', linkLabel: 'See instructors' }),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
  })
  .default({});

const FaqsPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    sections: z
      .array(
        z.object({
          section: z.string(),
          items: z
            .array(z.object({ q: z.string(), a: z.string() }))
            .default([]),
        }),
      )
      .default([]),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
  })
  .default({});

const ContactPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    tiles: z
      .object({
        whatsappLabel: z.string().default('WhatsApp · fastest'),
        whatsappBody: z.string().default(''),
        emailLabel: z.string().default('Email'),
        emailBody: z.string().default(''),
        instagramLabel: z.string().default('Instagram'),
        instagramBody: z.string().default(''),
      })
      .default({
        whatsappLabel: 'WhatsApp · fastest',
        whatsappBody: '',
        emailLabel: 'Email',
        emailBody: '',
        instagramLabel: 'Instagram',
        instagramBody: '',
      }),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
  })
  .default({});

const InstructorsPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    testimonialsHeader: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
  })
  .default({});

// Backs /stories and /dance-styles — two pages with two different shipped
// titles, which is exactly why seoTitle defaults to '' here and each route
// supplies its own fallback from PAGE_SEO_DEFAULTS. (/batches gets its own
// BatchesPageSchema in this plan, because it also owns 34 browser strings.)
const SimpleIntroPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
  })
  .default({});

// The /batches screen's own copy. Facet headings, quick picks, the filter-bar
// chrome and the derived option labels belong to this one page, so they live
// with it rather than in the global `labels` bag — the studio edits batches-page
// wording on the batches screen, and keeping 34 strings out of a document key
// that is parsed on every request keeps that key's node count flat.
//
// The stored facet VALUES (Foundation / Filling Fast / Weekend / This month /
// Morning …) are live URL state in BatchesBrowser — read from the query string,
// compared, and shared in bookmarked links. They never change; only what a
// visitor reads does.
const BatchesPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    browser: z
      .object({
        // — Quick picks. All five render inside a .pill —
        presetBeginner: z.string().default('🔰 Never danced? Start here'),
        presetWeekend: z.string().default('🗓️ Weekend classes'),
        presetEvening: z.string().default('🌙 Evening classes'),
        presetStartingSoon: z.string().default('⚡ Starting soon'),
        presetFillingFast: z.string().default('🔥 Filling fast'),

        // — Facet group headings —
        facetStyle: z.string().default('Dance'),
        facetLevel: z.string().default('Level'),
        facetBranch: z.string().default('Studio'),
        facetTod: z.string().default('Time of day'),
        facetDays: z.string().default('Days'),
        facetStarting: z.string().default('Starting'),
        facetPrice: z.string().default('Price'),
        facetStatus: z.string().default('Availability'),

        // — Filter bar chrome —
        filterQuickPicks: z.string().default('Quick picks'),
        filterShowAll: z.string().default('All filters'),
        filterHide: z.string().default('Hide filters'),
        filterClearAll: z.string().default('Clear all'),
        filterClearAction: z.string().default('Clear filters'),
        filterRemoveTitle: z.string().default('Remove filter'),
        filterSortLabel: z.string().default('Sort'),
        filterSortLevel: z.string().default('Beginner → advanced'),
        filterSortSoon: z.string().default('Soonest first'),
        filterSortLate: z.string().default('Latest first'),
        filterWeekends: z.string().default('Weekends'),
        filterWeekdays: z.string().default('Weekdays'),

        // — Display labels for derived option values. All eight render inside
        //   a .pill; the values themselves are URL state and do not move. —
        todMorning: z.string().default('Morning'),
        todAfternoon: z.string().default('Afternoon'),
        todEvening: z.string().default('Evening'),
        startingThisMonth: z.string().default('This month'),
        startingNext30: z.string().default('Next 30 days'),
        startingLater: z.string().default('Later'),

        // — Row templates. {n} and {total} are filled from live counts. —
        resultCount: z.string().default('{n} of {total} batches'),
        seatsTemplate: z.string().default('{n} seats'),
        startsPrefix: z.string().default('starts'),
        /** Replaces "{startsPrefix} {date}" once the batch has started. */
        startedLine: z.string().default('started {date} — you can still join'),
        // The board's labeled price flip, so the comparison page stops
        // framing the ₹6,900 program fee as the cost of showing up.
        trialPriceLine: z.string().default('First class {price}'),
        fullProgramLine: z.string().default('Full program {price} — decide after class one.'),
        fullProgramOnlyLine: z.string().default('Full program {price} — pay in full to register.'),
      })
      .default({}),
  })
  .default({});

// Privacy / Terms / similar long-form documents. Each section is a sub-heading
// + a paragraph (markdown not required — keep editing friction-free).
const LegalSectionSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
});

export const LegalPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: 'Legal', headline: '', lead: '' }),
    lastUpdated: z.string().default(''),
    sections: z.array(LegalSectionSchema).default([]),
  })
  .default({});

const PagesSchema = z
  .object({
    home: HomePageSchema,
    about: AboutPageSchema,
    faqs: FaqsPageSchema,
    contact: ContactPageSchema,
    instructorsPage: InstructorsPageSchema,
    stories: SimpleIntroPageSchema,
    danceStyles: SimpleIntroPageSchema,
    batches: BatchesPageSchema,
    privacy: LegalPageSchema,
    terms: LegalPageSchema,
  })
  .default({});

// A flexible content block for admin-built custom pages. Blocks render top to
// bottom in order; new block types can be added to this union without breaking
// existing data (unknown future types would simply fail validation, so keep
// readers tolerant). `type` is the discriminator.
export const CustomBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string().default('') }),
  z.object({ type: z.literal('text'), body: z.string().default('') }),
  z.object({
    type: z.literal('image'),
    url: safeUrl().default(''),
    alt: z.string().default(''),
    caption: z.string().default(''),
  }),
  z.object({
    type: z.literal('button'),
    label: z.string().default(''),
    href: safeUrl().default(''),
    variant: z.enum(['primary', 'secondary']).default('primary'),
  }),
]);

// Admin-creatable pages. Lives at /p/<slug>. A page is an intro header plus an
// ordered list of `blocks` (heading / text / image / button). `sections` is the
// legacy text-only shape kept for backward compatibility — the editor migrates
// it into blocks on first edit, and the renderer falls back to it when a page
// has no blocks yet.
export const CustomPageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens'),
  title: z.string().min(1),
  navLabel: z.string().default(''),
  seoDescription: z.string().default(''),
  showInFooter: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  published: z.boolean().default(true),
  // Thin pages (payment confirmations etc.) must not be indexed or sitemapped.
  noindex: z.boolean().default(false),
  intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
  sections: z.array(LegalSectionSchema).default([]),
  blocks: z.array(CustomBlockSchema).default([]),
  displayOrder: z.number().int().default(0),
});

// Post-payment "welcome" / confirmation pages at /welcome/<track>. The intake
// date, venue, class times and add-to-calendar links are derived live from
// Batches + Studios — only the copy and per-track labels live here. `text`
// fields support {placeholders} (e.g. {number}, {arriveBy}, {trackLabel},
// {date}) that are filled in at render time. Defaults reproduce the original
// hardcoded copy so existing pages are unchanged until edited.
const WelcomeTrackSchema = z.object({
  key: z.string().min(1),
  trackLabel: z.string().default(''),
  styleSlugs: z.array(z.string()).default([]),
  // Which batch this page binds to, with styleSlugs and weekendTod. Defaults
  // to Foundation because every track predating this field was a beginner
  // intake — stored documents without it keep behaving exactly as before.
  level: z.enum(['Foundation', 'Intermediate', 'Advanced']).default('Foundation'),
  weekendTod: z.enum(['AM', 'PM']).default('AM'),
  whenDays: z.string().default(''),
  whenTime: z.string().default(''),
  arriveBy: z.string().default(''),
  metaDesc: z.string().default(''),
});

const WelcomeSchema = z
  .object({
    // Confirmed state
    confirmedBadge: z.string().default('Registration confirmed'),
    confirmedHeadline: z.string().default('You’re in. 🎉'),
    reminderWithDate: z
      .string()
      .default('Reminder: your {trackLabel} intake is on {date}.'),
    reminderNoDate: z
      .string()
      .default(
        'Reminder: your {trackLabel} intake is this coming weekend — we’ll confirm the exact date on WhatsApp.',
      ),
    thankYouBody: z
      .string()
      .default(
        'Thank you for registering — this is the first step in your dance journey. Here are a couple of things to do right away.',
      ),
    // The two action cards
    step1Title: z.string().default('Save our WhatsApp number'),
    step1Body: z
      .string()
      .default(
        'Save {number} as “Furor Hyderabad” — so you get timely reminders for your class and can reach us anytime.',
      ),
    step2Title: z.string().default('Add it to your calendar'),
    step2Body: z
      .string()
      .default(
        'Come early by {arriveBy} to sort out your registration. Add a reminder so the date doesn’t slip.',
      ),
    // Intake details
    intakeHeading: z.string().default('Your intake details'),
    whatToBringHeading: z.string().default('What to wear & bring'),
    whatToBring: z
      .array(z.string())
      .default([
        'Smart comfort wear — tees / tracks',
        'Fresh socks (for footwear)',
        'A personal water bottle / sipper — refill at the studio',
      ]),
    // Sign-off block
    signoffHeadline: z.string().default('See you in class! 💃🕺'),
    signoffBody: z
      .string()
      .default('Any questions before then? Just message us on WhatsApp — we reply fast.'),
    signoffName: z.string().default('Cheers, Rish'),
    signoffTagline: z.string().default('Furor Hyderabad · Dance for Life'),
    // The social offered at the moment of maximum enthusiasm — the product
    // principle "the social is the product" finally reaches the funnel's
    // peak-end. {when} and {venue} fill from `tonight` at render time; the
    // block is skipped entirely when the social is unconfigured.
    rumbaHeading: z.string().default('Your first La Rumba'),
    rumbaBody: z.string().default(
      'Class is one half — the social is the other. La Rumba runs {when} at {venue}, entry at the venue. Come watch this Saturday; by the end of your batch you’ll be dancing it.',
    ),
    // Payment-not-confirmed state
    unconfirmedBadge: z.string().default('Payment not confirmed'),
    unconfirmedHeadline: z.string().default('We couldn’t confirm your payment yet'),
    unconfirmedBody: z
      .string()
      .default(
        'It looks like the payment for your {trackLabel} didn’t complete. If any money was deducted, don’t worry — message us and we’ll sort it out right away.',
      ),
    // The <title> of the confirmation page. It is noindex, so this is not an
    // SERP budget question — it is the browser tab and the WhatsApp link
    // preview, both of which the studio should own. Blank falls back to
    // PAGE_SEO_DEFAULTS.welcome.title.
    seoTitle: z.string().default(''),
    // Payment-not-confirmed actions
    unconfirmedCta: z.string().default('Message us on WhatsApp'),
    tryAgainLabel: z.string().default('Try again'),
    referenceLabel: z.string().default('Reference: {id}'),
    // Confirmed-state actions
    paymentReferenceLabel: z.string().default('Payment reference: {id}'),
    gcalLabel: z.string().default('Google Calendar'),
    icsLabel: z.string().default('Apple / Outlook (.ics)'),
    // Intake grid. The headings are copy; the venue, days, time and arrival
    // time inside them are derived from the batch and studio records, so the
    // studio can say anything warm it likes and still cannot make the address
    // or the date wrong. The "Where" heading is NOT here — it is Plan 1's
    // labels.welcomeWhereHeading, which WelcomeView renders via label().
    whenHeading: z.string().default('When'),
    noVenueNote: z.string().default('We’ll share the exact address on WhatsApp.'),
    noDateNote: z
      .string()
      .default('We’ll confirm the exact date on WhatsApp and send you a reminder.'),
    whenEvery: z.string().default('Every {days}'),
    arriveByNote: z.string().default('Please arrive by {time} for registration.'),
    tracks: z
      .array(WelcomeTrackSchema)
      .default([
        {
          key: 'latin',
          trackLabel: 'Latin beginner class',
          styleSlugs: ['salsa', 'bachata'],
          weekendTod: 'AM',
          whenDays: 'Saturday & Sunday',
          whenTime: '9:30 AM – 10:30 AM',
          arriveBy: '9:15 AM',
          metaDesc: 'Your Latin beginner intake details and next steps.',
        },
        {
          key: 'wcs',
          trackLabel: 'West Coast Swing beginner class',
          styleSlugs: ['west-coast-swing'],
          weekendTod: 'PM',
          whenDays: 'Saturday & Sunday',
          whenTime: '6:30 PM – 7:30 PM',
          arriveBy: '6:15 PM',
          metaDesc: 'Your West Coast Swing beginner intake details and next steps.',
        },
      ]),
  })
  .default({});

// ─── Cross-cutting labels ──────────────────────────────────────────────────
// The 56 strings that recur across many components and have no natural owning
// section: CTA verbs, nav items, badge labels, empty states, screen-reader
// text. Section-specific headings and body copy do NOT live here — they go on
// their own page/section object, following the ctaLabel / whatsappLabel
// convention already used above (TrialSchema).
//
// FLAT on purpose. Every public request runs a full SiteContentSchema.parse
// under the Workers free-plan 10ms CPU cap, and Zod cost scales with node
// count: 56 string leaves in one object is linear growth; the same 56 split
// across nested groups is not. Flat also lets /admin/labels render as one
// searchable grid instead of a stack of accordions.
//
// Every default is the exact literal shipping today, with two documented
// exceptions. (1) The four ariaSocial* labels have no render site yet — they
// exist so the header/footer social icons consume an editable string instead
// of hardcoding a fresh one. (2) welcomeCallPhone STILL has no render site.
// Its 'Call {phone}' default disagrees with the "Call the studio" literal
// welcome-contact.ts actually builds, and rendering it would both rewrite live
// copy and repeat the number already shown beside it — so wiring it is a copy
// decision for the owner, not a mechanical one. The other four welcome keys
// (welcomeWhereHeading, welcomeOpenMap, welcomeParking, welcomeReachUs) were
// dead in exactly this way until Plan 4 wired them into WelcomeView.
//
// The lesson those four cost: a key declared here without a render site in the
// SAME change is a field the owner can edit to no effect. Wire it or omit it.
//
// A REQUIRED field here would fail validation on read and serve the bundled
// seed site-wide, so defaults are what make this a no-migration change.
//
// The literal values below (imported as `L`) live in ./label-defaults, NOT
// inline, and that split is load-bearing, not style: labels.ts's exported
// LABEL_DEFAULTS is value-imported by public 'use client' components
// (EnquiryCTA, FloatingTalkToUs — the latter mounted in the root layout, so
// on every route), and label-defaults.ts has zero imports, in particular no
// zod. If these defaults were inlined here instead, labels.ts would have to
// value-import THIS module to read them, and this module value-imports zod —
// dragging zod and the rest of this 700+ line schema into the client bundle
// on every route. Keep it that way: never import zod, or anything that
// imports zod, into label-defaults.ts.
export const LabelsSchema = z
  .object({
    // — Calls to action —
    ctaChatWhatsapp: z.string().default(L.ctaChatWhatsapp),
    ctaEnquireWhatsapp: z.string().default(L.ctaEnquireWhatsapp),
    ctaDmInstagram: z.string().default(L.ctaDmInstagram),
    ctaBookFoundation: z.string().default(L.ctaBookFoundation),
    ctaBookTrial: z.string().default(L.ctaBookTrial),
    ctaBookSeat: z.string().default(L.ctaBookSeat),
    ctaChatFirst: z.string().default(L.ctaChatFirst),
    ctaChatFirstWhatsapp: z.string().default(L.ctaChatFirstWhatsapp),
    ctaChatOnWhatsapp: z.string().default(L.ctaChatOnWhatsapp),
    ctaEnquire: z.string().default(L.ctaEnquire),
    ctaGrabSeatWhatsapp: z.string().default(L.ctaGrabSeatWhatsapp),
    ctaTalkToUs: z.string().default(L.ctaTalkToUs),
    talkToUsHint: z.string().default(L.talkToUsHint),
    ctaAllStyles: z.string().default(L.ctaAllStyles),
    ctaExplore: z.string().default(L.ctaExplore),
    ctaGetDirections: z.string().default(L.ctaGetDirections),
    ctaCall: z.string().default(L.ctaCall),
    ctaWhatsapp: z.string().default(L.ctaWhatsapp),
    ctaBookOnWhatsapp: z.string().default(L.ctaBookOnWhatsapp),
    ctaSeatsFullWhatsapp: z.string().default(L.ctaSeatsFullWhatsapp),

    // — Navigation —
    navHome: z.string().default(L.navHome),
    navAbout: z.string().default(L.navAbout),
    navDanceStyles: z.string().default(L.navDanceStyles),
    navInstructors: z.string().default(L.navInstructors),
    navBatches: z.string().default(L.navBatches),
    navBlog: z.string().default(L.navBlog),
    navFaqs: z.string().default(L.navFaqs),
    navContact: z.string().default(L.navContact),
    navExplore: z.string().default(L.navExplore),
    navPrivacy: z.string().default(L.navPrivacy),
    navTerms: z.string().default(L.navTerms),

    // — Empty states —
    emptyNoBatches: z.string().default(L.emptyNoBatches),
    emptyNewBatchesTitle: z.string().default(L.emptyNewBatchesTitle),
    emptyNewBatchesBody: z.string().default(L.emptyNewBatchesBody),
    emptyNoFinderBatch: z.string().default(L.emptyNoFinderBatch),

    // — Badges. These are DISPLAY labels for the status enum; the enum VALUES
    //   are live URL state in BatchesBrowser and never change.
    badgeFillingFast: z.string().default(L.badgeFillingFast),
    badgeOpen: z.string().default(L.badgeOpen),
    badgeClosed: z.string().default(L.badgeClosed),
    badgeBookingOpen: z.string().default(L.badgeBookingOpen),
    badgeFirstTimersWelcome: z.string().default(L.badgeFirstTimersWelcome),
    badgeFoundationStartHere: z.string().default(L.badgeFoundationStartHere),

    // — Screen-reader / icon-only controls —
    ariaHome: z.string().default(L.ariaHome),
    ariaPrimaryNav: z.string().default(L.ariaPrimaryNav),
    ariaToggleMenu: z.string().default(L.ariaToggleMenu),
    ariaMenu: z.string().default(L.ariaMenu),
    ariaOpenTalkToUs: z.string().default(L.ariaOpenTalkToUs),
    ariaCloseTalkToUs: z.string().default(L.ariaCloseTalkToUs),
    ariaClose: z.string().default(L.ariaClose),
    // No render site yet. These four exist so the header and footer social
    // icons have an editable label to consume the day they ship.
    ariaSocialInstagram: z.string().default(L.ariaSocialInstagram),
    ariaSocialFacebook: z.string().default(L.ariaSocialFacebook),
    ariaSocialYoutube: z.string().default(L.ariaSocialYoutube),
    ariaSocialWhatsapp: z.string().default(L.ariaSocialWhatsapp),

    // — Post-payment (the /welcome/[track] page) —
    //   All five are rendered by WelcomeView.tsx via label(labels, …). They
    //   were declared here ahead of their render sites and sat DEAD for two
    //   plans: Plan 3 built the parking line, the "Reach us" block and the
    //   call link but left them as hardcoded literals, so editing these four
    //   in the admin changed nothing on the page. Plan 4 wired them up. If you
    //   add a key here, add its render site in the same change. Do NOT rename
    //   welcomeOpenMap to welcomeGetDirections: the map link reads "Open map →"
    //   today, and a "Get directions →" default would rewrite live copy.
    welcomeWhereHeading: z.string().default(L.welcomeWhereHeading),
    welcomeOpenMap: z.string().default(L.welcomeOpenMap),
    welcomeParking: z.string().default(L.welcomeParking),
    welcomeReachUs: z.string().default(L.welcomeReachUs),
    welcomeCallPhone: z.string().default(L.welcomeCallPhone),
  })
  .default({});

/**
 * Copy that shipped as a default and has since been reworded.
 *
 * The save path writes the FULLY-DEFAULTED document back to storage
 * (content-write.ts stringifies the parsed result), so the first admin save
 * bakes every default of that moment into stored bytes. From then on the
 * stored value shadows the default permanently: rewording a default still
 * works on a fresh install and does nothing in production. That is exactly
 * how the board kept rendering the retired wording after a rename — the
 * string was no longer anywhere in the code, only in R2.
 *
 * A stored string that still matches a retired default BYTE FOR BYTE was
 * never a decision; it is a persisted default, and upgrading it is what the
 * reword was meant to do. Anything the studio actually reworded fails the
 * exact match and is left alone — production’s "Course Registration" button
 * is a real edit and stays exactly as the owner set it.
 *
 * Exact whole-string matches only. Substring rewriting would edit sentences
 * the studio wrote deliberately, which is not this function’s business.
 */
const RETIRED_COPY = new Map<string, string>([
  // labels.ctaBookTrial
  ["Book my trial class", "Book my first class"],
  // pages.home.board.trialPrice
  ["Trial class {price}", "First class {price}"],
  // pages.home.board.leadWithPrice
  ["Trial classes from {price} — come once, meet the room, then decide on the full program.", "First class from {price} — come once, meet the room, then decide on the full program."],
  // pages.home.board.leadWithPrice, the default before that
  ["Every batch opens with a {price} trial class — come once, meet the room, then decide on the full program.", "First class from {price} — come once, meet the room, then decide on the full program."],
  // pages.home.board.countInFallbackBody — framed the fee as a deposit held against something else
  ["The token books a single class — no package, no sign-up. You decide on the full program after.", "Booking covers a single class — no package, no sign-up. You decide on the full program after."],
  // pages.terms.sections[2].body
  ["The paid trial class fee is non-refundable — it books one class, and that seat is held for you whether or not you attend. For full batch programs, refunds are available before the batch starts. Once the batch has begun, refunds are pro-rated for the remaining unattended classes and require at least 7 days' notice. Refunds for missed classes that were eligible for a make-up are not available.", "The single class fee is non-refundable — it books one class, and that seat is held for you whether or not you attend. For full batch programs, refunds are available before the batch starts. Once the batch has begun, refunds are pro-rated for the remaining unattended classes and require at least 7 days' notice. Refunds for missed classes that were eligible for a make-up are not available."],
  // labels.ctaBookSeat — vague about what the click commits you to
  ["Book my seat", "Course Registration"],
  // pages.home.board.fullProgramOnly — left the payment terms unstated
  ["Full program {price}", "Full program {price} — pay in full to register."],
  // customPages[0].blocks[7].body
  ["When\n\nEvery \nSaturday & Sunday 9:30–10:30 AM\n\nPlease arrive by 9:15 AM for registration for your first trial session on Saturday.\n", "When\n\nEvery \nSaturday & Sunday 9:30–10:30 AM\n\nPlease arrive by 9:15 AM for registration before your first class on Saturday.\n"],
  // site.whatsappTemplates.styleFinder — read like a machine wrote it, which
  // suppresses sends; the visitor has to be happy putting these words in
  // their own mouth.
  ["Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.", "Hi Furor! {style} {level}{where} looks right for me. When does the next batch start?"],
  // tonight.ctaLabel — "RSVP" contradicted the FAQ's "no pre-booking needed".
  ["WhatsApp to RSVP", "Say you’re coming"],
  // welcome.signoffHeadline — the page addresses one person, not a crowd.
  ["See you all in class! 💃🕺", "See you in class! 💃🕺"],
]);

/**
 * Swap retired defaults for their replacements anywhere in a stored document.
 *
 * Runs as a preprocess so every read path and the write path get it from one
 * place, and so the next admin save persists the upgrade instead of re-baking
 * the stale string. Returns the input unchanged when nothing matched, so an
 * already-current document costs one walk and no allocation.
 */
function upgradeRetiredCopy(input: unknown): unknown {
  if (typeof input === 'string') return RETIRED_COPY.get(input) ?? input;
  if (Array.isArray(input)) {
    let changed = false;
    const out = input.map((v) => {
      const next = upgradeRetiredCopy(v);
      if (next !== v) changed = true;
      return next;
    });
    return changed ? out : input;
  }
  if (input && typeof input === 'object') {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      // JSON.parse yields __proto__ as an OWN key and `out[k] =` would walk
      // the setter and pollute Object.prototype. Same guard as content-merge.
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const next = upgradeRetiredCopy(v);
      if (next !== v) changed = true;
      out[k] = next;
    }
    return changed ? out : input;
  }
  return input;
}

/** The object shape itself. Exported for roles.test.ts, which enumerates the
 *  top-level editable sections and cannot reach `.shape` through a preprocess
 *  wrapper. Parse through `SiteContentSchema`, never through this. */
export const SiteContentObjectSchema = z.object({
  version: z.literal(1),
  site: SiteSettingsSchema,
  hero: HeroSchema,
  tonight: TonightSchema.default({
    enabled: false,
    headline: '',
    body: '',
    when: '',
    ctaLabel: 'Say you’re coming',
    ctaContext: '',
  }),
  trial: TrialSchema.default({
    enabled: true,
    eyebrow: 'Weekend',
    headline: 'Weekend classes at Jubilee Hills',
    body: 'Open Salsa, Bachata and West Coast Swing batches every Saturday and Sunday. Beginner-friendly. No partner needed.',
    when: 'Sat & Sun · Jubilee Hills',
    ctaLabel: 'See weekend batches',
    // Plain path, no query. /batches ignores search params entirely (there is
    // no searchParams read in the page or BatchesBrowser), so "?days=Weekend"
    // filtered nothing — it only produced a parameterised, uppercase URL whose
    // canonical pointed at /batches, i.e. a self-inflicted duplicate.
    ctaHref: '/batches',
    whatsappLabel: 'Or chat on WhatsApp',
    ctaContext: 'a weekend Salsa or Bachata class',
    footnote: '',
  }),
  whyFuror: z
    .object({
      headline: z.string(),
      points: z.array(z.object({ title: z.string(), body: z.string() })),
    })
    .default({ headline: '', points: [] }),
  danceStyles: z.array(DanceStyleSchema).default([]),
  studios: z.array(StudioSchema).default([]),
  batches: z.array(BatchSchema).default([]),
  instructors: z.array(InstructorSchema).default([]),
  testimonials: z.array(TestimonialSchema).default([]),
  stories: z.array(StorySchema).default([]),
  pages: PagesSchema,
  customPages: z.array(CustomPageSchema).default([]),
  welcome: WelcomeSchema,
  labels: LabelsSchema,
});

/**
 * The parse entry point for every read and write path.
 *
 * Wrapped so retired copy is upgraded before validation. Keep this the only
 * exported parser: a caller reaching for SiteContentObjectSchema.parse would
 * silently skip the migration.
 */
export const SiteContentSchema = z.preprocess(upgradeRetiredCopy, SiteContentObjectSchema);

export type SiteContent = z.infer<typeof SiteContentSchema>;
export type DanceStyle = z.infer<typeof DanceStyleSchema>;
export type Studio = z.infer<typeof StudioSchema>;
export type Batch = z.infer<typeof BatchSchema>;
export type Instructor = z.infer<typeof InstructorSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Pages = z.infer<typeof PagesSchema>;
export type LegalPage = z.infer<typeof LegalPageSchema>;
export type CustomPage = z.infer<typeof CustomPageSchema>;
export type CustomBlock = z.infer<typeof CustomBlockSchema>;
export type Welcome = z.infer<typeof WelcomeSchema>;
export type WelcomeTrack = z.infer<typeof WelcomeTrackSchema>;
export type Labels = z.infer<typeof LabelsSchema>;
export type WhatsappTemplates = z.infer<typeof WhatsappTemplatesSchema>;
export type BatchesPage = z.infer<typeof BatchesPageSchema>;
