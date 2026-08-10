import { LabelsSchema } from './content-schema';
import type { Labels } from './content-schema';

export type { Labels };

/**
 * The literals shipping today, derived from the schema rather than restated.
 *
 * A hand-maintained second copy of 56 strings is a drift bug waiting to
 * happen. Parsing an empty object through LabelsSchema yields exactly the
 * defaults, once per isolate at module load.
 */
export const LABEL_DEFAULTS: Labels = LabelsSchema.parse({});

export type LabelKey = keyof typeof LABEL_DEFAULTS;

/**
 * Resolve one label.
 *
 * An empty (or whitespace-only, or absent) stored value means "use the shipped
 * copy", so clearing a field in /admin restores the default instead of
 * rendering a blank button. That is the behaviour the admin screen's
 * placeholder and its "reset to default" action both promise.
 */
export function label(labels: Labels, key: LabelKey): string {
  const stored = (labels as Record<string, unknown> | undefined)?.[key];
  if (typeof stored === 'string' && stored.trim() !== '') return stored;
  return LABEL_DEFAULTS[key];
}

/**
 * Labels that render inside a `.pill`.
 *
 * `.pill` is `whitespace-nowrap` and several of its call sites sit inside
 * `overflow-clip` wrappers, so an over-long value is silently cut mid-word —
 * not wrapped, not scrollable, not visible. The admin shows a character hint
 * for these so the editor finds out at typing time rather than from the live
 * site. Membership is measured, not guessed: these four are the only label
 * keys whose render site carries the `.pill` class today.
 */
export const PILL_KEYS: ReadonlySet<LabelKey> = new Set<LabelKey>([
  'badgeFillingFast',
  'badgeOpen',
  'badgeClosed',
  'badgeFirstTimersWelcome',
]);

/** Roughly what fits in a pill at 375px without clipping the sibling text. */
export const PILL_CHAR_LIMIT = 24;
