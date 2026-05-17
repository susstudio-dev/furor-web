import { z } from 'zod';

export const SiteSettingsSchema = z.object({
  title: z.string().min(1),
  tagline: z.string().min(1),
  whatsappNumber: z.string().regex(/^\d{10,15}$/, 'Digits only, no + or spaces'),
  instagramHandle: z.string().regex(/^[a-zA-Z0-9._]+$/),
  email: z.string().email().optional().or(z.literal('')),
  socials: z
    .object({
      instagram: z.string().url().optional().or(z.literal('')),
      facebook: z.string().url().optional().or(z.literal('')),
      youtube: z.string().url().optional().or(z.literal('')),
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
  videoMp4Url: z.string().url().optional().or(z.literal('')),
  videoWebmUrl: z.string().url().optional().or(z.literal('')),
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



export const BatchSchema = z.object({
  id: z.string().min(1),
  styleSlug: z.string().min(1),
  level: z.enum(['Foundation', 'Intermediate', 'Advanced']),
  branchSlug: z.string().min(1),
  daysOfWeek: z.array(
    z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  ).min(1),
  time: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  priceInr: z.number().int().nonnegative(),
  seatsLeft: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['Open', 'Filling Fast', 'Closed']),
  razorpayLink: z.string().url().nullable().optional(),
});

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
      instagram: z.string().url().optional().or(z.literal('')),
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
});

export type SiteContent = z.infer<typeof SiteContentSchema>;
export type DanceStyle = z.infer<typeof DanceStyleSchema>;
export type Studio = z.infer<typeof StudioSchema>;
export type Batch = z.infer<typeof BatchSchema>;
export type Instructor = z.infer<typeof InstructorSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Pages = z.infer<typeof PagesSchema>;
