import { formatBatchDate } from './format';
import type { Batch, DanceStyle, Studio } from './content-schema';

export type EnquirySource =
  | 'floating'
  | 'primary'
  | 'batch_row'
  | 'style_card'
  | 'branch_card'
  | 'style_finder'
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

const FORBIDDEN = ['<', '>', '{{', '}}', 'undefined'];

function assertCleanMessage(msg: string): string {
  for (const token of FORBIDDEN) {
    if (msg.includes(token)) {
      throw new Error(`Enquiry message contains forbidden token "${token}": ${msg}`);
    }
  }
  return msg;
}

export function buildPrefilledMessage(ctx: EnquiryContext): string {
  // Per-batch: most specific
  if (ctx.batch && ctx.style && ctx.branch) {
    const days = ctx.batch.daysOfWeek.join('–');
    const date = formatBatchDate(ctx.batch.startDate);
    return assertCleanMessage(
      `Hi Furor, I'm interested in the ${ctx.style.name} ${ctx.batch.level} batch at ${ctx.branch.name} (${days}, ${ctx.batch.time}, starting ${date}). Please share details.`,
    );
  }

  // Style finder result
  if (ctx.source === 'style_finder' && ctx.styleFinderRecommendation) {
    const r = ctx.styleFinderRecommendation;
    const where = r.branchName ? ` at ${r.branchName}` : '';
    return assertCleanMessage(
      `Hi Furor, the style finder suggested ${r.styleName} ${r.level}${where} for me. Please tell me about the next batch.`,
    );
  }

  // Style page
  if (ctx.style && !ctx.branch) {
    return assertCleanMessage(
      `Hi Furor, I'm interested in ${ctx.style.name} classes — please share details.`,
    );
  }

  // Branch page
  if (ctx.branch && !ctx.style) {
    return assertCleanMessage(
      `Hi Furor, I'd like to know about classes at your ${ctx.branch.name} studio.`,
    );
  }

  // Custom note (e.g. "Tonight" tile)
  if (ctx.customNote) {
    return assertCleanMessage(`Hi Furor, I'd like to come to ${ctx.customNote}.`);
  }

  // Generic / floating from home
  return assertCleanMessage(`Hi Furor, I'd like to know more about your dance classes.`);
}

export function buildWhatsAppHref(whatsappNumber: string, ctx: EnquiryContext): string {
  const msg = buildPrefilledMessage(ctx);
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

export function buildInstagramAppHref(handle: string): string {
  return `instagram://user?username=${handle}`;
}

export function buildInstagramWebHref(handle: string): string {
  return `https://instagram.com/${handle}`;
}
