/**
 * Render the Furor invoice — standalone, no browser, no Next.js.
 *
 *   npm install      (once, inside invoice-template/)
 *   npm run render   -> writes out/<invoiceNumber>.pdf  (download / print / email)
 *                       and  out/<invoiceNumber>.png(s) (quick view, any image app)
 *
 * Edit the data in src/lib/furor-invoice.ts, then re-run.
 */

import React from 'react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToFile } from '@react-pdf/renderer';
import * as mupdf from 'mupdf';
import { InvoiceDocument } from './src/components/invoice/InvoiceDocument';
import { furorInvoice } from './src/lib/furor-invoice';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

async function main() {
  mkdirSync(outDir, { recursive: true });

  // 1) PDF — the real invoice you send.
  const pdfPath = path.join(outDir, `${furorInvoice.invoiceNumber}.pdf`);
  await renderToFile(<InvoiceDocument data={furorInvoice} />, pdfPath);
  console.log('PDF ->', pdfPath);

  // 2) PNG preview(s) — rendered with MuPDF so you can view the invoice in any
  //    image viewer, independent of whatever PDF app is installed.
  const doc = mupdf.Document.openDocument(
    new Uint8Array(readFileSync(pdfPath)),
    'application/pdf',
  );
  const pages = doc.countPages();
  for (let i = 0; i < pages; i++) {
    const pix = doc
      .loadPage(i)
      .toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
    const suffix = pages > 1 ? `-p${i + 1}` : '';
    const pngPath = path.join(outDir, `${furorInvoice.invoiceNumber}${suffix}.png`);
    writeFileSync(pngPath, pix.asPNG());
    console.log('PNG ->', pngPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
