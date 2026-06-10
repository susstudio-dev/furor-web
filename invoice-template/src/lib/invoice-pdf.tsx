/**
 * Invoice generation helpers — produce blobs, trigger downloads, upload to storage.
 * These are the functions you'll actually call from your UI.
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoiceDocument } from '../components/invoice/InvoiceDocument';
import type { InvoiceData } from '../types/invoice';

/**
 * Generate the invoice PDF as a Blob.
 * Use this when you want to upload to Supabase Storage, email, or further process.
 */
export async function generateInvoiceBlob(data: InvoiceData): Promise<Blob> {
  const doc = <InvoiceDocument data={data} />;
  return await pdf(doc).toBlob();
}

/**
 * Trigger a browser download of the invoice PDF.
 * Filename pattern: Invoice_<invoiceNumber>.pdf
 */
export async function downloadInvoice(data: InvoiceData): Promise<void> {
  const blob = await generateInvoiceBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice_${data.invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Upload the invoice PDF to Supabase Storage.
 *
 * @example
 *   import { supabase } from '@/lib/supabase';
 *   const path = await uploadInvoiceToStorage(supabase, data, 'invoices');
 *   // -> "invoices/2026/SUS-INV-2026-0042.pdf"
 */
export async function uploadInvoiceToStorage(
  supabase: { storage: { from: (b: string) => { upload: (p: string, f: Blob, o?: object) => Promise<{ data: unknown; error: { message: string } | null }> } } },
  data: InvoiceData,
  bucket = 'invoices',
): Promise<string> {
  const blob = await generateInvoiceBlob(data);
  const year = new Date(data.issueDate).getFullYear();
  const path = `${year}/${data.invoiceNumber}.pdf`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload invoice: ${error.message}`);
  }

  return path;
}

/**
 * Open the invoice PDF in a new browser tab without downloading.
 * Useful for "Preview" buttons.
 */
export async function previewInvoice(data: InvoiceData): Promise<void> {
  const blob = await generateInvoiceBlob(data);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke after a delay so the new tab has time to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
