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
});

export const TonightSchema = z
  .object({
    enabled: z.boolean().default(false),
    headline: z.string().default(''),
    body: z.string().default(''),
    when: z.string().default(''),
    ctaLabel: z.string().default('WhatsApp to RSVP'),
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
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      'styleSlug' in val &&
      !('styleSlugs' in val)
    ) {
      const v = val as Record<string, unknown>;
      const { styleSlug, ...rest } = v;
      return {
        ...rest,
        styleSlugs: typeof styleSlug === 'string' && styleSlug ? [styleSlug] : [],
      };
    }
    return val;
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
    priceInr: z.number().int().nonnegative(),
    // Amount charged up front to reserve a seat (the Razorpay "book now"
    // deposit). priceInr stays the full course fee shown on the cards; this is
    // what the "Reserve my seat · ₹X" CTA advertises. Defaults to 500 so it
    // applies to existing batches without an explicit value.
    reservationInr: z.number().int().nonnegative().default(500),
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
    whatWeTeach: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),
    nextBatches: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),
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
        headlineTemplate: z
          .string()
          .default('Find us in {neighborhood}, Hyderabad.'),
      })
      .default({ eyebrow: '', headlineTemplate: 'Find us in {neighborhood}, Hyderabad.' }),
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
    batches: SimpleIntroPageSchema,
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
    signoffHeadline: z.string().default('See you all in class! 💃🕺'),
    signoffBody: z
      .string()
      .default('Any questions before then? Just message us on WhatsApp — we reply fast.'),
    signoffName: z.string().default('Cheers, Rish'),
    signoffTagline: z.string().default('Furor Hyderabad · Dance for Life'),
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
// of hardcoding a fresh one. (2) welcomeParking, welcomeReachUs and
// welcomeCallPhone have no render site yet either: the welcome page has no
// parking line, no "Reach us" block and no call link today. Plan 3 adds those
// three rows, so the defaults here are the literals PLAN 3 RENDERS, not
// literals lifted from the current file. The other two welcome keys are lifted
// from the current file (WelcomeView.tsx:254 and :265).
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
    ctaChatFirst: z.string().default(L.ctaChatFirst),
    ctaChatFirstWhatsapp: z.string().default(L.ctaChatFirstWhatsapp),
    ctaChatOnWhatsapp: z.string().default(L.ctaChatOnWhatsapp),
    ctaEnquire: z.string().default(L.ctaEnquire),
    ctaNotifyWhatsapp: z.string().default(L.ctaNotifyWhatsapp),
    ctaGrabSeatWhatsapp: z.string().default(L.ctaGrabSeatWhatsapp),
    ctaTalkToUs: z.string().default(L.ctaTalkToUs),
    ctaSeeAllBatches: z.string().default(L.ctaSeeAllBatches),
    ctaAllStyles: z.string().default(L.ctaAllStyles),
    ctaExplore: z.string().default(L.ctaExplore),
    ctaGetDirections: z.string().default(L.ctaGetDirections),
    ctaCall: z.string().default(L.ctaCall),
    ctaWhatsapp: z.string().default(L.ctaWhatsapp),

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
    emptyNextBatchSoon: z.string().default(L.emptyNextBatchSoon),
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
    //   welcomeWhereHeading and welcomeOpenMap are the literals shipping in
    //   WelcomeView.tsx today (:254 and :265). The other three have no render
    //   site yet — Plan 3 adds the parking line, the "Reach us" block and the
    //   call link, and these are the exact strings it renders. Do NOT rename
    //   welcomeOpenMap to welcomeGetDirections: the map link reads "Open map →"
    //   today, and a "Get directions →" default would rewrite live copy.
    welcomeWhereHeading: z.string().default(L.welcomeWhereHeading),
    welcomeOpenMap: z.string().default(L.welcomeOpenMap),
    welcomeParking: z.string().default(L.welcomeParking),
    welcomeReachUs: z.string().default(L.welcomeReachUs),
    welcomeCallPhone: z.string().default(L.welcomeCallPhone),
  })
  .default({});

export const SiteContentSchema = z.object({
  version: z.literal(1),
  site: SiteSettingsSchema,
  hero: HeroSchema,
  tonight: TonightSchema.default({
    enabled: false,
    headline: '',
    body: '',
    when: '',
    ctaLabel: 'WhatsApp to RSVP',
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
