import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LABEL_DEFAULTS, type LabelKey } from './labels';

// Guards the invariant that a label key is worthless unless something renders
// it: every key in LABEL_DEFAULTS shows up in the admin's labels editor, so a
// key with no render site is a field the owner can type into, save, and watch
// change nothing.
//
// This is not hypothetical. welcomeWhereHeading, welcomeOpenMap, welcomeParking
// and welcomeReachUs were declared ahead of their render sites and sat dead for
// two whole plans — the schema comment beside them even claimed "Plan 3 already
// renders" them while WelcomeView.tsx held the literals 'Where', 'Open map →',
// 'Parking: {notes}' and 'Reach us' hardcoded. Nothing caught it: typecheck is
// happy (the key exists), the suite was green (defaults were pinned), and the
// page looked correct (the literals said the right words). Only reading the two
// files side by side revealed it.
//
// Deliberately hand-rolled with node:fs/node:path, matching client-bundle.test.ts:
// no new dependency, no AST library. A quoted-string search is a proxy for
// "consumed", not a parser — `label(labels, 'x')` is the only way this codebase
// reads a label, and the schema refers to keys as `L.x` (unquoted), so the proxy
// is tight in practice.

const SRC_DIR = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(SRC_DIR, 'app', 'admin') + path.sep;
const LABEL_DEFAULTS_PATH = path.join(SRC_DIR, 'lib', 'label-defaults.ts');

// Keys that are knowingly declared without a render site. Every entry needs a
// reason, and the test below FAILS if an entry here becomes wired — so this
// list cannot quietly rot into a list of things nobody checked.
const KNOWN_UNWIRED: ReadonlySet<LabelKey> = new Set<LabelKey>([
  // Its 'Call {phone}' default disagrees with the 'Call the studio' literal
  // welcome-contact.ts actually builds for the phone row, and rendering it
  // would repeat the number already displayed as that row's value. Wiring it
  // is a copy decision for the owner, not a mechanical one.
  'welcomeCallPhone',
  // Rendered only by the home page's six-card style gallery, which the owner
  // cut on 2026-08-23 (the compact style-pill row that replaced it links by
  // style NAME, and its trailing link is ctaAllStyles). The key stays editable
  // because /dance-styles cards may want it back; delete it from the schema
  // instead if that never happens.
  'ctaExplore',
]);

/**
 * Files that could plausibly RENDER a label.
 *
 * `src/app/admin/**` is excluded on purpose: the admin is where labels are
 * edited, so counting an editor's own reference as a render site would make
 * this test vacuous — the editor is exactly the surface that makes a dead key
 * look alive. Tests are excluded for the same reason.
 *
 * `labels.ts` IS included: enquiryDefaultLabel() genuinely consumes
 * ctaDmInstagram/ctaWhatsApp there, so excluding it produced a false positive.
 * It also holds PILL_KEYS, which names four keys without rendering them — all
 * four are rendered elsewhere, so that imprecision costs nothing today.
 */
function renderSiteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!full.startsWith(ADMIN_DIR.slice(0, -1))) renderSiteFiles(full, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      full !== LABEL_DEFAULTS_PATH
    ) {
      out.push(full);
    }
  }
  return out;
}

const HAYSTACK = renderSiteFiles(SRC_DIR)
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

function isRendered(key: string): boolean {
  return new RegExp(`['"\`]${key}['"\`]`).test(HAYSTACK);
}

describe('every label key has a render site', () => {
  const keys = Object.keys(LABEL_DEFAULTS) as LabelKey[];

  it('finds label keys to check', () => {
    // Cheap canary: if the shape of LABEL_DEFAULTS ever changes so that this
    // reads zero keys, every assertion below would vacuously pass.
    expect(keys.length).toBeGreaterThan(50);
  });

  it.each(keys.filter((k) => !KNOWN_UNWIRED.has(k)))(
    '%s is rendered outside the admin',
    (key) => {
      expect(
        isRendered(key),
        `labels.${key} is editable in the admin but nothing outside src/app/admin renders it. ` +
          `Wire it to its render site in this same change, or add it to KNOWN_UNWIRED with a reason.`,
      ).toBe(true);
    },
  );

  it('KNOWN_UNWIRED contains no key that is now wired', () => {
    const stale = [...KNOWN_UNWIRED].filter((key) => isRendered(key));
    expect(
      stale,
      `these keys are listed as unwired but now have a render site — delete them from KNOWN_UNWIRED: ${stale.join(', ')}`,
    ).toEqual([]);
  });
});
