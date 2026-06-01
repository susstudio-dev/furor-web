import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/lib/content';
import { visibleBatches } from '@/lib/content-helpers';
import { formatBatchDate } from '@/lib/format';
import { Reveal } from '@/components/Reveal';

// Post-payment landing page, one per beginner track. Set the matching URL as
// the "redirect after payment" on each Razorpay payment page:
//   Latin Beginner  → /welcome/latin
//   WCS Beginner     → /welcome/wcs
// noindex — this is a post-registration confirmation, not a public/SEO page.

type TrackKey = 'latin' | 'wcs';

interface WelcomeConfig {
  trackLabel: string; // e.g. "Latin beginner class"
  styleSlugs: string[]; // used to find the matching Foundation batch for the date
  weekendTod: 'AM' | 'PM';
  whenDays: string;
  whenTime: string;
  arriveBy: string;
  metaDesc: string;
}

// NOTE: the WCS times below are placeholders — confirm the real weekend-evening
// time + arrival time and I'll lock them in.
const TRACKS: Record<TrackKey, WelcomeConfig> = {
  latin: {
    trackLabel: 'Latin beginner class',
    styleSlugs: ['salsa', 'bachata'],
    weekendTod: 'AM',
    whenDays: 'Saturday & Sunday',
    whenTime: '9:30 AM – 10:30 AM',
    arriveBy: '9:15 AM',
    metaDesc: 'Your Latin beginner intake details and next steps.',
  },
  wcs: {
    trackLabel: 'West Coast Swing beginner class',
    styleSlugs: ['west-coast-swing'],
    weekendTod: 'PM',
    whenDays: 'Saturday & Sunday',
    whenTime: '6:30 PM – 7:30 PM',
    arriveBy: '6:15 PM',
    metaDesc: 'Your West Coast Swing beginner intake details and next steps.',
  },
};

// Shared studio details (same venue for both tracks).
const WHATSAPP_DISPLAY = '+91 88860 72572';
const MAP_URL = 'https://maps.app.goo.gl/svNQ1bh2Afv6PYnCA';
const VENUE = 'Nicy Joseph Dance & Fitness, 2nd Floor, Alcazar Mall, Road No. 36, Jubilee Hills';

export function generateStaticParams() {
  return Object.keys(TRACKS).map((track) => ({ track }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const cfg = TRACKS[track as TrackKey];
  return {
    title: 'You’re in — Furor Hyderabad',
    description: cfg?.metaDesc ?? 'Your intake details and next steps.',
    robots: { index: false, follow: false },
  };
}

export default async function WelcomePage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const cfg = TRACKS[track as TrackKey];
  if (!cfg) notFound();

  const content = await getContent();
  const wa = content.site.whatsappNumber;

  // Intake date = next upcoming Foundation batch for this track (prefer weekend
  // in the right time-of-day), so the reminder is always accurate.
  const pool = visibleBatches(content).filter(
    (b) => b.level === 'Foundation' && b.styleSlugs.some((s) => cfg.styleSlugs.includes(s)),
  );
  const matchesTod = (b: (typeof pool)[number]) =>
    cfg.weekendTod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time);
  const isWeekend = (b: (typeof pool)[number]) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const next =
    pool.filter(isWeekend).find(matchesTod) ?? pool.find(isWeekend) ?? pool[0];
  const intakeDate = next ? formatBatchDate(next.startDate) : null;

  return (
    <>
      {/* Confirmation hero */}
      <section className="container-x pt-20 pb-10 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-ember-500/40 bg-ember-500/10 px-4 py-1.5 text-xs uppercase tracking-widest text-ember-400">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" /> Registration confirmed
          </span>
          <h1 className="mt-6 display text-4xl font-extrabold tracking-tight sm:text-6xl">
            You’re in. 🎉
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-lg text-cream/80">
            {intakeDate ? (
              <>
                Reminder: your <span className="font-semibold text-cream">{cfg.trackLabel}</span>{' '}
                intake is on <span className="font-semibold text-ember-400">{intakeDate}</span>.
              </>
            ) : (
              <>
                Reminder: your <span className="font-semibold text-cream">{cfg.trackLabel}</span>{' '}
                intake is this coming weekend — we’ll confirm the exact date on WhatsApp.
              </>
            )}
          </p>
          <p className="mt-4 mx-auto max-w-2xl text-cream/70">
            Thank you for registering — this is the first step in your dance journey. Here are a
            couple of things to do right away.
          </p>
        </Reveal>
      </section>

      {/* The two immediate steps */}
      <section className="container-x pb-4">
        <Reveal stagger className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-500 display text-lg font-bold text-ink-950">
              1
            </div>
            <p className="mt-4 display text-xl font-bold">Save our WhatsApp number</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              Save <span className="font-semibold text-cream">{WHATSAPP_DISPLAY}</span> as{' '}
              <span className="font-semibold text-cream">“Furor Hyderabad”</span> — so you get timely
              reminders for your class and can reach us anytime.
            </p>
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-5 inline-flex"
            >
              Open WhatsApp →
            </a>
          </div>
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-500 display text-lg font-bold text-ink-950">
              2
            </div>
            <p className="mt-4 display text-xl font-bold">Show up for class</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              Come early by <span className="font-semibold text-cream">{cfg.arriveBy}</span> to sort
              out your registration. Everything you need is right below — then just step onto the
              floor.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Intake details */}
      <section className="container-x py-10">
        <Reveal className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Your intake details</p>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">Where</p>
              <p className="mt-2 leading-relaxed text-cream/85">{VENUE}</p>
              <a
                href={MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-4 inline-flex"
              >
                Open map →
              </a>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">When</p>
              <p className="mt-2 leading-relaxed text-cream/85">
                Every <span className="font-semibold text-cream">{cfg.whenDays}</span>
                <br />
                {cfg.whenTime}
              </p>
              <p className="mt-2 text-sm text-cream/60">
                Please arrive by {cfg.arriveBy} for registration.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">What to wear &amp; bring</p>
              <ul className="mt-2 space-y-1.5 leading-relaxed text-cream/85">
                <li>• Smart comfort wear — tees / tracks</li>
                <li>• Fresh socks (for footwear)</li>
                <li>• A personal water bottle / sipper — refill at the studio</li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Sign-off */}
      <section className="container-x pb-24">
        <Reveal className="rounded-3xl bg-gradient-to-br from-ember-700 via-ember-600 to-gold-500 p-10 text-ink-950 sm:p-14">
          <p className="display text-3xl font-extrabold tracking-tight sm:text-4xl">
            See you all in class! 💃🕺
          </p>
          <p className="mt-4 max-w-xl text-ink-950/80">
            Any questions before then? Just message us on WhatsApp — we reply fast.
          </p>
          <div className="mt-6">
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !bg-ink-950 !text-cream hover:!bg-ink-800"
            >
              Chat on WhatsApp
            </a>
          </div>
          <p className="mt-8 font-semibold text-ink-950/90">Cheers, Rish</p>
          <p className="text-sm text-ink-950/70">Furor Hyderabad · Dance for Life</p>
        </Reveal>
      </section>
    </>
  );
}
