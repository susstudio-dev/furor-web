/**
 * Sample invoice data + usage examples.
 * Use this file as a reference when wiring up your real data from Supabase.
 */

import type { InvoiceData } from '../types/invoice';

/**
 * Example 1 — Monthly lease invoice for a corporate client.
 * Indian intra-state (CGST + SGST split).
 */
export const sampleLeaseInvoice: InvoiceData = {
  invoiceNumber: 'SUS-INV-2026-0042',
  issueDate: '2026-06-01',
  dueDate: '2026-06-08',
  poNumber: 'PO-2026-1184',
  contractRef: 'LSE-2025-0009',
  status: 'issued',

  from: {
    name: 'susstudios',
    taxId: '27ABCDE1234F1Z5',
    addressLines: [
      'Office No. 402, Tech Park',
      'Andheri East, Mumbai',
      'Maharashtra 400069, India',
    ],
    email: 'billing@susstudios.com',
    phone: '+91 98765 43210',
  },

  to: {
    name: 'Acme Logistics Pvt. Ltd.',
    taxId: '27XYZAB6789C1D2',
    addressLines: [
      '5th Floor, Lodha Excelus',
      'Lower Parel, Mumbai',
      'Maharashtra 400013, India',
    ],
    email: 'accounts@acmelogistics.in',
    phone: '+91 22 6655 4400',
  },

  items: [
    {
      description: 'Monthly Lease Rental — Honda City ZX CVT',
      subDescription: 'Reg. No. MH12AB1234 · June 2026',
      quantity: 1,
      unit: 'month',
      rate: 28500,
    },
    {
      description: 'Monthly Lease Rental — Maruti Ertiga VXi',
      subDescription: 'Reg. No. MH14CD5678 · June 2026',
      quantity: 1,
      unit: 'month',
      rate: 24000,
    },
    {
      description: 'Additional Servicing — Brake pad replacement',
      subDescription: 'Vehicle MH12AB1234 · Service ticket SR-0091',
      quantity: 1,
      unit: 'service',
      rate: 3200,
    },
  ],

  adjustments: [
    { label: 'Loyalty Discount', amount: -1500 },
  ],

  tax: {
    mode: 'exclusive',
    label: 'GST',
    rate: 18,
    split: true, // intra-state: CGST 9% + SGST 9%
  },

  bankDetails: {
    accountName: 'susstudios',
    bankName: 'HDFC Bank',
    accountNumber: '50100123456789',
    ifsc: 'HDFC0000234',
    branch: 'Andheri East',
    upiId: 'susstudios@hdfcbank',
  },

  notes: [
    'Please mention the invoice number in your payment reference.',
    'For any billing queries, contact billing@susstudios.com within 7 days of receipt.',
  ],

  terms: [
    'Payment is due within 7 days of invoice date.',
    'Late payments attract interest at 1.5% per month on the outstanding amount.',
    'Subject to Mumbai jurisdiction.',
  ],
};

/**
 * Example 2 — Tax-inclusive invoice (e.g. fixed-price project where pricing
 * was quoted "all-inclusive").
 */
export const sampleInclusiveInvoice: InvoiceData = {
  invoiceNumber: 'SUS-INV-2026-0043',
  issueDate: '2026-06-01',
  dueDate: '2026-06-15',
  status: 'issued',

  from: sampleLeaseInvoice.from,
  to: {
    name: 'Bright Horizons Pvt. Ltd.',
    addressLines: ['Plot 22, Sector 18', 'Gurgaon, Haryana 122015'],
    email: 'finance@brighthorizons.in',
  },

  items: [
    {
      description: 'Phase 1 Milestone — Discovery & UI Sign-off',
      subDescription: 'Per Quotation SUS-202606-0142',
      quantity: 1,
      unit: 'milestone',
      rate: 36000,
    },
  ],

  // tax is omitted entirely — shows no tax line, treats total as final
  tax: { mode: 'none' },

  bankDetails: sampleLeaseInvoice.bankDetails,

  notes: [
    'All pricing is inclusive of applicable taxes as per quotation.',
  ],
};

/**
 * Example 3 — Minimal invoice (one-off freelance work).
 */
export const sampleMinimalInvoice: InvoiceData = {
  invoiceNumber: 'SUS-INV-2026-0044',
  issueDate: new Date(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

  from: sampleLeaseInvoice.from,
  to: {
    name: 'John Doe',
    addressLines: ['Bandra West, Mumbai 400050'],
  },

  items: [
    { description: 'Website consultation — 2 hours', rate: 2000, quantity: 2, unit: 'hr' },
  ],

  tax: { mode: 'none' },
};
