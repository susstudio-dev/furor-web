'use client';

import { useCallback } from 'react';
import type { Batch } from '@/lib/content-schema';
import { bookPriceInr, offersTrial } from '@/lib/book-label';

// The paid conversion — a Razorpay checkout link — previously rendered as a
// bare <a> with no analytics at all, so the funnel could measure every
// WhatsApp enquiry but was blind to the action that takes money. This fires
// `book_trial_click` with the same context shape enquiry_click uses, then
// lets the navigation proceed.

interface Props {
  href: string;
  batch: Batch;
  styleSlug?: string;
  branchSlug?: string;
  source: 'quick_enroll' | 'batch_row' | 'style_page' | 'hero' | 'style_finder';
  className?: string;
  children: React.ReactNode;
}

export function BookTrialLink({ href, batch, styleSlug, branchSlug, source, className, children }: Props) {
  const onClick = useCallback(() => {
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: unknown }).gtag) {
      (window as unknown as { gtag: (...a: unknown[]) => void }).gtag('event', 'book_trial_click', {
        page_path: window.location.pathname,
        source,
        batch_id: batch.id,
        dance_style: styleSlug ?? batch.styleSlugs[0] ?? null,
        branch: branchSlug ?? batch.branchSlug,
        level: batch.level,
        // What this click actually commits to paying — the trial price, or
        // the full programme fee when the batch runs no trial. It used to
        // report `reservationInr`, which defaulted to 500 for every batch,
        // so a batch with no trial booked a ₹500 conversion that never
        // happened.
        value: bookPriceInr(batch),
        currency: 'INR',
        is_trial: offersTrial(batch),
      });
    }
  }, [batch, styleSlug, branchSlug, source]);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
