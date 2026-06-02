# susstudios Invoice Template

A reusable React PDF invoice template. Drop the files into your project, pass in data, get a polished PDF back.

## What's inside

```
src/
├── types/invoice.ts                          # TypeScript types — InvoiceData, etc.
├── lib/
│   ├── invoice-utils.ts                      # Pure helpers — formatters, totals, words
│   ├── invoice-pdf.tsx                       # generateInvoiceBlob, downloadInvoice, etc.
│   └── sample-invoices.ts                    # Example data for testing
└── components/invoice/
    └── InvoiceDocument.tsx                   # The actual PDF template (React component)
```

## Setup

```bash
npm install @react-pdf/renderer
```

Drop the entire `src/` contents into your project under your own structure (typically into your existing `src/`).

## Quick start

```tsx
import { downloadInvoice } from './lib/invoice-pdf';
import { sampleLeaseInvoice } from './lib/sample-invoices';

function InvoiceButton() {
  return (
    <button onClick={() => downloadInvoice(sampleLeaseInvoice)}>
      Download Invoice
    </button>
  );
}
```

## Real-world usage in your leasing app

```tsx
import { generateInvoiceBlob, uploadInvoiceToStorage } from './lib/invoice-pdf';
import { supabase } from './lib/supabase';
import type { InvoiceData } from './types/invoice';

async function issueMonthlyInvoice(contractId: string) {
  // 1. Fetch contract + corporate + vehicle data from Supabase
  const { data: contract } = await supabase
    .from('contracts')
    .select('*, corporate:corporates(*), vehicle:vehicles(*)')
    .eq('id', contractId)
    .single();

  // 2. Build invoice data
  const invoice: InvoiceData = {
    invoiceNumber: await nextInvoiceNumber(),  // your sequence function
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    contractRef: contract.contract_number,
    status: 'issued',
    from: {
      name: 'susstudios',
      taxId: companySettings.gstin,
      addressLines: companySettings.address.split('\n'),
      email: 'billing@susstudios.com',
    },
    to: {
      name: contract.corporate.name,
      taxId: contract.corporate.gstin,
      addressLines: contract.corporate.billing_address.split('\n'),
      email: contract.corporate.billing_email,
    },
    items: [
      {
        description: `Monthly Lease Rental — ${contract.vehicle.make} ${contract.vehicle.model}`,
        subDescription: `Reg. ${contract.vehicle.registration_number} · ${formatMonth(new Date())}`,
        quantity: 1,
        unit: 'month',
        rate: contract.monthly_rental,
      },
    ],
    tax: {
      mode: 'exclusive',
      label: 'GST',
      rate: 18,
      split: contract.corporate.state === companySettings.state, // intra-state split
    },
    bankDetails: companySettings.bankDetails,
  };

  // 3. Generate + upload PDF
  const path = await uploadInvoiceToStorage(supabase, invoice);

  // 4. Save invoice metadata to DB
  await supabase.from('invoices').insert({
    invoice_number: invoice.invoiceNumber,
    contract_id: contractId,
    corporate_id: contract.corporate.id,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    subtotal: /* computed */,
    tax_amount: /* computed */,
    total: /* computed */,
    pdf_path: path,
    status: 'issued',
  });
}
```

## Customizing

### Change the brand
Edit `COLORS` and `brandName/brandTagline` in `InvoiceDocument.tsx`.

### Change the layout
The styles object is at the top of `InvoiceDocument.tsx`. All spacing, sizes, and colors live there.

### Different tax modes
- `{ mode: 'none' }` → no tax line shown
- `{ mode: 'exclusive', label: 'GST', rate: 18 }` → 18% added on top
- `{ mode: 'exclusive', label: 'GST', rate: 18, split: true }` → CGST 9% + SGST 9% (intra-state)
- `{ mode: 'inclusive', label: 'GST', rate: 18 }` → tax shown for info, already in subtotal

### Different currency
```ts
{ currency: 'USD', locale: 'en-US', tax: { mode: 'exclusive', label: 'VAT', rate: 10 } }
```
Note: amount-in-words only renders for INR. Extend `amountInWordsINR` in `invoice-utils.ts` if you need another locale.

## Testing checklist

When you wire this up, verify:

- [ ] Rupee symbol (₹) renders correctly — if you see boxes, the font registration failed
- [ ] Long descriptions wrap properly within the table cell
- [ ] Many line items (10+) trigger the second page with a fixed footer
- [ ] Amount-in-words is correct for amounts like ₹1,23,456.78
- [ ] CGST/SGST split appears only when `split: true`
- [ ] Status badge color matches status (paid=green, overdue=red, etc.)
- [ ] PDF metadata (title, author) shows correctly when opened

## Production notes

1. **Invoice numbers** — `generateInvoiceNumber()` in `invoice-utils.ts` is a starter. For production, fetch the last number from your DB inside a transaction to prevent duplicates.
2. **Storage RLS** — the `invoices` bucket needs RLS policies so corporate users can only read their own invoices.
3. **PDF caching** — once generated, store the PDF in Storage and reference its path. Don't regenerate on every download.
4. **Email delivery** — pass the blob to your email service (Resend supports PDF attachments natively).
5. **GST compliance** — verify with your CA that the layout meets all Indian GST invoice requirements (HSN/SAC codes if applicable, place of supply, reverse charge flag, etc.). The template covers the core fields; sector-specific fields may need adding.
