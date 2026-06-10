/**
 * Invoice utilities — formatting and total computation.
 * Pure functions, no React, no PDF dependencies. Easy to unit test.
 */

import type { InvoiceData, InvoiceTotals } from '../types/invoice';

/** Format a number as Indian-rupee currency string. */
export function formatCurrency(
  amount: number,
  currency = 'INR',
  locale = 'en-IN',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format a date as "15 Jan 2026". */
export function formatDate(date: string | Date, locale = 'en-IN'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Compute all totals from invoice data. Deterministic, side-effect free. */
export function computeInvoiceTotals(invoice: InvoiceData): InvoiceTotals {
  const subtotal = invoice.items.reduce((sum, item) => {
    const qty = item.quantity ?? 1;
    return sum + qty * item.rate;
  }, 0);

  const adjustmentsTotal = (invoice.adjustments ?? []).reduce(
    (sum, adj) => sum + adj.amount,
    0,
  );

  const taxableValue = subtotal + adjustmentsTotal;

  let taxAmount = 0;
  let taxBreakdown: { label: string; amount: number }[] | undefined;

  if (invoice.tax && invoice.tax.mode !== 'none') {
    if (invoice.tax.mode === 'exclusive') {
      taxAmount = round2((taxableValue * invoice.tax.rate) / 100);
    } else {
      // inclusive — tax is already baked in; extract for display
      taxAmount = round2(
        taxableValue - taxableValue / (1 + invoice.tax.rate / 100),
      );
    }

    if (invoice.tax.split) {
      // Intra-state GST: split into CGST + SGST each at half rate
      const half = round2(taxAmount / 2);
      taxBreakdown = [
        { label: `CGST @ ${invoice.tax.rate / 2}%`, amount: half },
        { label: `SGST @ ${invoice.tax.rate / 2}%`, amount: taxAmount - half },
      ];
    } else {
      taxBreakdown = [
        { label: `${invoice.tax.label} @ ${invoice.tax.rate}%`, amount: taxAmount },
      ];
    }
  }

  const total =
    invoice.tax?.mode === 'exclusive'
      ? taxableValue + taxAmount
      : taxableValue;

  return {
    subtotal: round2(subtotal),
    adjustmentsTotal: round2(adjustmentsTotal),
    taxableValue: round2(taxableValue),
    taxAmount: round2(taxAmount),
    taxBreakdown,
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert a number to Indian English words.
 * "1,23,456.78" → "One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Rupees and Seventy-Eight Paise Only"
 * Required for GST-compliant invoices in India.
 */
export function amountInWordsINR(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const rupeeWords = rupees === 0 ? 'Zero' : indianNumberToWords(rupees);
  let result = `${rupeeWords} Rupees`;
  if (paise > 0) {
    result += ` and ${indianNumberToWords(paise)} Paise`;
  }
  return `${result} Only`;
}

function indianNumberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigit = (n: number): string => {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]}-${ones[o]}`;
  };

  const threeDigit = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(`${ones[h]} Hundred`);
    if (rest > 0) parts.push(twoDigit(rest));
    return parts.join(' ');
  };

  // Indian number system: ones (000-999), thousands, lakhs, crores
  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = num % 1000;

  const parts: string[] = [];
  if (crores > 0) parts.push(`${indianNumberToWords(crores)} Crore`);
  if (lakhs > 0) parts.push(`${twoDigit(lakhs)} Lakh`);
  if (thousands > 0) parts.push(`${twoDigit(thousands)} Thousand`);
  if (hundreds > 0) parts.push(threeDigit(hundreds));

  return parts.join(' ');
}

/**
 * Generate a sequential invoice number.
 * Format: PREFIX-YYYY-NNNN (e.g. SUS-INV-2026-0042)
 * For production use, fetch the latest sequence from the database instead.
 */
export function generateInvoiceNumber(
  prefix: string,
  sequence: number,
  date: Date = new Date(),
): string {
  const year = date.getFullYear();
  const padded = sequence.toString().padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}
