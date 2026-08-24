/**
 * The 56 label literals shipping today — the single source of truth both
 * `LabelsSchema` (content-schema.ts) and `LABEL_DEFAULTS` (labels.ts) derive
 * from, instead of each restating its own copy.
 *
 * This module has ZERO imports — in particular, no zod. `labels.ts` is
 * value-imported by public client components (EnquiryCTA, FloatingTalkToUs),
 * and before this file existed, `labels.ts` computed its defaults by
 * value-importing `LabelsSchema` from content-schema.ts and calling
 * `LabelsSchema.parse({})` at module load — which pulled zod and the entire
 * 704-line content schema into the public client bundle on every route
 * (FloatingTalkToUs is mounted in the root layout). Keeping the literals here,
 * with no dependency on zod, lets `labels.ts` reach them without reaching
 * zod, while `content-schema.ts` (server-only — never value-imported by a
 * client file) still derives its own `.default(...)` values from the exact
 * same object, so the two can never drift.
 */
export const LABEL_DEFAULT_LITERALS = {
  // — Calls to action —
  ctaChatWhatsapp: 'Chat on WhatsApp',
  ctaEnquireWhatsapp: 'Enquire on WhatsApp',
  ctaDmInstagram: 'DM on Instagram',
  ctaBookFoundation: 'Book my first class',
  // Non-Foundation batches that DO sell a single first class. Ships the same
  // string as ctaBookFoundation because the only thing that ever differed
  // between them was the word "trial", which the studio does not run. The two
  // keys stay separate so a Foundation CTA can still be worded differently
  // from an Intermediate one without a code change.
  ctaBookTrial: 'Book my first class',
  // For a batch that sells no single class. These are Intermediate and
  // Advanced: nobody is sampling them, so the button names the transaction
  // that actually happens — the dancer registers for the course and pays the
  // whole fee. "Book my seat" left the terms vague; this is the studio's own
  // word for it, already live on the site before this key existed.
  ctaBookSeat: 'Course Registration',
  ctaChatFirst: 'or chat first',
  ctaChatFirstWhatsapp: 'or chat first on WhatsApp',
  ctaChatOnWhatsapp: 'or chat on WhatsApp',
  ctaEnquire: 'Enquire',
  ctaNotifyWhatsapp: 'Notify me on WhatsApp',
  ctaGrabSeatWhatsapp: 'Grab a seat on WhatsApp',
  ctaTalkToUs: 'Talk to us',
  ctaSeeAllBatches: 'See all batches',
  ctaAllStyles: 'All styles',
  ctaExplore: 'Explore →',
  ctaGetDirections: 'Get directions',
  ctaCall: 'Call',
  ctaWhatsapp: 'WhatsApp',
  // {book} is filled with the batch's own booking verb (bookLabel), so the
  // WhatsApp fallback can never disagree with the paid button beside it.
  ctaBookOnWhatsapp: '{book} on WhatsApp',

  // — Navigation —
  navHome: 'Home',
  navAbout: 'About',
  navDanceStyles: 'Dance Styles',
  navInstructors: 'Instructors',
  navBatches: 'Batches & Pricing',
  navBlog: 'Blog',
  navFaqs: 'FAQs',
  navContact: 'Contact',
  navExplore: 'Explore',
  navPrivacy: 'Privacy',
  navTerms: 'Terms',

  // — Empty states —
  emptyNoBatches:
    "No batches match these filters yet. Chat with us — we'll tell you when one opens.",
  emptyNextBatchSoon: 'Next {style} batch coming soon.',
  emptyNewBatchesTitle: 'New batches drop every week.',
  emptyNewBatchesBody: "Tell us your style — we'll hold you a seat in the next one.",
  emptyNoFinderBatch:
    'No upcoming {track} beginner batch listed yet — chat with us and we’ll tell you when the next one starts.',
  emptyNoFoundationForStyle: 'Danced before? No Foundation batch open for {style} right now.',

  // — Badges. These are DISPLAY labels for the status enum; the enum VALUES
  //   are live URL state in BatchesBrowser and never change.
  badgeFillingFast: 'Filling fast',
  badgeOpen: 'Open',
  badgeClosed: 'Closed',
  badgeBookingOpen: 'Booking open',
  badgeFirstTimersWelcome: 'first-timers welcome',
  badgeFoundationStartHere: 'Foundation · start here',

  // — Screen-reader / icon-only controls —
  ariaHome: 'Furor — Dance Hyderabad home',
  ariaPrimaryNav: 'Primary',
  ariaToggleMenu: 'Toggle menu',
  ariaMenu: 'Menu',
  ariaOpenTalkToUs: 'Open talk to us',
  ariaCloseTalkToUs: 'Close talk to us',
  ariaClose: 'Close',
  ariaSocialInstagram: 'Furor on Instagram',
  ariaSocialFacebook: 'Furor on Facebook',
  ariaSocialYoutube: 'Furor on YouTube',
  ariaSocialWhatsapp: 'Furor on WhatsApp',

  // — Post-payment (the /welcome/[track] page) —
  welcomeWhereHeading: 'Where',
  welcomeOpenMap: 'Open map →',
  welcomeParking: 'Parking: {notes}',
  welcomeReachUs: 'Reach us',
  welcomeCallPhone: 'Call {phone}',
};
