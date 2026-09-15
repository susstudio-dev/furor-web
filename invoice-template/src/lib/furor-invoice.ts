/**
 * Invoice — susstudios → Furor Dance Hyderabad (website build).
 *
 * Conforms to the InvoiceData type. Render with:
 *   import { InvoiceDocument } from '../components/invoice/InvoiceDocument';
 *   <InvoiceDocument data={furorInvoice} />
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STATE:
 *   • Engagement total ₹60,000 (no tax — susstudios is not GST-registered, so
 *     no GSTIN and no GST line; the 9 line items below sum to ₹60,000).
 *   • ₹30,000 already received against SUS-INV-2026-0045 — recorded as a
 *     negative adjustment, so the printed total IS the balance due (₹30,000).
 *   • Payment details: State Bank of India a/c (Aakash Raj) — filled in below.
 *   • Issuer email: contactus.suss@gmail.com. Phone omitted (add one to show it).
 *   • status = 'issued'.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { InvoiceData } from '../types/invoice';

export const furorInvoice: InvoiceData = {
  invoiceNumber: 'SUS-INV-2026-0046',
  issueDate: '2026-09-14',
  dueDate: '2026-09-29', // net-15
  contractRef: 'Supersedes SUS-INV-2026-0045',
  status: 'issued',

  // Issuer (susstudios). No GSTIN — not registered under GST.
  from: {
    name: 'susstudios',
    addressLines: [
      'TNGOS Colony, Serilingampally',
      'Hyderabad, Telangana 500046',
      'India',
    ],
    email: 'contactus.suss@gmail.com',
    // phone omitted — add a real one here if you want it shown on the invoice
  },

  // Client — real details pulled from the furor-web site content.
  to: {
    name: 'Furor Dance Hyderabad',
    addressLines: [
      '2nd Floor, Alcazar Mall, Road No. 36',
      'Jubilee Hills, Hyderabad',
      'Telangana 500033, India',
    ],
    email: 'furorhyd@dancehyderabad.com',
    phone: '+91 88860 72572',
  },

  // ── Detailed breakdown — every line reflects work actually shipped in this
  //    repo. Rates are allocated across the agreed ₹40,000 total. ─────────────
  items: [
    {
      description: 'UI/UX design & responsive design system',
      subDescription:
        'Brand-aligned visual design; typography & colour system; dark/light theme toggle; mobile-first responsive layouts across all breakpoints; motion design (parallax, kinetic strip, cinematic headline, scroll reveals).',
      quantity: 1,
      unit: 'scope',
      rate: 9000,
    },
    {
      description: 'Public website — 13 pages',
      subDescription:
        'Home, About, Dance Styles (index + per-style template), Batches, Instructors, Stories (index + per-story template), Contact, FAQs, Privacy, Terms, and post-payment Welcome pages.',
      quantity: 1,
      unit: 'site',
      rate: 13500,
    },
    {
      description: 'Custom admin CMS — 23 editor screens',
      subDescription:
        'No-code editors for hero, site & socials, page copy (8 pages), dance styles, studios, batches, instructors, testimonials and stories; single-source JSON content model with a raw-JSON power editor.',
      quantity: 1,
      unit: 'module',
      rate: 13500,
    },
    {
      description: 'Authentication, roles & access control',
      subDescription:
        'Secure admin login (bcrypt password hashing + JWT sessions via jose); middleware protecting every /admin route; owner vs editor roles; sign-out.',
      quantity: 1,
      unit: 'module',
      rate: 4500,
    },
    {
      description: 'Content versioning, audit log & rollback',
      subDescription:
        'Every save is snapshotted with one-click restore to any previous version; full audit trail recording who changed what and when.',
      quantity: 1,
      unit: 'module',
      rate: 4500,
    },
    {
      description: 'Media uploads & image optimisation',
      subDescription:
        'Drag-and-drop image uploads to Vercel Blob storage; automatic AVIF/WebP optimisation; remote-image handling and CDN delivery.',
      quantity: 1,
      unit: 'module',
      rate: 3000,
    },
    {
      description: 'SEO & structured data',
      subDescription:
        'Dynamic sitemap.xml and robots.txt; auto-generated OpenGraph share images; JSON-LD LocalBusiness schema; per-page titles, descriptions & metadata.',
      quantity: 1,
      unit: 'setup',
      rate: 4500,
    },
    {
      description: 'Interactive features & lead capture',
      subDescription:
        'Style Finder quiz, live counter, enquiry CTAs, WhatsApp click-to-chat, quick-enroll, floating "talk to us", and post-payment welcome flows.',
      quantity: 1,
      unit: 'package',
      rate: 4500,
    },
    {
      description: 'Build, deployment & handover',
      subDescription:
        'Production build configuration; Vercel + static-export (GitHub Pages) deployment; environment/secrets wiring; content seeding and handover documentation.',
      quantity: 1,
      unit: 'setup',
      rate: 3000,
    },
  ],

  // Part-payment already received against the original invoice. Negative
  // adjustment, so the total below resolves to the outstanding balance.
  adjustments: [
    {
      label: 'Less: payment received (INV-2026-0045)',
      amount: -30000,
    },
  ],

  // No GST — susstudios is not registered, so no tax line is shown.
  tax: { mode: 'none' },

  bankDetails: {
    accountName: 'Aakash Raj',
    bankName: 'State Bank of India',
    accountNumber: '40507145024',
    ifsc: 'SBIN0002275',
  },

  notes: [
    'Engagement value ₹60,000. ₹30,000 received with thanks against invoice SUS-INV-2026-0045; this invoice covers the outstanding balance of ₹30,000.',
    'Please mention the invoice number in your payment reference.',
    'For any billing queries, contact contactus.suss@gmail.com within 7 days of receipt.',
  ],

  terms: [
    'Payment is due within 15 days of invoice date.',
    'Subject to Hyderabad, Telangana jurisdiction.',
  ],
};
