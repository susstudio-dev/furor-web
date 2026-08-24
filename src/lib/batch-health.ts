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
