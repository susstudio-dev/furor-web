import type { Batch } from '@/lib/content-schema';
import { formatInr } from '@/lib/format';
import { EnquiryCTA } from './EnquiryCTA';

// One source of truth for what a batch row's actions look like — on /batches,
// on /dance-styles/[slug], and on the home Next-batches strip. Whenever the
// batch has a razorpayLink, "Book seat · ₹X" is the primary action; WhatsApp
// is the secondary "Or chat first" path. Without a link, WhatsApp is primary.
export function BatchActions({
  batch,
  style,
  branch,
  whatsappNumber,
  primaryLabelWhenNoLink = 'Enquire on WhatsApp',
  whatsappLabelWhenLink = 'Or chat first',
}: {
  batch: Batch;
  style: { slug: string; name: string };
  branch: { slug: string; name: string };
  whatsappNumber: string;
  primaryLabelWhenNoLink?: string;
  whatsappLabelWhenLink?: string;
}) {
  const ctx = {
    source: 'batch_row' as const,
    style,
    branch,
    batch,
  };

  if (batch.razorpayLink) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={batch.razorpayLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ember-600 text-on-ember px-4 py-2 text-sm font-semibold hover:bg-ember-700 transition"
        >
          Book seat · {formatInr(batch.reservationInr)}
        </a>
        <EnquiryCTA
          whatsappNumber={whatsappNumber}
          ctx={ctx}
          variant="batch-row"
          label={whatsappLabelWhenLink}
        />
      </div>
    );
  }

  return (
    <EnquiryCTA
      whatsappNumber={whatsappNumber}
      ctx={ctx}
      variant="batch-row"
      label={primaryLabelWhenNoLink}
    />
  );
}
