import { LABEL_DEFAULT_LITERALS } from './label-defaults';
import type { Labels } from './content-schema';

export type { Labels };

/**
 * The literals shipping today. Sourced from ./label-defaults, NOT from
 * `LabelsSchema.parse({})` — this file is value-imported by public
 * 'use client' components (EnquiryCTA, FloatingTalkToUs), and content-schema.ts
 * value-imports zod. A hand-maintained second copy of 56 strings would be a
 * drift bug waiting to happen, so this isn't a restatement: LabelsSchema's own
 * `.default(...)` values are pulled from the exact same ./label-defaults
 * object, so the two can never diverge. Only the `Labels` *type* is imported
 * from content-schema.ts here (erased at compile time — types never reach the
 * client bundle); no value from that module, and therefore no zod, is ever
 * imported by this file. See content-schema.ts's comment above LabelsSchema
 * for the full chain this avoids.
 */
export const LABEL_DEFAULTS: Labels = LABEL_DEFAULT_LITERALS;

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

/**
 * The label an EnquiryCTA shows when the call site does not name one.
 *
 * `labels` is required. Every render site is reachable from the content
 * document — an optional parameter here would let a future call site opt out
 * of editability with no error anywhere, and /admin/labels would quietly stop
 * being the source of truth it claims to be. The unions are written inline
 * rather than imported so this module keeps a single dependency (the schema).
 */
export function enquiryDefaultLabel(
  channel: 'whatsapp' | 'instagram',
  variant: 'primary' | 'secondary' | 'batch-row' | 'link' | 'icon',
  labels: Labels,
): string {
  if (channel === 'instagram') return label(labels, 'ctaDmInstagram');
  return variant === 'batch-row'
    ? label(labels, 'ctaEnquireWhatsapp')
    : label(labels, 'ctaChatWhatsapp');
}
