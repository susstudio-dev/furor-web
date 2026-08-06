import { EnquiryCTA } from './EnquiryCTA';

// The After-Band: a mobile-only booking bar that appears once the visitor has
// scrolled PAST the booking board and rides the bottom edge through the
// brochure sections. Zero JS — it is position:sticky at the END of a wrapper
// that starts below the board, so sticky clamping does the "appear after the
// board" logic for free in every browser, and it settles back into the flow
// at the wrapper's end instead of covering the footer.
//
// It anchors back to the board rather than deep-linking any batch's payment
// page: a persistent bar that charges you for a class you never chose is a
// trust failure, and trust is this site's entire currency.
//
// Opaque fill on purpose — no backdrop-blur. This codebase already removed a
// backdrop-filter from the board for its per-scroll-frame cost on low-end
// Android, which is exactly the hardware this bar exists for.
export function StickyTrialBar({
  whatsappNumber,
  label,
}: {
  whatsappNumber: string;
  label: string;
}) {
  return (
    <div className="sticky bottom-0 z-30 sm:hidden">
      {/* The board's lit-edge grammar: "lit" means "you can book here". */}
      <div aria-hidden className="relative h-[2px] w-full">
        <div className="absolute inset-0 [background:linear-gradient(to_right,transparent,rgb(var(--c-ember-600)/0.9)_28%,rgb(var(--c-ember-400))_50%,rgb(var(--c-ember-600)/0.9)_72%,transparent)]" />
      </div>
      <div className="flex items-center gap-3 bg-ink-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <a
          href="#start-this-week"
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-ember-600 px-4 text-sm font-semibold text-on-ember transition hover:bg-ember-700"
        >
          {label}
        </a>
        <EnquiryCTA
          whatsappNumber={whatsappNumber}
          ctx={{ source: 'sticky_bar' }}
          variant="icon"
          ariaLabel="Chat on WhatsApp"
        />
      </div>
    </div>
  );
}
