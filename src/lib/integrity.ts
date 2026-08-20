// Document-level invariants that Zod cannot express per-field.
//
// These run on the WRITE path only, never inside SiteContentSchema. A schema
// refine would be evaluated by getContent() on every read, and a stored
// document that fails validation makes getContent() serve the bundled seed for
// the ENTIRE public site — turning one bad record into a site-wide outage.
// As a write-path check, the same violation merely refuses the save.

import { firstForbiddenToken } from './content-schema';
import { SOCIAL_KEYS, socialUrlIssue } from './social-url';

export interface IntegrityIssue {
  path: (string | number)[];
  message: string;
}

type Row = Record<string, unknown>;
type Doc = Record<string, unknown>;

const ID_COLLECTIONS = [
  'danceStyles',
  'studios',
  'batches',
  'instructors',
  'testimonials',
  'stories',
  'customPages',
  'campaigns',
] as const;

function rowsOf(doc: Doc, key: string): Row[] {
  const value = doc[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}

function slugSet(doc: Doc, key: string): Set<string> {
  return new Set(
    rowsOf(doc, key)
      .map((r) => r.slug)
      .filter((s): s is string => typeof s === 'string' && s !== ''),
  );
}

function duplicates(doc: Doc, issues: IntegrityIssue[]): void {
  for (const key of ID_COLLECTIONS) {
    for (const field of ['id', 'slug'] as const) {
      const seen = new Set<string>();
      rowsOf(doc, key).forEach((row, i) => {
        const value = row?.[field];
        if (typeof value !== 'string' || value === '') return;
        if (seen.has(value)) {
          issues.push({ path: [key, i, field], message: `Duplicate ${field} "${value}"` });
        }
        seen.add(value);
      });
    }
  }
}

// Admin-authored WhatsApp prefill templates.
//
// buildPrefilledMessage used to THROW on these tokens — at click time, on the
// visitor's device — which meant an admin could author a template that crashed
// a CTA in production. Checking here turns that into a form error at save time.
// It deliberately does NOT live in SiteContentSchema: a read-path refine would
// make one bad character serve the bundled seed for the entire public site.
function messageTemplates(doc: Doc, issues: IntegrityIssue[]): void {
  const site = doc.site;
  if (site == null || typeof site !== 'object') return;
  const templates = (site as Row).whatsappTemplates;
  if (templates == null || typeof templates !== 'object') return;
  for (const [key, value] of Object.entries(templates as Row)) {
    if (typeof value !== 'string') continue;
    const bad = firstForbiddenToken(value);
    if (bad) {
      issues.push({
        path: ['site', 'whatsappTemplates', key],
        message: `Message cannot contain "${bad}" — it would break the WhatsApp link.`,
      });
    }
  }
}

function references(doc: Doc, issues: IntegrityIssue[]): void {
  const styles = slugSet(doc, 'danceStyles');
  const studios = slugSet(doc, 'studios');

  const checkOne = (value: unknown, known: Set<string>, label: string, path: (string | number)[]) => {
    if (typeof value !== 'string' || value === '') return;
    if (!known.has(value)) issues.push({ path, message: `Unknown ${label} "${value}"` });
  };
  const checkMany = (value: unknown, known: Set<string>, label: string, base: (string | number)[]) => {
    if (!Array.isArray(value)) return;
    value.forEach((v, j) => checkOne(v, known, label, [...base, j]));
  };

  rowsOf(doc, 'batches').forEach((b, i) => {
    checkMany(b.styleSlugs, styles, 'dance style', ['batches', i, 'styleSlugs']);
    checkOne(b.branchSlug, studios, 'studio', ['batches', i, 'branchSlug']);
  });
  rowsOf(doc, 'studios').forEach((s, i) => {
    checkMany(s.styleSlugs, styles, 'dance style', ['studios', i, 'styleSlugs']);
  });
  rowsOf(doc, 'instructors').forEach((ins, i) => {
    checkMany(ins.branchSlugs, studios, 'studio', ['instructors', i, 'branchSlugs']);
    checkMany(ins.styleSlugs, styles, 'dance style', ['instructors', i, 'styleSlugs']);
  });
  rowsOf(doc, 'testimonials').forEach((t, i) => {
    checkOne(t.styleSlug, styles, 'dance style', ['testimonials', i, 'styleSlug']);
  });
}

// Social URLs are shape-checked here, not in the schema: a Zod refine would
// run on every read and a single malformed URL would make getContent() serve
// the bundled seed for the whole public site. Note save-pipeline.ts only
// rejects issues a patch INTRODUCED, so the already-stored bad YouTube URL
// stays saveable — which matters, because /admin/site is where it gets fixed.
function socials(doc: Doc, issues: IntegrityIssue[]): void {
  const site = doc.site;
  if (site == null || typeof site !== 'object') return;
  const bag = (site as Row).socials;
  if (bag == null || typeof bag !== 'object') return;
  for (const key of SOCIAL_KEYS) {
    const value = (bag as Row)[key];
    if (typeof value !== 'string') continue;
    const issue = socialUrlIssue(key, value.trim());
    if (issue) issues.push({ path: ['site', 'socials', key], message: issue });
  }
}

// Welcome-page tracks.
//
// `welcome` is a nested object rather than a top-level array, so it is invisible
// to ID_COLLECTIONS and to references() — which is how both invariants below
// came to be enforced nowhere on the write path. The duplicate-slug check did
// exist, but only inside the welcome-page editor component, so any other write
// path could persist a slug that /welcome/[track] can never reach (it resolves
// with find(): first match wins, the second page is unreachable for good).
//
// Deliberately NOT checked here: "this batch has no welcome page for its level
// and style". That is a legitimate intermediate state — the studio creates the
// batch first and the page after — so it is a warning in BatchesEditor, not a
// save-blocking error.
function welcomeTracks(doc: Doc, issues: IntegrityIssue[]): void {
  const welcome = doc.welcome;
  if (welcome == null || typeof welcome !== 'object') return;
  const tracks = (welcome as Row).tracks;
  if (!Array.isArray(tracks)) return;

  const styles = slugSet(doc, 'danceStyles');
  const seen = new Set<string>();
  const reported = new Set<string>();

  tracks.forEach((track, i) => {
    if (track == null || typeof track !== 'object') return;
    const row = track as Row;

    const key = typeof row.key === 'string' ? row.key.trim() : '';
    if (key) {
      if (seen.has(key) && !reported.has(key)) {
        reported.add(key);
        issues.push({
          path: ['welcome', 'tracks', i, 'key'],
          message: `Duplicate welcome page slug "${key}" — the second page would be unreachable.`,
        });
      }
      seen.add(key);
    }

    // Matched against batches exactly and case-sensitively, so one stray
    // capital means the page binds to no batch at all and says nothing.
    if (Array.isArray(row.styleSlugs)) {
      row.styleSlugs.forEach((slug, j) => {
        if (typeof slug !== 'string' || slug === '') return;
        if (!styles.has(slug)) {
          issues.push({
            path: ['welcome', 'tracks', i, 'styleSlugs', j],
            message: `Unknown dance style "${slug}"`,
          });
        }
      });
    }
  });
}

/**
 * A single first class must cost LESS than the programme it samples.
 *
 * Stored data said otherwise in production — Intermediate and Advanced
 * batches carried `trialInr` equal to `priceInr` — and the board dutifully
 * rendered "First class ₹4,700" beside "Full program ₹4,700". `offersTrial`
 * now refuses to treat that as an offer so nothing contradictory reaches a
 * visitor, but silently reinterpreting the owner's data is not the same as
 * telling them it is wrong. This makes the save say so.
 */
function singleClassPricing(doc: Doc, issues: IntegrityIssue[]): void {
  rowsOf(doc, 'batches').forEach((b, i) => {
    const trial = b.trialInr;
    const price = b.priceInr;
    if (typeof trial !== 'number' || typeof price !== 'number') return;
    if (trial >= price) {
      issues.push({
        path: ['batches', i, 'trialInr'],
        message:
          `A single first class at ₹${trial} costs as much as the full program ` +
          `(₹${price}), so it is not an offer. Either price it below the program ` +
          `fee or untick "You can book a single class in this batch".`,
      });
    }
  });
}

/** Every invariant violation in the document. Empty means consistent. */
export function integrityIssues(doc: unknown): IntegrityIssue[] {
  if (doc == null || typeof doc !== 'object') return [];
  const issues: IntegrityIssue[] = [];
  duplicates(doc as Doc, issues);
  socials(doc as Doc, issues);
  references(doc as Doc, issues);
  messageTemplates(doc as Doc, issues);
  welcomeTracks(doc as Doc, issues);
  singleClassPricing(doc as Doc, issues);
  return issues;
}
