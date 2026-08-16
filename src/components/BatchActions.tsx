import type { Batch, WhatsappTemplates } from '@/lib/content-schema';
import { formatInr } from '@/lib/format';
import { BookTrialLink } from './BookTrialLink';
import { EnquiryCTA } from './EnquiryCTA';
import { label, type Labels } from '@/lib/labels';
import { bookLabel, bookPriceInr } from '@/lib/book-label';

// One source of truth for a batch row's actions — on /batches, on
// /dance-styles/[slug], and on the home Next-batches strip. The paid trial is
// the primary wherever a booking link exists (first-person, level-aware,
// price on the button — the click lands on a payment page, so hiding the
// price trades clicks for payment-page abandonment); WhatsApp is always the
// text-weight "or chat first" path, and promotes to primary when no link
// exists. Every booking click fires book_trial_click via BookTrialLink.
export function BatchActions({
  batch,
  style,
  branch,
  whatsappNumber,
  primaryLabelWhenNoLink,
  whatsappLabelWhenLink,
  labels,
  templates,
}: {
  batch: Batch;
  style: { slug: string; name: string };
  branch: { slug: string; name: string };
  whatsappNumber: string;
  primaryLabelWhenNoLink?: string;
  whatsappLabelWhenLink?: string;
  labels: Labels;
  templates: WhatsappTemplates;
}) {
  const ctx = {
    source: 'batch_row' as const,
    style,
    branch,
    batch,
  };
  // The former hardcoded defaults are now the label document's defaults, so an
  // edit in /admin/labels reaches every batch row on the site.
  // Label and price both come off the batch's own trial state: a batch with
  // no trial says "Book my seat" at the programme price rather than promising
  // a trial class at a deposit it never charges.
  const book = bookLabel(batch, labels);
  const noLinkLabel = primaryLabelWhenNoLink ?? label(labels, 'ctaEnquireWhatsapp');
  const chatLabel = whatsappLabelWhenLink ?? label(labels, 'ctaChatFirst');

  if (batch.razorpayLink) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BookTrialLink
          href={batch.razorpayLink}
          batch={batch}
          styleSlug={style.slug}
          branchSlug={branch.slug}
          source="batch_row"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ember-600 text-on-ember px-4 py-2 text-sm font-semibold hover:bg-ember-700 transition"
        >
          {book} · {formatInr(bookPriceInr(batch))}
        </BookTrialLink>
        <EnquiryCTA
          whatsappNumber={whatsappNumber}
          ctx={ctx}
          variant="link"
          label={chatLabel}
          labels={labels}
          templates={templates}
        />
      </div>
    );
  }

  return (
    <EnquiryCTA
      whatsappNumber={whatsappNumber}
      ctx={ctx}
      variant="batch-row"
      label={noLinkLabel}
      labels={labels}
      templates={templates}
    />
  );
}
