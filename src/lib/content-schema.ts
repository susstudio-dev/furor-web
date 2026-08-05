import { z } from 'zod';

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
});

export const TonightSchema = z
  .object({
    enabled: z.boolean().default(false),
    headline: z.string().default(''),
    body: z.string().default(''),
    when: z.string().default(''),
    ctaLabel: z.string().default('WhatsApp to RSVP'),
    ctaContext: z.string().default(''),
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
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    testimonialsHeader: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),
    closingCta: CtaBlockSchema.default({ headline: '', body: '' }),
  })
  .default({});

const SimpleIntroPageSchema = z
  .object({ intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }) })
  .default({});

// Privacy / Terms / similar long-form documents. Each section is a sub-heading
// + a paragraph (markdown not required — keep editing friction-free).
const LegalSectionSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
});

export const LegalPageSchema = z
  .object({
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
    ctaHref: '/batches?days=Weekend',
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
