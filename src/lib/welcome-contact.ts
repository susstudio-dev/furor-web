// The confirmation page's contact block, derived from records.
//
// Every row here comes from a stored field: the venue and its parking note
// from the batch's own studio, the map link from that studio's coordinates,
// the phone from its telephone. Nothing is typed into page copy.
//
// That is the whole point. A hand-authored confirmation page told paying
// customers to arrive at "Alcazar Mall, Jubilee Hills" by "4:15 PM" for a
// class that runs 9:30-10:30 AM at PUP Unleash - HUDA Colony. Copy drifts
// from the record it describes; a derivation cannot.
//
// Value imports here must stay zod-free: this module is reachable from the
// welcome page and `src/lib/client-bundle.test.ts` fails if any 'use client'
// file pulls zod or the content schema in through a value import.
import type { SiteContent, Studio } from './content-schema';

export type ContactRowKind = 'venue' | 'directions' | 'phone' | 'whatsapp' | 'instagram';

export interface ContactRow {
  kind: ContactRowKind;
  /** Short heading for the row — a studio name, or a channel name. */
  label: string;
  /** The human-readable value: an address, a dialable number, a handle. */
  value: string;
  /** Where the row links, when it links anywhere. */
  href?: string;
  /** Secondary line, e.g. parking notes. Absent rather than empty. */
  note?: string;
}

type SiteBits = Pick<SiteContent['site'], 'whatsappNumber' | 'instagramHandle'>;

/**
 * Build the confirmation page's contact rows.
 *
 * When `studio` is undefined — no batch resolved for this track — the venue,
 * directions and phone rows are omitted entirely rather than guessed. An
 * absent address is far better than a confidently wrong one, which is exactly
 * what the old `?? content.studios[0]` fallback produced.
 */
export function contactRows({
  studio,
  site,
}: {
  studio?: Pick<Studio, 'name' | 'address' | 'geo' | 'telephone' | 'parkingNotes'>;
  site: SiteBits;
}): ContactRow[] {
  const rows: ContactRow[] = [];

  if (studio) {
    const parking = studio.parkingNotes?.trim();
    rows.push({
      kind: 'venue',
      label: studio.name,
      value: studio.address,
      ...(parking ? { note: parking } : {}),
    });

    // Coordinates, not the address string: a text query can resolve to a
    // different branch of the same mall, and the studio record already
    // carries the exact point.
    rows.push({
      kind: 'directions',
      label: 'Directions',
      value: 'Open in Google Maps',
      href: `https://www.google.com/maps/search/?api=1&query=${studio.geo.lat},${studio.geo.lng}`,
    });

    const dialable = studio.telephone.replace(/\s+/g, '');
    rows.push({
      kind: 'phone',
      label: 'Call the studio',
      value: studio.telephone,
      href: `tel:${dialable}`,
    });
  }

  // WhatsApp and Instagram are studio-independent — they are how the school
  // is reached regardless of which venue a batch runs at, so they survive the
  // no-batch case.
  rows.push({
    kind: 'whatsapp',
    label: 'WhatsApp',
    value: 'Message us',
    href: `https://wa.me/${site.whatsappNumber}`,
  });

  rows.push({
    kind: 'instagram',
    label: 'Instagram',
    value: `@${site.instagramHandle}`,
    href: `https://instagram.com/${site.instagramHandle}`,
  });

  return rows;
}
