import { label, type Labels } from './labels';

/**
 * One source of truth for a booking CTA's copy.
 *
 * BatchActions, QuickEnroll, Hero and the home page each built this same label
 * independently, which is how two of them can drift apart without anyone
 * noticing.
 */
export function bookLabel(level: string, labels: Labels): string {
  return level === 'Foundation'
    ? label(labels, 'ctaBookFoundation')
    : label(labels, 'ctaBookTrial');
}

/**
 * The display label for a batch's status.
 *
 * The stored ENUM VALUES ('Open' | 'Filling Fast' | 'Closed') are live URL
 * state in BatchesBrowser — read from ?status=, compared, and shared in
 * bookmarked links. They are structural and never editable. What a visitor
 * READS is editable, and now has exactly one casing site-wide.
 */
export function statusLabel(status: string, labels: Labels): string {
  if (status === 'Filling Fast') return label(labels, 'badgeFillingFast');
  if (status === 'Open') return label(labels, 'badgeOpen');
  if (status === 'Closed') return label(labels, 'badgeClosed');
  return status;
}
