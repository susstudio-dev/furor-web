# Conversion Journey Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec `docs/superpowers/specs/2026-08-24-conversion-journey-design.md`: batch grace-window + admin guardrails, above-fold engagement fixes, the La Rumba proof band ("two front doors"), price-grammar consistency, and copy coherence — raising trial-booking and WhatsApp conversion for a nervous mobile beginner.

**Architecture:** Next.js 15 App Router on Cloudflare Workers (OpenNext). All public copy flows from one Zod-validated content document (`src/lib/content-schema.ts` → `data/site-content.json` locally, R2 in prod). Public pages are server components with a few small client components. Changes are schema-defaults + server rendering + CSS; net client JS must not grow.

**Tech Stack:** TypeScript, Next 15, React 19, Tailwind 3, Zod 3, Vitest 4.

## Global Constraints

- **Perf budget (binding):** app-authored client JS < 12 KB gz/route target; home is already over — no task may add a new client component or new client dependency. Phase 3 removes client work from home.
- **Truth constraint:** only real testimonials/photos/people/stats already in the content document or `public/photos/`. Never invent claims.
- **`src/lib/label-defaults.ts` must NEVER import anything** (especially zod, or anything importing zod). New label keys are added in BOTH `label-defaults.ts` and `LabelsSchema` (content-schema.ts), referencing `L.<key>`.
- **Every new label/schema field is optional-with-default** — a required field fails the read path and serves the seed site-wide.
- **Every new label key must have a public render site in the same task** — `src/lib/labels-wired.test.ts` fails otherwise. A key whose render site is deleted must be deleted from both `label-defaults.ts` and `LabelsSchema` (or added to `KNOWN_UNWIRED` with a reason).
- **Rewording a schema DEFAULT string requires a `RETIRED_COPY` entry** in content-schema.ts mapping old default → new (exact whole-string), because production saves bake defaults into stored bytes.
- **Dates are IST business dates** — always `todayIso()` from `src/lib/format.ts`, never `new Date().toISOString()`.
- **Commits:** style `feat:`/`fix:`/`docs:` lowercase, descriptive clause. **NEVER add a Co-Authored-By trailer** (owner rule for this environment).
- **Slow HDD:** do not run broad recursive Glob/Grep from repo root; read files by exact path, grep single files/folders only. Dev server uses `.next-dev`; `npm run build` uses `.next` and takes minutes — only Task 18 builds.
- **WhatsApp copy:** prefill templates and message-ish content must never contain `<`, `>`, `{{`, `}}`, or the literal word `undefined`.
- Run tests with `npm test` (vitest run); typecheck with `npm run typecheck`.

---

### Task 1: `joinUntil` grace-window visibility

**Files:**
- Modify: `src/lib/content-schema.ts` (BatchSchema, ~line 246)
- Modify: `src/lib/format.ts`
- Modify: `src/lib/content-helpers.ts`
- Test: `src/lib/content-helpers.test.ts`, `src/lib/content-schema.test.ts`, `src/lib/format.test.ts` (new)

**Interfaces:**
- Consumes: existing `todayIso()` (format.ts), `Batch` type.
- Produces: `addDaysIso(iso: string, days: number): string` (format.ts); `DEFAULT_JOIN_GRACE_DAYS = 14` and `isJoinable(b: Pick<Batch,'startDate'|'status'|'joinUntil'>, today: string): boolean` (content-helpers.ts); `Batch.joinUntil: string` (defaults `''`). `visibleBatches()` keeps its exact signature.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDaysIso } from './format';

