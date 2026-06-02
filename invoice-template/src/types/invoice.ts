/**
 * Invoice type definitions — susstudios
 * Single source of truth. Any code that produces/consumes an invoice uses these types.
 */

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface Party {
  /** Legal name of the entity */
  name: string;
  /** Optional business identifier — GSTIN in India, EIN/VAT elsewhere */
  taxId?: string;
  /** Multi-line address; one entry per line */
  addressLines: string[];
  email?: string;
  phone?: string;
}

export interface InvoiceLineItem {
  /** Short identifier shown in the # column. Auto-generated if omitted. */
  id?: string;
  /** Primary line — e.g. "Monthly Lease Rental — Honda City MH12AB1234" */
  description: string;
  /** Optional secondary line shown smaller below description */
  subDescription?: string;
  /** Quantity (defaults to 1) */
  quantity?: number;
  /** Unit — "month", "service", "hour" — shown next to quantity */
  unit?: string;
  /** Rate per unit, in rupees (use decimal, e.g. 25000 for ₹25,000) */
  rate: number;
}

export interface InvoiceAdjustment {
  /** Label like "Late fee", "Discount", "Service credit" */
  label: string;
  /** Positive = added, negative = subtracted */
  amount: number;
}

export interface InvoiceBankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string;
  upiId?: string;
}

export interface InvoiceData {
  /** Invoice number — e.g. "SUS-INV-2026-0042". Required. */
  invoiceNumber: string;
  /** Date of issue (ISO string or Date) */
  issueDate: string | Date;
  /** Payment due date */
  dueDate: string | Date;
  /** Optional purchase-order reference from the client */
  poNumber?: string;
  /** Optional engagement / contract reference */
  contractRef?: string;

  /** Issuer (you / susstudios) */
  from: Party;
  /** Recipient (the client) */
  to: Party;

  /** Line items */
  items: InvoiceLineItem[];

  /** Optional adjustments after subtotal (discounts, late fees, credits) */
  adjustments?: InvoiceAdjustment[];

  /**
   * Tax configuration.
   * `mode: 'exclusive'` — tax added on top of subtotal.
   * `mode: 'inclusive'` — subtotal already includes tax (tax shown for info only).
   * `mode: 'none'` — no tax line shown (e.g. "All prices inclusive of applicable taxes").
   */
  tax?:
    | { mode: 'none' }
    | {
        mode: 'exclusive' | 'inclusive';
        /** Tax label — "GST", "IGST", "CGST + SGST", "VAT" */
        label: string;
        /** Percentage as number — 18 means 18% */
        rate: number;
        /** Optional split for intra-state GST (CGST + SGST each at rate/2) */
        split?: boolean;
      };

  /** Free-form notes shown at bottom (payment instructions, thank-you, etc.) */
  notes?: string[];
  /** Terms & conditions */
  terms?: string[];

  /** Bank / UPI details for payment */
  bankDetails?: InvoiceBankDetails;

  /** Status badge shown top-right of the invoice */
  status?: InvoiceStatus;

  /** Currency — ISO 4217. Defaults to 'INR'. */
  currency?: string;
  /** Locale for number formatting. Defaults to 'en-IN'. */
  locale?: string;
}

/** Computed totals returned by computeInvoiceTotals() */
export interface InvoiceTotals {
  subtotal: number;
  adjustmentsTotal: number;
  taxableValue: number;
  taxAmount: number;
  taxBreakdown?: { label: string; amount: number }[];
  total: number;
}
