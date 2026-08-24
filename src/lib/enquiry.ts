import { formatBatchDate, todayIso } from './format';
import type { Batch, DanceStyle, Studio } from './content-schema';
import type { WhatsappTemplates } from './content-schema';

export type EnquirySource =
  | 'floating'
  | 'primary'
  | 'batch_row'
  | 'style_card'
  | 'branch_card'
  | 'style_finder'
  | 'quick_enroll'
  | 'sticky_bar'
  | 'footer';

export type EnquiryChannel = 'whatsapp' | 'instagram';

export interface EnquiryContext {
  source: EnquirySource;
  style?: Pick<DanceStyle, 'slug' | 'name'>;
  branch?: Pick<Studio, 'slug' | 'name'>;
  batch?: Batch;
  styleFinderRecommendation?: { styleName: string; level: string; branchName?: string };
  /** Free-text override for events/tile CTAs — replaces the default body. */
  customNote?: string;
}

export { FORBIDDEN_MESSAGE_TOKENS, firstForbiddenToken } from './content-schema';
export type { WhatsappTemplates } from './content-schema';

/**
 * Substitute {placeholders}.
 *
 * A placeholder with no value is left EXACTLY as typed rather than replaced
 * with an empty string or String(undefined): deleting words silently is worse
 * than showing the editor their own token back, and "undefined" appearing in a
 * customer's WhatsApp draft is the precise failure the forbidden-token list
 * exists to prevent.
 */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole,
  );
}

/**
 * The prefilled WhatsApp body.
 *
 * The forbidden-token check that used to THROW here now runs on the write path
 * (src/lib/integrity.ts), so a bad template is a form error at save time rather
 * than a crash on a visitor's phone at click time. Nothing in this function
 * throws.
 */
export function buildPrefilledMessage(ctx: EnquiryContext, t: WhatsappTemplates): string {
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

  // Style finder result
  if (ctx.source === 'style_finder' && ctx.styleFinderRecommendation) {
    const r = ctx.styleFinderRecommendation;
    const where = r.branchName ? fill(t.styleFinderWhere, { branch: r.branchName }) : '';
    return fill(t.styleFinder, { style: r.styleName, level: r.level, where });
  }

  // Style page
  if (ctx.style && !ctx.branch) {
    return fill(t.style, { style: ctx.style.name });
  }

  // Branch page
  if (ctx.branch && !ctx.style) {
    return fill(t.branch, { branch: ctx.branch.name });
  }

  // Custom note (the Tonight tile, the trial ribbon)
  if (ctx.customNote) {
    return fill(t.custom, { note: ctx.customNote });
  }

  // Generic / floating from home
  return t.generic;
}

export function buildWhatsAppHref(
  whatsappNumber: string,
  ctx: EnquiryContext,
  t: WhatsappTemplates,
): string {
  const msg = buildPrefilledMessage(ctx, t);
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

export function buildInstagramAppHref(handle: string): string {
  return `instagram://user?username=${handle}`;
}

export function buildInstagramWebHref(handle: string): string {
  return `https://instagram.com/${handle}`;
}