describe('addDaysIso', () => {
  it('adds days within a month', () => {
    expect(addDaysIso('2026-08-01', 14)).toBe('2026-08-15');
  });
  it('rolls over month and year boundaries', () => {
    expect(addDaysIso('2026-12-25', 14)).toBe('2027-01-08');
  });
  it('handles leap years', () => {
    expect(addDaysIso('2028-02-20', 14)).toBe('2028-03-05');
  });
});
```

Append to `src/lib/content-helpers.test.ts` (also add `visibleBatches, isJoinable` to the existing import from `./content-helpers`, and add `joinUntil: ''` to the `batch()` factory's base object so the type stays complete after Step 3):

```ts
describe('grace-window visibility', () => {
  it('keeps a batch visible through the 14-day default grace after start', () => {
    expect(visibleBatches(content([batch({ id: 'g', startDate: future(-13) })]))).toHaveLength(1);
    expect(visibleBatches(content([batch({ id: 'g', startDate: future(-15) })]))).toHaveLength(0);
  });
  it('honours an explicit joinUntil over the default grace', () => {
    expect(
      visibleBatches(content([batch({ id: 'g', startDate: future(-30), joinUntil: future(1) })])),
    ).toHaveLength(1);
    expect(
      visibleBatches(content([batch({ id: 'g', startDate: future(-3), joinUntil: future(-1) })])),
    ).toHaveLength(0);
  });
  it('never shows a Closed batch regardless of dates', () => {
    expect(
      visibleBatches(content([batch({ id: 'g', startDate: future(5), status: 'Closed' })])),
    ).toHaveLength(0);
  });
  it('isJoinable answers the same question for a bare batch shape', () => {
    expect(isJoinable({ startDate: '2026-08-20', status: 'Open', joinUntil: '' }, '2026-08-24')).toBe(true);
    expect(isJoinable({ startDate: '2026-08-01', status: 'Open', joinUntil: '' }, '2026-08-24')).toBe(false);
  });
});
```

Also UPDATE the existing test `'ignores past-dated and closed batches'` in the `nextBatchPerStyle` describe: change `startDate: future(-9)` to `startDate: future(-20)` (with a 14-day grace, −9 days is now correctly visible) and rename it `'ignores lapsed (past-grace) and closed batches'`.

Append to `src/lib/content-schema.test.ts` (extend its imports with `BatchSchema` if not already imported):

```ts
describe('BatchSchema joinUntil', () => {
  const base = {
    id: 'b1', styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
    daysOfWeek: ['Sat'], time: '9:30–10:30 AM', startDate: '2026-09-01',
    priceInr: 6900, status: 'Open',
  };
  it('defaults to empty when absent, so stored documents parse unchanged', () => {
    expect(BatchSchema.parse(base).joinUntil).toBe('');
  });
  it('accepts a YYYY-MM-DD value', () => {
    expect(BatchSchema.parse({ ...base, joinUntil: '2026-10-01' }).joinUntil).toBe('2026-10-01');
  });
  it('rejects a non-date value', () => {
    expect(() => BatchSchema.parse({ ...base, joinUntil: 'soon' })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `addDaysIso` not exported, `isJoinable` not exported, `joinUntil` stripped by schema, grace tests failing.

- [ ] **Step 3: Implement**

`src/lib/format.ts` — append:

```ts
/** ISO date + n days. Pure calendar arithmetic on date-only strings — no
 *  timezone shift in or out. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

`src/lib/content-schema.ts` — inside `BatchSchema`'s inner `z.object`, directly after the `startDate` line, add:

```ts
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
```

`src/lib/content-helpers.ts` — replace the whole `visibleBatches` function and its imports block with:

```ts
import type { Batch, SiteContent } from './content-schema';
import { addDaysIso, todayIso } from './format';
import { levelRank } from './batch-order';

/** How long a batch stays publicly joinable past its start date when the
 *  studio has not set an explicit joinUntil. The Terms promise mid-batch
 *  joins with make-ups, so a started batch is still a sellable product. */
export const DEFAULT_JOIN_GRACE_DAYS = 14;

/** Whether this batch may still be sold today: not Closed, and today is on
 *  or before its explicit joinUntil (or startDate + the default grace). */
export function isJoinable(
  b: Pick<Batch, 'startDate' | 'status' | 'joinUntil'>,
  today: string,
): boolean {
  if (b.status === 'Closed') return false;
  const until = b.joinUntil || addDaysIso(b.startDate, DEFAULT_JOIN_GRACE_DAYS);
  return today <= until;
}

export function visibleBatches(content: SiteContent) {
  const today = todayIso();
  return content.batches
    .filter((b) => isJoinable(b, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites — including `roles.test.ts`, `content-schema.test.ts` untouched cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/lib/content-schema.ts src/lib/content-schema.test.ts src/lib/content-helpers.ts src/lib/content-helpers.test.ts
git commit -m "feat: batches stay joinable through a grace window instead of vanishing at startDate"
```

---

### Task 2: Admin `joinUntil` field + honest lapsed/started hints

**Files:**
- Modify: `src/app/admin/batches/BatchesEditor.tsx`

**Interfaces:**
- Consumes: `isJoinable`, `DEFAULT_JOIN_GRACE_DAYS` (content-helpers.ts), `addDaysIso`, `formatBatchDate`, `todayIso` (format.ts).
- Produces: admin can set `joinUntil`; fresh batches carry `joinUntil: ''`.

- [ ] **Step 1: Extend imports and the fresh-batch object**

In `BatchesEditor.tsx` change the format import line to:

```ts
import { formatBatchDate, formatInr, todayIso, addDaysIso } from '@/lib/format';
import { DEFAULT_JOIN_GRACE_DAYS, isJoinable } from '@/lib/content-helpers';
```

In `add()`, after `startDate: todayIso(),` add:

```ts
      joinUntil: '',
```

- [ ] **Step 2: Replace the lapsed hint and add the field**

Replace this block (currently under the Start date field):

```tsx
                {b.startDate && b.startDate < todayIso() ? (
                  <p className="mt-1.5 text-xs text-ember-400">
                    Hidden from the site — this start date has passed. Update it to show this batch
                    again.
                  </p>
                ) : null}
```

with:

```tsx
                {b.startDate && !isJoinable(b, todayIso()) && b.status !== 'Closed' ? (
                  <p className="mt-1.5 text-xs text-ember-400">
                    Hidden from the site — this batch is past its joinable window. Update the start
                    date (or set “Joinable until”) to show it again.
                  </p>
                ) : b.startDate && b.startDate < todayIso() ? (
                  <p className="mt-1.5 text-xs text-gold-400">
                    Started {formatBatchDate(b.startDate)} — still bookable until{' '}
                    {formatBatchDate(b.joinUntil || addDaysIso(b.startDate, DEFAULT_JOIN_GRACE_DAYS))}.
                  </p>
                ) : null}
```

Then, directly after the entire Start date `<Field>…</Field>`, insert a new field:

```tsx
              <Field
                label="Joinable until (optional)"
                hint="Last day this batch can still be booked. Blank = start date + 14 days, so late joiners keep seeing it (make-ups cover missed classes)."
              >
                <input
                  type="date"
                  value={b.joinUntil || ''}
                  onChange={(e) => patch(i, { joinUntil: e.target.value })}
                  className="input"
                />
              </Field>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/batches/BatchesEditor.tsx
git commit -m "feat: admin can set a batch's joinable-until date and sees honest lapsed/started hints"
```

---

### Task 3: Started-batch labeling everywhere a start date renders

**Files:**
- Modify: `src/lib/content-schema.ts` (board, batches browser, styleFinder, WhatsappTemplates schemas)
- Modify: `src/lib/enquiry.ts`
- Modify: `src/components/QuickEnroll.tsx`, `src/components/BatchesBrowser.tsx`, `src/components/StyleFinder.tsx`
- Test: `src/lib/enquiry.test.ts`

**Interfaces:**
- Consumes: `todayIso()`.
- Produces schema defaults: `pages.home.board.startedTemplate` = `'Started {date} · you can still join'`; `pages.batches.browser.startedLine` = `'started {date} — you can still join'`; `pages.home.styleFinder.startedTemplate` = `'Started {date} · {price}'`; `site.whatsappTemplates.batchStarted` = `"Hi Furor, I'd like to join the {style} {level} batch at {branch} ({days}, {time} — it started {date}). Can I still join?"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/enquiry.test.ts` (extend imports: `buildPrefilledMessage` from `./enquiry`; `WhatsappTemplatesSchema, type Batch` from `./content-schema` — keep whatever the file already imports):

```ts
describe('started-batch prefill', () => {
  const t = WhatsappTemplatesSchema.parse({});
  const mkBatch = (startDate: string) =>
    ({
      id: 'b1', styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
      daysOfWeek: ['Sat', 'Sun'], time: '9:30–10:30 AM', startDate,
      priceInr: 6900, trialInr: 500, seatsLeft: null, status: 'Open',
      razorpayLink: null, welcomeNote: '', joinUntil: '',
    }) as Batch;
  const ctxFor = (startDate: string) => ({
    source: 'batch_row' as const,
    style: { slug: 'salsa', name: 'Salsa' },
    branch: { slug: 'jh', name: 'Jubilee Hills' },
    batch: mkBatch(startDate),
  });

  it('asks to join a batch that has already started', () => {
    const msg = buildPrefilledMessage(ctxFor('2020-01-01'), t);
    expect(msg).toContain('Can I still join?');
    expect(msg).not.toContain('starting');
  });
  it('keeps the starting-soon wording for a future batch', () => {
    expect(buildPrefilledMessage(ctxFor('2099-01-01'), t)).toContain('starting');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `batchStarted` missing / wrong template chosen.

- [ ] **Step 3: Implement schema defaults**

`src/lib/content-schema.ts`:

a) In `WhatsappTemplatesSchema`, after the `batch:` entry add:

```ts
    /** The per-batch prefill once the batch has already started (grace
     *  window). "starting {date}" in a sent message about a July batch in
     *  August embarrasses the sender; this asks the honest question. */
    batchStarted: z
      .string()
      .default(
        "Hi Furor, I'd like to join the {style} {level} batch at {branch} ({days}, {time} — it started {date}). Can I still join?",
      ),
```

b) In `HomePageSchema` → `board`, after the `startsTemplate` line add:

```ts
        startedTemplate: z.string().default('Started {date} · you can still join'),
```

c) In `BatchesPageSchema` → `browser`, after the `startsPrefix` line add:

```ts
        /** Replaces "{startsPrefix} {date}" once the batch has started. */
        startedLine: z.string().default('started {date} — you can still join'),
```

d) In `HomePageSchema` → `styleFinder`, after its `startsTemplate` line add:

```ts
        startedTemplate: z.string().default('Started {date} · {price}'),
```

- [ ] **Step 4: Implement the enquiry branch**

`src/lib/enquiry.ts` — change the format import to `import { formatBatchDate, todayIso } from './format';` and replace the per-batch branch of `buildPrefilledMessage`:

```ts
  // Per-batch: most specific
  if (ctx.batch && ctx.style && ctx.branch) {
    const template = ctx.batch.startDate < todayIso() ? t.batchStarted : t.batch;
    return fill(template, {
      style: ctx.style.name,
      level: ctx.batch.level,
      branch: ctx.branch.name,
      days: ctx.batch.daysOfWeek.join('–'),
      time: ctx.batch.time,
      date: formatBatchDate(ctx.batch.startDate),
    });
  }
```

- [ ] **Step 5: Implement the three render sites**

a) `src/components/QuickEnroll.tsx`: add `import { todayIso } from '@/lib/format';` and inside `QuickEnroll` (before `return`) add `const today = todayIso();`. Replace:

```tsx
                        <p className="text-cream/60">{board.startsTemplate.replace('{date}', formatBatchDate(b.startDate))}</p>
```

with:

```tsx
                        <p className="text-cream/60">
                          {(b.startDate < today ? board.startedTemplate : board.startsTemplate).replace(
                            '{date}',
                            formatBatchDate(b.startDate),
                          )}
                        </p>
```

b) `src/components/BatchesBrowser.tsx`: add `todayIso` to the `@/lib/format` import; inside the component add `const today = todayIso();` next to `const [now] = useState(...)`. Replace:

```tsx
                    <p className="text-cream/60 text-sm">{copy.startsPrefix} {formatBatchDate(b.startDate)}</p>
```

with:

```tsx
                    <p className="text-cream/60 text-sm">
                      {b.startDate < today
                        ? copy.startedLine.replace('{date}', formatBatchDate(b.startDate))
                        : `${copy.startsPrefix} ${formatBatchDate(b.startDate)}`}
                    </p>
```

c) `src/components/StyleFinder.tsx`: add `import { todayIso } from '@/lib/format';`, add `const today = todayIso();` inside the component. Replace:

```tsx
                <p className="text-cream/70 text-sm">
                  {f.startsTemplate
                    .replace('{date}', formatBatchDate(recommendedBatch.startDate))
                    .replace('{price}', formatInr(recommendedBatch.priceInr))}
                </p>
```

with:

```tsx
                <p className="text-cream/70 text-sm">
                  {(recommendedBatch.startDate < today ? f.startedTemplate : f.startsTemplate)
                    .replace('{date}', formatBatchDate(recommendedBatch.startDate))
                    .replace('{price}', formatInr(recommendedBatch.priceInr))}
                </p>
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm test` — Expected: PASS.

```bash
git add src/lib/content-schema.ts src/lib/enquiry.ts src/lib/enquiry.test.ts src/components/QuickEnroll.tsx src/components/BatchesBrowser.tsx src/components/StyleFinder.tsx
git commit -m "feat: started batches say so honestly on every surface, including the WhatsApp prefill"
```

---

### Task 4: Funnel-health warnings on /admin/batches

**Files:**
- Create: `src/lib/batch-health.ts`
- Test: `src/lib/batch-health.test.ts`
- Modify: `src/app/admin/batches/BatchesEditor.tsx`

**Interfaces:**
- Consumes: `isJoinable` (content-helpers.ts), `SiteContent` type.
- Produces: `isTrustedPaymentHost(url: string): boolean`; `batchHealth(content: SiteContent, today: string): { stylesWithoutFoundation: string[]; suspiciousLinks: { batchId: string; host: string }[]; lapsedBatchIds: string[] }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/batch-health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { batchHealth, isTrustedPaymentHost } from './batch-health';
import type { SiteContent } from './content-schema';

const batch = (over: Partial<SiteContent['batches'][number]> & { id: string }) =>
  ({
    styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
    daysOfWeek: ['Sat'], time: '9:30–10:30 AM', startDate: '2099-01-01',
    priceInr: 6900, trialInr: 500, seatsLeft: null, status: 'Open',
    razorpayLink: null, welcomeNote: '', joinUntil: '',
    ...over,
  }) as SiteContent['batches'][number];

const content = (batches: SiteContent['batches']) =>
  ({
    batches,
    danceStyles: [
      { slug: 'salsa', name: 'Salsa' },
      { slug: 'bachata', name: 'Bachata' },
    ],
  }) as SiteContent;

describe('isTrustedPaymentHost', () => {
  it('accepts razorpay.com, its subdomains, and rzp.io', () => {
    expect(isTrustedPaymentHost('https://pages.razorpay.com/x')).toBe(true);
    expect(isTrustedPaymentHost('https://razorpay.com/x')).toBe(true);
    expect(isTrustedPaymentHost('https://rzp.io/rzp/x')).toBe(true);
  });
  it('rejects everything else, including unparseable values', () => {
    expect(isTrustedPaymentHost('https://forms.gle/abc')).toBe(false);
    expect(isTrustedPaymentHost('https://evilrazorpay.com/x')).toBe(false);
    expect(isTrustedPaymentHost('not a url')).toBe(false);
  });
});

describe('batchHealth', () => {
  it('names styles with zero joinable Foundation batches', () => {
    const h = batchHealth(content([batch({ id: 'a', styleSlugs: ['salsa'] })]), '2026-08-24');
    expect(h.stylesWithoutFoundation).toEqual(['Bachata']);
  });
  it('flags non-Razorpay booking links with their host', () => {
    const h = batchHealth(
      content([batch({ id: 'a', razorpayLink: 'https://forms.gle/abc' })]),
      '2026-08-24',
    );
    expect(h.suspiciousLinks).toEqual([{ batchId: 'a', host: 'forms.gle' }]);
  });
  it('lists lapsed batches but not deliberately Closed ones', () => {
    const h = batchHealth(
      content([
        batch({ id: 'lapsed', startDate: '2026-06-01' }),
        batch({ id: 'closed', startDate: '2026-06-01', status: 'Closed' }),
      ]),
      '2026-08-24',
    );
    expect(h.lapsedBatchIds).toEqual(['lapsed']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/batch-health.ts`**

```ts
import type { SiteContent } from './content-schema';
import { isJoinable } from './content-helpers';

// The admin's funnel-health report. Every P0 in the 2026-08-24 critique was
// an ops failure the code allowed silently — lapsed dates, a Google Form in a
// payment field, zero bookable inventory. These are warnings, never blocks:
// the save path stays owner-controlled.

export interface BatchHealth {
  /** Style names with zero joinable Foundation batches. */
  stylesWithoutFoundation: string[];
  /** Batches whose booking link is not a Razorpay address. */
  suspiciousLinks: { batchId: string; host: string }[];
  /** Batches hidden from the public site because their joinable window has
   *  passed (Closed batches are deliberate and excluded). */
  lapsedBatchIds: string[];
}

const TRUSTED_PAYMENT_HOST = /(^|\.)razorpay\.com$|(^|\.)rzp\.io$/i;

export function isTrustedPaymentHost(url: string): boolean {
  try {
    return TRUSTED_PAYMENT_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function batchHealth(content: SiteContent, today: string): BatchHealth {
  const joinable = content.batches.filter((b) => isJoinable(b, today));
  const stylesWithoutFoundation = content.danceStyles
    .filter((s) => !joinable.some((b) => b.level === 'Foundation' && b.styleSlugs.includes(s.slug)))
    .map((s) => s.name);
  const suspiciousLinks = content.batches.flatMap((b) => {
    if (!b.razorpayLink || isTrustedPaymentHost(b.razorpayLink)) return [];
    let host = b.razorpayLink;
    try {
      host = new URL(b.razorpayLink).hostname;
    } catch {
      // keep the raw value — an unparseable link is exactly what to show
    }
    return [{ batchId: b.id, host }];
  });
  const lapsedBatchIds = content.batches
    .filter((b) => b.status !== 'Closed' && !isJoinable(b, today))
    .map((b) => b.id);
  return { stylesWithoutFoundation, suspiciousLinks, lapsedBatchIds };
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Render the banner in the editor**

`src/app/admin/batches/BatchesEditor.tsx`: add `import { batchHealth } from '@/lib/batch-health';`. Directly before the `<div className="mt-6 flex items-center gap-3">` (the "+ Add batch" row), insert:

```tsx
      {(() => {
        const health = batchHealth(c, todayIso());
        if (!health.stylesWithoutFoundation.length && !health.suspiciousLinks.length) return null;
        return (
          <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 grid gap-2">
            {health.stylesWithoutFoundation.length ? (
              <p className="text-sm text-amber-300">
                <strong>
                  No bookable Foundation batch for {health.stylesWithoutFoundation.join(', ')}.
                </strong>{' '}
                Beginners for {health.stylesWithoutFoundation.length === 1 ? 'this style' : 'these styles'}{' '}
                currently have nothing to book on the public site.
              </p>
            ) : null}
            {health.suspiciousLinks.map((s) => (
              <p key={s.batchId} className="text-sm text-amber-300">
                A booking link below points at <code className="text-amber-200">{s.host}</code> — not a
                Razorpay address. That button collects no payment and reports a false conversion. Paste
                the batch&apos;s Razorpay Payment Page URL, or clear the field so WhatsApp becomes the
                booking path.
              </p>
            ))}
          </div>
        );
      })()}
```

(The banner recomputes from live editor state `c`, so it clears the moment the owner fixes the data — before saving.)

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm test` — PASS.

```bash
git add src/lib/batch-health.ts src/lib/batch-health.test.ts src/app/admin/batches/BatchesEditor.tsx
git commit -m "feat: /admin/batches warns on zero Foundation inventory and non-Razorpay booking links"
```

---

### Task 5: Hero badge + reassurance become content; label-template migrations

**Files:**
- Modify: `src/lib/content-schema.ts` (HeroSchema), `src/lib/label-defaults.ts`, (LabelsSchema in content-schema.ts)
- Modify: `src/components/Hero.tsx`, `src/components/QuickEnroll.tsx`, `src/app/page.tsx`, `src/app/admin/hero/HeroEditor.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: `hero.badge` (default `"India's largest Latin dance school"`), `hero.reassurance` (default `'One real class. No partner needed. You decide.'`); label keys `ctaBookOnWhatsapp` (default `'{book} on WhatsApp'`) and `emptyNoFoundationForStyle` (default `'Danced before? No Foundation batch open for {style} right now.'`). CSS class `.hero-badge` (theme-correct badge color).
- Blank `hero.badge` / `hero.reassurance` hides the element (owner opt-out), unlike labels where blank restores default — the hint text says so.

- [ ] **Step 1: Schema + label defaults**

`src/lib/content-schema.ts` — in `HeroSchema` after `subHeadline` add:

```ts
  // The trust badge over the headline and the reassurance line under the
  // CTAs — shipped literals promoted to editable fields ("only the truth,
  // and all of it is editable"). Blank hides the element.
  badge: z.string().default("India's largest Latin dance school"),
  reassurance: z.string().default('One real class. No partner needed. You decide.'),
```

`src/lib/label-defaults.ts` — in the "Calls to action" group after `ctaWhatsapp` add:

```ts
  // {book} is filled with the batch's own booking verb (bookLabel), so the
  // WhatsApp fallback can never disagree with the paid button beside it.
  ctaBookOnWhatsapp: '{book} on WhatsApp',
```

and in the "Empty states" group after `emptyNoFinderBatch` add:

```ts
  emptyNoFoundationForStyle: 'Danced before? No Foundation batch open for {style} right now.',
```

`LabelsSchema` (content-schema.ts) — mirror both keys in their matching groups:

```ts
    ctaBookOnWhatsapp: z.string().default(L.ctaBookOnWhatsapp),
```

```ts
    emptyNoFoundationForStyle: z.string().default(L.emptyNoFoundationForStyle),
```

- [ ] **Step 2: Render sites**

a) `src/components/Hero.tsx` — replace:

```tsx
        <p className="pill bg-ember-500/15 text-ember-400 hero-fade" style={{ animationDelay: '60ms' }}>
          India&apos;s largest Latin dance school
        </p>
```

with:

```tsx
        {content.hero.badge ? (
          <p className="pill hero-badge bg-ember-500/15 hero-fade" style={{ animationDelay: '60ms' }}>
            {content.hero.badge}
          </p>
        ) : null}
```

and replace:

```tsx
          <p className="mt-2.5 text-sm text-cream/65">
            One real class. No partner needed. You decide.
          </p>
```

with:

```tsx
          {content.hero.reassurance ? (
            <p className="mt-2.5 text-sm text-cream/65">{content.hero.reassurance}</p>
          ) : null}
```

b) `src/app/globals.css` — append after the `.spot-beam` rules at end of file:

```css
/* The hero trust badge. ember-400 on light-theme paper measured under AA at
   12px, so light uses the deep link-red; dark keeps the bright accent. */
.hero-badge {
  color: rgb(var(--c-ember-300));
}
html[data-theme='dark'] .hero-badge {
  color: rgb(var(--c-ember-400));
}
```

c) `src/components/QuickEnroll.tsx` — the empty-slot WhatsApp CTA. Replace:

```tsx
                            label={`${book} on WhatsApp`}
```

with:

```tsx
                            label={label(content.labels, 'ctaBookOnWhatsapp').replace('{book}', book)}
```

d) `src/app/page.tsx` — in the Next-batches strip's fallback card, replace:

```tsx
                      <p className="mt-1 text-sm text-gold-400">
                        Danced before? No Foundation batch open for {s.name} right now.
                      </p>
```

with:

```tsx
                      <p className="mt-1 text-sm text-gold-400">
                        {label(content.labels, 'emptyNoFoundationForStyle').replace('{style}', s.name)}
                      </p>
```

(This block is deleted again in Task 11 — the key's durable render site is the wired usage that Task 11 moves it to; see Task 11 Step 2c.)

e) `src/app/admin/hero/HeroEditor.tsx` — after the Sub-headline `<Field>` add:

```tsx
        <Field label="Trust badge" hint="The small pill above the headline. Leave blank to hide it.">
          <input
            value={c.hero.badge}
            onChange={(e) => patch({ badge: e.target.value })}
            className="input"
          />
        </Field>
        <Field
          label="Reassurance line"
          hint="The quiet line under the booking buttons. Leave blank to hide it."
        >
          <input
            value={c.hero.reassurance}
            onChange={(e) => patch({ reassurance: e.target.value })}
            className="input"
          />
        </Field>
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npm test` (labels-wired now sees both new keys rendered) — PASS.

```bash
git add src/lib/content-schema.ts src/lib/label-defaults.ts src/components/Hero.tsx src/components/QuickEnroll.tsx src/app/page.tsx src/app/admin/hero/HeroEditor.tsx src/app/globals.css
git commit -m "feat: hero badge and reassurance line move into the content document; stray literals become labels"
```

---

### Task 6: Seats-zero honesty on every booking surface

**Files:**
- Modify: `src/lib/label-defaults.ts`, `src/lib/content-schema.ts` (LabelsSchema)
- Modify: `src/components/BatchActions.tsx`, `src/components/QuickEnroll.tsx`

**Interfaces:**
- Produces: label key `ctaSeatsFullWhatsapp` (default `'Full — WhatsApp for the next batch'`). Rule: `seatsLeft === 0` suppresses the payment button; WhatsApp CTA takes over with this label. (`null`/absent seatsLeft keeps current behavior.)

- [ ] **Step 1: Add the label key**

`label-defaults.ts` (Calls to action group):

```ts
  // Shown instead of a payment button when a batch's seatsLeft is exactly 0 —
  // a live buy button on a full room is a trust failure.
  ctaSeatsFullWhatsapp: 'Full — WhatsApp for the next batch',
```

`LabelsSchema`:

```ts
    ctaSeatsFullWhatsapp: z.string().default(L.ctaSeatsFullWhatsapp),
```

- [ ] **Step 2: BatchActions**

In `src/components/BatchActions.tsx`, after `const chatLabel = …` add:

```ts
  // seatsLeft === 0 is a full room: the paid button disappears and WhatsApp
  // takes over — the studio can still offer the next batch in conversation.
  const seatsFull = batch.seatsLeft === 0;
```

change `if (batch.razorpayLink) {` to `if (batch.razorpayLink && !seatsFull) {`, and in the final fallback `<EnquiryCTA>` change `label={noLinkLabel}` to:

```tsx
      label={seatsFull ? label(labels, 'ctaSeatsFullWhatsapp') : noLinkLabel}
```

- [ ] **Step 3: QuickEnroll board card**

In `src/components/QuickEnroll.tsx` change the booking cell condition `{b.razorpayLink ? (` to `{b.razorpayLink && b.seatsLeft !== 0 ? (` and in the else-branch `<EnquiryCTA>` replace the Task 5 label line with:

```tsx
                            label={
                              b.seatsLeft === 0
                                ? label(content.labels, 'ctaSeatsFullWhatsapp')
                                : label(content.labels, 'ctaBookOnWhatsapp').replace('{book}', book)
                            }
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm test` — PASS.

```bash
git add src/lib/label-defaults.ts src/lib/content-schema.ts src/components/BatchActions.tsx src/components/QuickEnroll.tsx
git commit -m "fix: a full batch stops selling seats — WhatsApp takes over at seatsLeft 0"
```

---

### Task 7: Hero entrance compression + fold recovery

**Files:**
- Modify: `src/components/Hero.tsx`

**Interfaces:** none new. CSS classes only; `.count-in`'s box styles in globals.css stay untouched (Tailwind `absolute`/`static` override position per breakpoint).

- [ ] **Step 1: Compress the stagger and free the fold**

In `src/components/Hero.tsx`:

a) Count-in — replace:

```tsx
        <p
          aria-hidden
          className="count-in display text-sm font-bold uppercase tracking-[0.4em] text-ember-400 mb-3"
        >
```

with:

```tsx
        {/* On phones the count-in floats top-right of the content column so it
            plays without permanently reserving ~32px of fold height; sm+ keeps
            it in flow above the badge. */}
        <p
          aria-hidden
          className="count-in absolute right-5 top-5 sm:static display text-sm font-bold uppercase tracking-[0.4em] text-ember-400 mb-0 sm:mb-3"
        >
```

b) Badge pill delay — in the Task 5 badge block, change `style={{ animationDelay: '60ms' }}` to no style attribute at all (delay 0).

c) Sub-headline — change `style={{ animationDelay: '0.95s' }}` to `style={{ animationDelay: '0.3s' }}`.

d) CTA block — change `<div className="mt-6 hero-fade" style={{ animationDelay: '1.15s' }}>` to `style={{ animationDelay: '0.45s' }}` (comment above it stays valid — the downbeat still fires later and only accents).

e) Container padding — change:

```tsx
      <div className="container-x relative z-10 pt-8 pb-28 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
```

to:

```tsx
      <div className="container-x relative z-10 pt-5 pb-28 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
```

- [ ] **Step 2: Verify**

`npm run typecheck && npm test` — PASS. Manual (deferred to Task 18's checklist): at 375×667 and ~584px-tall viewports the board's lit edge peeks; CTA visible well under 1s.

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.tsx
git commit -m "fix: the hero shows its ask in under half a second and stops spending fold height on the count-in"
```

---

### Task 8: TonightFloat becomes desktop-only with a real dismiss target

**Files:**
- Modify: `src/components/TonightFloat.tsx`

- [ ] **Step 1: Contain the chip**

a) Replace the root positioning line:

```tsx
    <div className="tonight-float absolute right-3 top-3 z-20 w-[14rem] sm:right-6 sm:top-6 sm:w-[17rem]">
```

with:

```tsx
    // Desktop-only: below lg the chip landed on top of the hero badge and
    // headline on every phone — the primary audience. Mobile gets La Rumba
    // as the in-flow RumbaBand section instead (two front doors, spec §3.1).
    <div className="tonight-float hidden lg:block absolute right-6 top-6 z-20 w-[17rem]">
```

b) Enlarge the dismiss target — replace the close button's className:

```tsx
          className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-cream/50 transition hover:bg-cream/10 hover:text-cream"
```

with:

```tsx
          className="absolute right-0.5 top-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-cream/50 transition hover:bg-cream/10 hover:text-cream"
```

c) In the component's top comment block (lines 7–19), append one line: `// Desktop-only since 2026-08-24; phones meet La Rumba in the home RumbaBand.`

- [ ] **Step 2: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/components/TonightFloat.tsx
git commit -m "fix: the La Rumba chip stops covering the hero on phones and gets a 44px dismiss target"
```

---

### Task 9: FloatingTalkToUs — one pulse per viewport, hint becomes a label

**Files:**
- Modify: `src/components/FloatingTalkToUs.tsx`, `src/lib/label-defaults.ts`, `src/lib/content-schema.ts` (LabelsSchema)

**Interfaces:**
- Produces: label key `talkToUsHint` (default `'We answer in minutes during studio hours.'`).

- [ ] **Step 1: Label key**

`label-defaults.ts` — after `ctaTalkToUs`:

```ts
  talkToUsHint: 'We answer in minutes during studio hours.',
```

`LabelsSchema` — after `ctaTalkToUs`:

```ts
    talkToUsHint: z.string().default(L.talkToUsHint),
```

- [ ] **Step 2: Component edits**

a) Replace the hardcoded hint:

```tsx
            <p className="mt-1 text-cream/90 text-sm">
              We answer in minutes during studio hours.
            </p>
```

with:

```tsx
            <p className="mt-1 text-cream/90 text-sm">{label(labels, 'talkToUsHint')}</p>
```

b) Quiet the pill — replace:

```tsx
          <span className="relative flex h-2 w-2">
            <span className="beat-ring absolute inset-0 rounded-full bg-on-ember/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-on-ember" />
          </span>
```

with:

```tsx
          {/* Static dot — the board's "Booking open" badge keeps the only
              pulse in the arrival viewport (one live idiom per screen). */}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-on-ember" />
```

- [ ] **Step 3: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/components/FloatingTalkToUs.tsx src/lib/label-defaults.ts src/lib/content-schema.ts
git commit -m "fix: talk-to-us pill stops pulsing and its hint line becomes editable"
```

---

### Task 10: Theme + reduced-motion hygiene

**Files:**
- Modify: `src/app/globals.css`, `src/components/Hero.tsx`

- [ ] **Step 1: Dark-theme accent brightness**

`globals.css` — inside `@layer components`, directly after the `.on-accent .accent { … }` rule, add:

```css
  /* Dark theme: ember-600 rendered the accented word dimmer than the cream
     headline around it — the emphasised word was the weakest word in the
     line. Use the bright accent red. (.on-accent still wins inside the deep
     ember CTA panels — higher specificity.) */
  html[data-theme='dark'] .accent {
    color: rgb(var(--c-ember-400));
  }
```

- [ ] **Step 2: Reduced-motion guards for the JS effects**

`src/components/Hero.tsx` — in `HeroSpotlight`'s effect, after `if (!window.matchMedia('(pointer: fine)').matches) return;` add:

```ts
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

In `MagneticInit`'s effect, after its `pointer: fine` check add the same line:

```ts
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

- [ ] **Step 3: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/app/globals.css src/components/Hero.tsx
git commit -m "fix: accent word stays bright on dark theme; magnetic and spotlight respect reduced motion"
```

---

### Task 11: The La Rumba proof band replaces the Next-batches strip

**Files:**
- Modify: `src/lib/content-schema.ts` (HomePageSchema: new `rumba` object; retire comments), `src/lib/enquiry.ts` (source union)
- Create: `src/components/RumbaBand.tsx`
- Modify: `src/app/page.tsx`, `src/app/admin/pages/home/HomePageEditor.tsx`, `src/lib/label-defaults.ts` + LabelsSchema (delete 3 orphaned keys), `src/lib/labels.test.ts` only if it pins the deleted keys (check before editing)
- Test: `src/lib/content-schema.test.ts`

**Interfaces:**
- Consumes: `tonight` facts (headline/when/venueName), `testimonials`, `site.stats.studentsThisWeek`, `trialFrom` (already computed in page.tsx), `Img`, `Reveal`, `RhythmSignature`, `EnquiryCTA`.
- Produces: `pages.home.rumba` schema object (fields below); `RumbaBand({ content, trialFrom }: { content: SiteContent; trialFrom: number | null })` server component; `'rumba_band'` added to `EnquirySource`.
- Deletes label keys `ctaSeeAllBatches`, `ctaNotifyWhatsapp`, `emptyNextBatchSoon` (their only render sites die with the strip) — remove from BOTH `label-defaults.ts` and `LabelsSchema`. `emptyNoFoundationForStyle` (Task 5) also loses its site: move it to `KNOWN_UNWIRED`? No — DELETE it too from both files (the strip was its only site, and Task 5's edit is superseded; deleting keeps /admin/labels honest).

- [ ] **Step 1: Write the failing schema test**

Append to `src/lib/content-schema.test.ts` (import `SiteContentObjectSchema` if not present):

```ts
describe('pages.home.rumba defaults', () => {
  it('ships the La Rumba band copy and three real photos', () => {
    const home = SiteContentObjectSchema.shape.pages.parse(undefined).home;
    expect(home.rumba.headline).toBe('Class teaches you. Saturday makes it yours.');
    expect(home.rumba.photos).toHaveLength(3);
    expect(home.rumba.testimonialId).toBe('test-004');
    expect(home.rumba.statTemplate).toContain('{n}');
  });
});
```

Run: `npm test` → FAIL.

- [ ] **Step 2: Schema**

In `HomePageSchema`, after the `nextBatches` object, add:

```ts
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
```

On the `nextBatches` object add a comment line above it: `// Retired render site 2026-08-24 (strip replaced by the rumba band). Fields kept so stored documents parse; not editable in admin.`

In `src/lib/enquiry.ts` add `| 'rumba_band'` to the `EnquirySource` union (after `'sticky_bar'`).

Delete these four entries from `label-defaults.ts` AND their `LabelsSchema` lines: `ctaSeeAllBatches`, `ctaNotifyWhatsapp`, `emptyNextBatchSoon`, `emptyNoFoundationForStyle`. (If `src/lib/labels.test.ts` references any of them, update those assertions to use surviving keys.)

- [ ] **Step 3: Create `src/components/RumbaBand.tsx`**

```tsx
import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { formatInr } from '@/lib/format';
import { Img } from './Img';
import { Reveal } from './Reveal';
import { RhythmSignature } from './RhythmSignature';
import { EnquiryCTA } from './EnquiryCTA';

// The social rendered as evidence: real photos, a real student's words, the
// live weekly count — and the zero-fear door ("come watch on Saturday")
// beside the quiet paid one. Server-rendered; the only client child is the
// EnquiryCTA already bundled on every route. Renders nothing when the social
// is disabled in the admin — same gate as the TonightFloat chip.
export function RumbaBand({
  content,
  trialFrom,
}: {
  content: SiteContent;
  trialFrom: number | null;
}) {
  const t = content.tonight;
  if (!t.enabled || !t.headline || !t.when) return null;
  const r = content.pages.home.rumba;
  const proof =
    content.testimonials.find((x) => x.id === r.testimonialId) ?? content.testimonials[0] ?? null;
  const students = content.site.stats.studentsThisWeek;

  return (
    <section className="container-x py-12 sm:py-16">
      <Reveal>
        <div className="flex items-center gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">{r.eyebrow}</p>
          <RhythmSignature style="bachata" loop width={84} className="text-ember-500/70" />
        </div>
        <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">{r.headline}</h2>
        <p className="mt-3 max-w-2xl text-cream/70">{r.body}</p>
        <p className="mt-2 text-sm font-semibold text-ember-400">
          {t.headline} · {t.when}
          {t.venueName ? ` · ${t.venueName}` : ''}
        </p>
      </Reveal>
      {r.photos.length > 0 ? (
        <Reveal stagger className="mt-8 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
          {r.photos.slice(0, 3).map((p, i) => (
            <div
              key={`${p.src}-${i}`}
              className={`relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${
                i === 0 ? 'col-span-2 md:col-span-1' : ''
              }`}
            >
              <Img
                src={p.src}
                alt={p.alt}
                seed={`rumba-${i}`}
                fill
                className="object-cover transition duration-700 hover:scale-[1.04]"
              />
            </div>
          ))}
        </Reveal>
      ) : null}
      {proof || (typeof students === 'number' && students > 0 && r.statTemplate) ? (
        <Reveal className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          {proof ? (
            <figure className="max-w-xl">
              <blockquote className="italic text-cream/85">&ldquo;{proof.text}&rdquo;</blockquote>
              <figcaption className="mt-1 text-xs text-cream/55">— {proof.studentName}</figcaption>
            </figure>
          ) : null}
          {typeof students === 'number' && students > 0 && r.statTemplate ? (
            <p className="display text-sm font-semibold uppercase tracking-widest text-gold-400">
              {r.statTemplate.replace('{n}', String(students))}
            </p>
          ) : null}
        </Reveal>
      ) : null}
      <Reveal className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <EnquiryCTA
          whatsappNumber={content.site.whatsappNumber}
          ctx={{ source: 'rumba_band', customNote: t.ctaContext }}
          variant="primary"
          labels={content.labels}
          templates={content.site.whatsappTemplates}
          label={r.rsvpLabel}
        />
        <Link
          href="#start-this-week"
          className="inline-flex min-h-[44px] items-center py-2 text-sm text-cream/75 underline decoration-cream/30 underline-offset-4 transition hover:text-cream"
        >
          {r.classLink}
          {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
        </Link>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 4: Swap it into the home page**

`src/app/page.tsx`:

a) Delete the whole "Next batches strip" section — from the comment `{/* Next batches strip */}` through its closing `</section>` (currently lines ~179–273).
b) In its place insert:

```tsx
      {/* The social is the product: proof band with the zero-fear door. */}
      <RumbaBand content={content} trialFrom={trialFrom} />
```

c) Update imports: add `import { RumbaBand } from '@/components/RumbaBand';`; remove now-unused imports `nextBatchPerStyle`, `formatBatchDate`, `batchStyleLabel` from the `@/lib/content` import (keep `getPublicContent`, `visibleBatches`, `formatInr`); remove `import { BatchActions } from '@/components/BatchActions';`; remove the `const nextPerStyle = nextBatchPerStyle(content);` line and its comment. (`EnquiryCTA` stays — the closing CTA uses it.)
d) Confirm no other reference to the deleted label keys survives in page.tsx (the fallback card from Task 5 Step 2d dies with the strip).

- [ ] **Step 5: Admin editor swap**

`src/app/admin/pages/home/HomePageEditor.tsx`:

a) Remove the entire `<Section title="Next batches strip">…</Section>` block.
b) Remove the Headline `<Field>` from `<Section title="What we teach (dance-styles section header)">` (the field renders nowhere; keep the Eyebrow field) and retitle that section `"What we teach (style pill row)"`.
c) Where the strip section was, add a rumba section. First add the patch helper next to `patchFinder`:

```tsx
  function patchRumba(patch: Partial<HomePage['rumba']>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: { ...prev.pages.home, rumba: { ...prev.pages.home.rumba, ...patch } },
      },
    }));
    setDirty(true);
  }
```

Then the section (import `ImageUploader` from `@/components/admin/ImageUploader` at top):

```tsx
        <Section title="La Rumba band (replaces the old batches strip)">
          <p className="-mt-1 text-xs text-cream/50">
            The social as proof: photos, a student&apos;s words, the weekly count. Day, time and
            venue come from the Tonight settings — edit those under Site.
          </p>
          <Field label="Eyebrow">
            <input value={h.rumba.eyebrow} onChange={(e) => patchRumba({ eyebrow: e.target.value })} className="input" />
          </Field>
          <Field label="Headline">
            <input value={h.rumba.headline} onChange={(e) => patchRumba({ headline: e.target.value })} className="input" />
          </Field>
          <Field label="Body">
            <textarea rows={3} value={h.rumba.body} onChange={(e) => patchRumba({ body: e.target.value })} className="input" />
          </Field>
          {h.rumba.photos.map((p, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-cream/50">Photo {i + 1}</p>
                <button
                  type="button"
                  onClick={() => patchRumba({ photos: h.rumba.photos.filter((_, j) => j !== i) })}
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove
                </button>
              </div>
              <ImageUploader
                label="Image"
                value={p.src}
                onChange={(v) => {
                  const next = h.rumba.photos.slice();
                  next[i] = { ...p, src: v };
                  patchRumba({ photos: next });
                }}
                aspect="wide"
              />
              <Field label="Description" hint="Alt text — describe what's happening.">
                <input
                  value={p.alt}
                  onChange={(e) => {
                    const next = h.rumba.photos.slice();
                    next[i] = { ...p, alt: e.target.value };
                    patchRumba({ photos: next });
                  }}
                  className="input"
                />
              </Field>
            </div>
          ))}
          {h.rumba.photos.length < 3 ? (
            <div>
              <button
                type="button"
                onClick={() => patchRumba({ photos: [...h.rumba.photos, { src: '', alt: '' }] })}
                className="text-sm text-ember-400 hover:text-ember-300"
              >
                + Add photo
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Weekly stat line" hint="Use {n} — the students-this-week count from Site settings. Blank hides it.">
              <input value={h.rumba.statTemplate} onChange={(e) => patchRumba({ statTemplate: e.target.value })} className="input" />
            </Field>
            <Field label="RSVP button">
              <input value={h.rumba.rsvpLabel} onChange={(e) => patchRumba({ rsvpLabel: e.target.value })} className="input" />
            </Field>
            <Field label="First-class link" hint="The current first-class price is appended automatically.">
              <input value={h.rumba.classLink} onChange={(e) => patchRumba({ classLink: e.target.value })} className="input" />
            </Field>
          </div>
        </Section>
```

(If `ImageUploader`'s props differ from `{label, value, onChange, aspect}`, match its actual signature from `src/components/admin/ImageUploader.tsx` — `HeroEditor.tsx` shows a working call.)

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm test` — PASS (labels-wired passes because the three orphaned keys were deleted; the rumba schema test passes).

```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts src/lib/enquiry.ts src/lib/label-defaults.ts src/lib/labels.test.ts src/components/RumbaBand.tsx src/app/page.tsx src/app/admin/pages/home/HomePageEditor.tsx
git commit -m "feat: the La Rumba proof band replaces the duplicate batches strip on home"
```

---

### Task 12: The welcome page invites you to La Rumba

**Files:**
- Modify: `src/lib/content-schema.ts` (WelcomeSchema), `src/app/welcome/[track]/WelcomeView.tsx`, `src/app/welcome/[track]/page.tsx`
- Test: `src/lib/content-schema.test.ts`

**Interfaces:**
- Produces: `welcome.rumbaHeading` (default `'Your first La Rumba'`), `welcome.rumbaBody` (default below, placeholders `{when}` `{venue}`); `WelcomeView` gains prop `tonight: { headline: string; when: string; venueName: string } | null`.

- [ ] **Step 1: Failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('welcome La Rumba invite defaults', () => {
  it('ships heading and body with live-fact placeholders', () => {
    const w = SiteContentObjectSchema.shape.welcome.parse(undefined);
    expect(w.rumbaHeading).toBe('Your first La Rumba');
    expect(w.rumbaBody).toContain('{when}');
    expect(w.rumbaBody).toContain('{venue}');
  });
});
```

Run `npm test` → FAIL.

- [ ] **Step 2: Schema**

In `WelcomeSchema`, after `signoffTagline`, add:

```ts
    // The social offered at the moment of maximum enthusiasm — the product
    // principle "the social is the product" finally reaches the funnel's
    // peak-end. {when} and {venue} fill from `tonight` at render time; the
    // block is skipped entirely when the social is unconfigured.
    rumbaHeading: z.string().default('Your first La Rumba'),
    rumbaBody: z
      .string()
      .default(
        'Class is one half — the social is the other. La Rumba runs {when} at {venue}, entry at the venue. Come watch this Saturday; by the end of your batch you’ll be dancing it.',
      ),
```

Run `npm test` → PASS.

- [ ] **Step 3: Render**

`WelcomeView.tsx`: add to `Props`:

```ts
  /** The weekly social's live facts, or null when unconfigured — the invite
   *  block renders only with real day/venue words to fill its template. */
  tonight: { headline: string; when: string; venueName: string } | null;
```

add `tonight,` to the destructured parameters, and insert between the intake-details `</section>` and the `{/* Sign-off */}` section:

```tsx
      {/* Your first La Rumba — the social at the peak-end */}
      {tonight ? (
        <section className="container-x pb-10">
          <Reveal className="rounded-3xl border border-ember-500/30 bg-ember-500/5 p-8 sm:p-10">
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {tonight.headline}
            </p>
            <p className="mt-2 display text-2xl font-bold">{copy.rumbaHeading}</p>
            <p className="mt-3 max-w-2xl text-cream/80">
              <Filled
                template={copy.rumbaBody}
                vars={{ when: tonight.when, venue: tonight.venueName }}
              />
            </p>
          </Reveal>
        </section>
      ) : null}
```

`page.tsx` (welcome) — in the `<WelcomeView …>` call add:

```tsx
      tonight={
        content.tonight.enabled &&
        content.tonight.headline &&
        content.tonight.when &&
        content.tonight.venueName
          ? {
              headline: content.tonight.headline,
              when: content.tonight.when,
              venueName: content.tonight.venueName,
            }
          : null
      }
```

- [ ] **Step 4: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts "src/app/welcome/[track]/WelcomeView.tsx" "src/app/welcome/[track]/page.tsx"
git commit -m "feat: the confirmed welcome page invites the new student to their first La Rumba"
```

---

### Task 13: StyleFinder result adopts the board's booking grammar

**Files:**
- Modify: `src/components/StyleFinder.tsx`, `src/components/BookTrialLink.tsx` (source union), `src/lib/content-schema.ts` (styleFinder template default + RETIRED_COPY)

**Interfaces:**
- Consumes: `BookTrialLink`, `bookLabel`, `bookPriceInr` (book-label.ts), `ctaChatFirst` + `ctaSeatsFullWhatsapp` labels.
- Produces: `'style_finder'` added to `BookTrialLink`'s `source` union; new `whatsappTemplates.styleFinder` default + `RETIRED_COPY` entry.

- [ ] **Step 1: Template default + retired copy**

`content-schema.ts` — change the `styleFinder` template default from:

```ts
        'Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.',
```

to:

```ts
        'Hi Furor! {style} {level}{where} looks right for me. When does the next batch start?',
```

and add to `RETIRED_COPY`:

```ts
  // site.whatsappTemplates.styleFinder — read like a machine wrote it, which
  // suppresses sends; the visitor has to be happy putting these words in
  // their own mouth.
  ["Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.", "Hi Furor! {style} {level}{where} looks right for me. When does the next batch start?"],
```

- [ ] **Step 2: BookTrialLink source**

In `src/components/BookTrialLink.tsx` change:

```ts
  source: 'quick_enroll' | 'batch_row' | 'style_page' | 'hero';
```

to:

```ts
  source: 'quick_enroll' | 'batch_row' | 'style_page' | 'hero' | 'style_finder';
```

- [ ] **Step 3: Rebuild the result panel's CTA row**

`src/components/StyleFinder.tsx` — extend imports:

```ts
import { BookTrialLink } from './BookTrialLink';
import { bookLabel, bookPriceInr } from '@/lib/book-label';
```

Replace the entire `<div className="mt-5 flex flex-wrap gap-3">…</div>` block (the two EnquiryCTAs, currently lines ~133–168) with:

```tsx
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              {recommendedBatch && branch && recommendedBatch.razorpayLink && recommendedBatch.seatsLeft !== 0 ? (
                <>
                  {/* The board's grammar at the finder's moment of maximum
                      intent: pay is primary with the price on the button,
                      WhatsApp demotes to the chat-first link. */}
                  <BookTrialLink
                    href={recommendedBatch.razorpayLink}
                    batch={recommendedBatch}
                    styleSlug={track.ctaSlug}
                    branchSlug={recommendedBatch.branchSlug}
                    source="style_finder"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ember-600 px-5 py-2.5 text-sm font-semibold text-on-ember transition hover:bg-ember-700"
                  >
                    {bookLabel(recommendedBatch, content.labels)} ·{' '}
                    {formatInr(bookPriceInr(recommendedBatch))}
                  </BookTrialLink>
                  <EnquiryCTA
                    whatsappNumber={content.site.whatsappNumber}
                    ctx={{
                      source: 'style_finder',
                      style: { slug: track.ctaSlug, name: track.name },
                      branch: { slug: branch.slug, name: branch.name },
                      batch: recommendedBatch,
                    }}
                    variant="link"
                    labels={content.labels}
                    templates={content.site.whatsappTemplates}
                    label={label(content.labels, 'ctaChatFirst')}
                  />
                </>
              ) : (
                <EnquiryCTA
                  whatsappNumber={content.site.whatsappNumber}
                  ctx={{
                    source: 'style_finder',
                    style: { slug: track.ctaSlug, name: track.name },
                    branch: branch ? { slug: branch.slug, name: branch.name } : undefined,
                    styleFinderRecommendation: {
                      styleName: track.name,
                      level: 'Foundation',
                      branchName: branch?.name,
                    },
                  }}
                  variant="primary"
                  labels={content.labels}
                  templates={content.site.whatsappTemplates}
                  label={
                    recommendedBatch?.seatsLeft === 0
                      ? label(content.labels, 'ctaSeatsFullWhatsapp')
                      : undefined
                  }
                />
              )}
            </div>
```

(The Instagram button leaves the result panel by design — it survives site-wide in FloatingTalkToUs, the closing CTA, and contact.)

- [ ] **Step 4: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/components/StyleFinder.tsx src/components/BookTrialLink.tsx src/lib/content-schema.ts
git commit -m "feat: the style finder's result offers the real booking button, not just WhatsApp"
```

---

### Task 14: /batches rows get the board's labeled price flip

**Files:**
- Modify: `src/lib/content-schema.ts` (BatchesPageSchema browser), `src/components/BatchesBrowser.tsx`

**Interfaces:**
- Produces browser template keys: `trialPriceLine` = `'First class {price}'`, `fullProgramLine` = `'Full program {price} — decide after class one.'`, `fullProgramOnlyLine` = `'Full program {price} — pay in full to register.'`. Consumes `offersTrial` (book-label.ts).

- [ ] **Step 1: Schema**

In `BatchesPageSchema` → `browser`, after the `startedLine` entry (Task 3), add:

```ts
        // The board's labeled price flip, so the comparison page stops
        // framing the ₹6,900 program fee as the cost of showing up.
        trialPriceLine: z.string().default('First class {price}'),
        fullProgramLine: z.string().default('Full program {price} — decide after class one.'),
        fullProgramOnlyLine: z.string().default('Full program {price} — pay in full to register.'),
```

- [ ] **Step 2: Row render**

`src/components/BatchesBrowser.tsx` — add `offersTrial` to the book-label import (`import { offersTrial, statusLabel } from '@/lib/book-label';`). Replace the branch cell:

```tsx
                  <div className="lg:col-span-3">
                    <p className="text-cream">{row.branchName}</p>
                    <p className="text-cream/60 text-sm">{row.neighborhood}</p>
                  </div>
```

with (span 3 → 2):

```tsx
                  <div className="lg:col-span-2">
                    <p className="text-cream">{row.branchName}</p>
                    <p className="text-cream/60 text-sm">{row.neighborhood}</p>
                  </div>
```

and replace the price cell:

```tsx
                  <div className="lg:col-span-1">
                    <p className="text-cream font-semibold">{formatInr(b.priceInr)}</p>
                    {typeof b.seatsLeft === 'number' ? (
                      <p className="text-cream/60 text-xs">{copy.seatsTemplate.replace('{n}', String(b.seatsLeft))}</p>
                    ) : null}
                  </div>
```

with:

```tsx
                  <div className="lg:col-span-2">
                    {offersTrial(b) ? (
                      <>
                        <p className="text-cream font-semibold">
                          {copy.trialPriceLine.replace('{price}', formatInr(b.trialInr as number))}
                        </p>
                        <p className="text-cream/60 text-xs">
                          {copy.fullProgramLine.replace('{price}', formatInr(b.priceInr))}
                        </p>
                      </>
                    ) : (
                      <p className="text-cream font-semibold">
                        {copy.fullProgramOnlyLine.replace('{price}', formatInr(b.priceInr))}
                      </p>
                    )}
                    {typeof b.seatsLeft === 'number' ? (
                      <p className="text-cream/60 text-xs">
                        {copy.seatsTemplate.replace('{n}', String(b.seatsLeft))}
                      </p>
                    ) : null}
                  </div>
```

(Grid audit: 3 + 2 + 3 + 2 + 2 = 12 columns — the style, time, and actions cells keep their spans.)

- [ ] **Step 3: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add src/lib/content-schema.ts src/components/BatchesBrowser.tsx
git commit -m "fix: /batches frames the entry price as the first class, not the program fee"
```

---

### Task 15: Story pages end in a next step

**Files:**
- Modify: `src/app/stories/[slug]/page.tsx`

- [ ] **Step 1: Add the closing CTA**

Extend imports:

```ts
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { label } from '@/lib/labels';
```

Change the related-stories section's className from `"container-x pb-24 max-w-3xl"` to `"container-x pb-12 max-w-3xl"`, then after the `{related.length > 0 ? (…) : null}` block (still inside the fragment, before the closing `</>`), add:

```tsx
    {/* Every story used to dead-end; the next step is now one tap away. */}
    <section className="container-x pb-24 max-w-3xl">
      <div className="hairline pt-6 flex flex-wrap items-center gap-3">
        <EnquiryCTA
          whatsappNumber={content.site.whatsappNumber}
          ctx={{ source: 'primary' }}
          variant="primary"
          labels={content.labels}
          templates={content.site.whatsappTemplates}
        />
        <Link href="/batches" className="btn-secondary">
          {label(content.labels, 'navBatches')}
        </Link>
      </div>
    </section>
```

- [ ] **Step 2: Verify and commit**

`npm run typecheck && npm test` — PASS.

```bash
git add "src/app/stories/[slug]/page.tsx"
git commit -m "fix: story pages close with a WhatsApp CTA and a path to batches"
```

---

### Task 16: Copy coherence — the content document tells one story

**Files:**
- Modify: `data/site-content.json`, `src/lib/content-schema.ts` (2 default changes + RETIRED_COPY), `src/lib/label-defaults.ts` (navBlog), `src/components/TonightFloat.tsx` (fallback literal)
- Regenerate: `src/data/site-content.seed.json` via `npm run sync-seed`

No new-copy string may contain `<`, `>`, `{{`, `}}`, or `undefined`.

- [ ] **Step 1: Default changes + RETIRED_COPY (content-schema.ts)**

a) `TonightSchema.ctaLabel` default `'WhatsApp to RSVP'` → `'Say you’re coming'`. Also update the two `TonightSchema.default({ … ctaLabel: 'WhatsApp to RSVP' … })` literals in `SiteContentObjectSchema` to `'Say you’re coming'`, and in `TonightFloat.tsx` change the fallback `label={t.ctaLabel || 'WhatsApp to RSVP'}` to `label={t.ctaLabel || 'Say you’re coming'}`.
b) `WelcomeSchema.signoffHeadline` default `'See you all in class! 💃🕺'` → `'See you in class! 💃🕺'` (the page addresses one person).
c) Add to `RETIRED_COPY`:

```ts
  // tonight.ctaLabel — "RSVP" contradicted the FAQ's "no pre-booking needed".
  ["WhatsApp to RSVP", "Say you’re coming"],
  // welcome.signoffHeadline — the page addresses one person, not a crowd.
  ["See you all in class! 💃🕺", "See you in class! 💃🕺"],
```

d) `label-defaults.ts`: `navBlog: 'Blog'` → `navBlog: 'Stories'` (deliberately NO retired-copy entry — a bare `"Blog"` whole-string match is too broad; production gets this via the owner checklist).

- [ ] **Step 2: Edit `data/site-content.json`** (exact old → new; all are whole-value replacements at the named JSON path):

1. `tonight.ctaLabel`: `"WhatsApp to RSVP"` → `"Say you’re coming"`.
2. `danceStyles[0].description` (salsa) → `"Salsa is the heartbeat of Latin dance — a partner dance born of Cuban Son, Mambo and Puerto Rican rhythms. We build you up from zero, so leading and following feel natural rather than memorised. As you grow, the deeper styles open up: foundation On1 and New York On2, plus Afro Rumba, Cha-Cha, Boogaloo, Son/Palladium/Classic On2, and Pachanga."`
3. `danceStyles[0].faqs[1].a` (what to wear) → `"Anything you can move in. In the studio we recommend fresh socks for beginners — you turn more easily. For the socials, smooth-soled shoes help but aren't required; avoid sticky rubber soles if you can."`
4. `danceStyles[1].levelOutcomes.foundation` (bachata) → `"Basic step, side basic, simple turns and the body movement that makes Bachata unmistakable. Enough to dance every song at the social."`
5. `pages.faqs.sections[0].items` — INSERT as the new FIRST item:

```json
{
  "q": "Can I try one class before committing?",
  "a": "Yes — that's exactly how most people start. ₹500 books one real class in any Foundation batch: no package, no sign-up, and you dance the actual syllabus, not a demo. If it clicks, you decide on the full program after. Tap any 'Book my first class' button to grab your spot, or WhatsApp us and we'll help you pick a batch."
}
```

6. `pages.faqs.sections[0].items` — the partner answer (`"Do I need a partner to join?"`) → `"No. We rotate partners in class — it's the fastest way to learn and how social dancing works. Every partner dance has two roles: one person leads (suggests each move) and one follows. We teach you yours from step one, and you'll dance with everyone in the room."`
7. `pages.faqs.sections[0].items` — the attire answer (`"What should I wear to class?"`) → `"Anything comfortable that lets you move. In the studio we recommend fresh socks for beginners. For the socials, smooth-soled shoes help (you turn more easily) but they're not required — avoid sticky rubber soles if you can."`
8. `pages.faqs.sections[1].items` — cost answer → `"Foundation Salsa and Bachata are ₹6,900 for the full 2-month batch (20 hours). Intermediate courses are ₹4,700 monthly (16 hours). Pricing is per person, not per couple — and your first class is just ₹500, so you can meet the room before committing."`
9. `pages.faqs.sections[1].items` — venue answer → `"We dance at two Hyderabad venues — Jubilee Hills (2nd Floor, Alcazar Mall, Road No. 36) and PUP Unleash, HUDA Colony. Every batch card names its venue, and your booking confirmation includes the exact address and a map link."`
10. `pages.faqs.intro.lead` → `"Anything missing? WhatsApp us — we answer fast, usually within minutes during studio hours."`
11. `pages.faqs.closingCta.body` → `"WhatsApp is the fastest way to reach us — we answer fast during studio hours."`
12. `pages.home.howItWorks.steps[1]` → `{"title": "Book your first class — ₹500", "body": "One real class, no package — ₹500 holds your seat. Book right here on the site, or WhatsApp us and we'll do it together. We send dates, the studio address and what to bring."}`
13. `instructors` — DJ Ravi Kiran `shortBio` → `"DJ Ravi | International DJ (Asia)\n\nWinner — War of DJs, the all-India DJ competition held in Goa in 2025 that brought together the country's top talent.\n\nWith over 8 years of experience, DJ Ravi has established himself as one of Asia's premier Latin DJs, specializing in Salsa, Bachata, and Kizomba. His deep command of each genre — and the sub-genres within them — lets him craft seamless, immersive sets that keep dancers moving from the first beat to the last.\n\nWhat sets DJ Ravi apart is his consistency. Whether headlining weekly socials, guest DJing across India, Vietnam and Thailand, or commanding the stage at festivals and congresses, he delivers the same hallmark experience: impeccable song selection, masterful transitions, and a dance-floor energy that's impossible to ignore."`
14. `instructors` — Mitali Sharma `shortBio`: replace the sentence `"I have also been a member of their advanced competition teams, achieving placements at prestigious events such as"` with `"She has also been a member of their advanced competition teams, achieving placements at prestigious events such as"` (rest of the bio unchanged).
15. `instructors` — Venkat K `shortBio`: replace `"In his own words \"I began his salsa journey at Furor in late 2022"` with `"In his own words: \"I began my salsa journey at Furor in late 2022"` (rest unchanged).
16. `pages.stories.intro.eyebrow`: `"Blog"` → `"Stories"`.
17. `pages.terms.intro.headline`: `"Terms & Services"` → `"Terms of Service"`; `pages.terms.intro.lead`: `"Furor in Hyderabad is managed by VASISHTHA ENTERPRISES "` → `"Furor in Hyderabad is managed by VASISHTHA ENTERPRISES"` (trailing space).
18. `pages.privacy.sections[0].body` → `"When you contact us — on WhatsApp, Instagram, email or in person — we collect the information you choose to share with us. Typically that is your name, phone number, and the class or batch you are interested in."`
19. `pages.about.intro.headline`: `"Sixteen years. Five cities. One love letter to dance"` → `"Sixteen years. Five cities. One love letter to dance."`
20. `welcome.signoffHeadline`: `"See you all in class! 💃🕺"` → `"See you in class! 💃🕺"`.

- [ ] **Step 3: Sync the seed and verify**

Run: `npm run sync-seed`
Then: `npm run typecheck && npm test` — PASS (RETIRED_COPY round-trips are covered by existing schema tests; JSON validity is proven by sync-seed parsing it).

- [ ] **Step 4: Commit**

```bash
git add data/site-content.json src/data/site-content.seed.json src/lib/content-schema.ts src/lib/label-defaults.ts src/components/TonightFloat.tsx
git commit -m "fix: the 500-rupee story becomes coherent and the content document stops contradicting itself"
```

---

### Task 17: Owner checklist + PRODUCT.md update

**Files:**
- Create: `docs/owner-checklist-2026-08-24.md`
- Modify: `PRODUCT.md`

- [ ] **Step 1: Write `docs/owner-checklist-2026-08-24.md`**

Full content:

```markdown
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
```

- [ ] **Step 2: Update PRODUCT.md**

Replace the line:

```
- Batches auto-hide when `startDate` is past.
```

with:

```
- Batches stay bookable through an optional `joinUntil` (default `startDate` + 14 days — the Terms promise mid-batch joins), then auto-hide; started batches are labeled "you can still join". /admin/batches warns when any style has zero bookable Foundation inventory or a booking link points off-Razorpay.
```

In `## Capabilities and Constraints`, after the "Public pages:" bullet, add:

```
- Home body: the QuickEnroll board is the only batch surface on home; the La Rumba proof band (photos, testimonial, weekly stat, RSVP + first-class cross-link) replaced the Next-batches strip on 2026-08-24. The TonightFloat chip is desktop (lg+) only.
```

- [ ] **Step 3: Commit**

```bash
git add docs/owner-checklist-2026-08-24.md PRODUCT.md
git commit -m "docs: owner checklist for the funnel unblock and product doc updates"
```

---

### Task 18: Full verification sweep

**Files:** none (verification only; fix-forward anything found and amend the relevant area with a new commit).

- [ ] **Step 1: Unit + type + lint**

Run: `npm run typecheck && npm test && npm run lint`
Expected: all PASS, zero new lint errors.

- [ ] **Step 2: Seed sync check**

Run: `npm run sync-seed -- --check`
Expected: `✓ seed is in sync`.

- [ ] **Step 3: Production build + bundle budget**

Run: `npm run build` (minutes on this HDD — allow 10), then `npm run audit:bundle`.
Expected: build succeeds; home route's total and app-authored gz sizes are **at or below** the pre-change baseline (117.51 KB / 17.37 KB as of 2026-08-13) — the strip removal should reduce them. Record the numbers in the final report.

- [ ] **Step 4: Design detector**

Run: `node C:\Users\aakst\.claude\skills\impeccable\scripts\detect.mjs --json src/app/page.tsx src/components/RumbaBand.tsx src/components/Hero.tsx src/components/TonightFloat.tsx src/components/StyleFinder.tsx src/components/BatchesBrowser.tsx src/components/QuickEnroll.tsx src/components/FloatingTalkToUs.tsx`
Expected: exit 0, or only the known false positive (`<img>` in a Hero.tsx prose comment).

- [ ] **Step 5: Manual dev-server spot checks** (dev uses `.next-dev`; first compile is slow)

Run `npm run dev` and verify, then stop the server:
- Home at 375×667: board's lit edge visible in viewport 1; CTA appears < 1s; no chip over the headline; La Rumba band renders with 3 photos, quote, "124 dancing with us this week", RSVP + "or book your first class · ₹500".
- Home at ≥1024px wide: TonightFloat chip present top-right, dismissible.
- /batches: rows read "First class ₹500" bold over quiet full-program line; started batches say "started {date} — you can still join".
- StyleFinder: choosing a track with a live linked batch shows the pay button with price + "or chat first".
- /welcome/wcs: confirmed page shows the La Rumba invite block before the sign-off.
- /admin/batches: amber banner appears when a style has no Foundation batch (temporarily set all Salsa batches Closed to see it; revert).
- Light theme: hero badge legible; dark theme: accented headline word brighter than before.

- [ ] **Step 6: Commit any fixes; final report**

Report: test counts, bundle numbers vs baseline, detector result, and any deviations from this plan.

---

## Plan self-review notes (resolved)

- Spec coverage: Phase 0 → Task 17 checklist; 1.1 → T1/T2/T3; 1.2 → T4; 1.3 → T6; 2.1 → T7(now Task 7 = hero timing); 2.2 → T8; 2.3 → T8/T9; 2.4 → T5/T9; 2.5 → T5(css)/T10; 3.1 → T11; 3.2 → T12; 3.3 → T13; 3.4 → T14; Phase 4 → T15/T16; PRODUCT.md → T17; verification → T18.
- Label-key lifecycle: keys added in T5 (`emptyNoFoundationForStyle`) are deleted again in T11 with the strip; T5's wiring keeps `labels-wired` green in between. `ctaSeeAllBatches`/`ctaNotifyWhatsapp`/`emptyNextBatchSoon` deletion happens in T11, same commit as their render-site removal.
- Type consistency: `isJoinable(b, today)` signature used identically in T1/T2/T4; `joinUntil: string` (default `''`) everywhere; browser copy keys referenced as `copy.<key>` matching schema names.
```
