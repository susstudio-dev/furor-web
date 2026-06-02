/**
 * InvoiceDocument — reusable PDF invoice template for susstudios.
 *
 * Usage:
 *   import { pdf } from '@react-pdf/renderer';
 *   import { InvoiceDocument } from './InvoiceDocument';
 *
 *   const blob = await pdf(<InvoiceDocument data={invoiceData} />).toBlob();
 *   // Then download, upload to Supabase Storage, email, etc.
 *
 * Or render inline:
 *   <PDFViewer><InvoiceDocument data={invoiceData} /></PDFViewer>
 *
 * Setup:
 *   npm install @react-pdf/renderer
 *
 * Font note: @react-pdf/renderer ships with Helvetica which DOES NOT include
 * the ₹ glyph. We register Inter (or any rupee-capable font) below.
 */

import React from 'react';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer';
import type { InvoiceData, InvoiceLineItem } from '../../types/invoice';
import {
  formatCurrency, formatDate, computeInvoiceTotals, amountInWordsINR,
} from '../../lib/invoice-utils';

// ---- Font registration ----
// @react-pdf ships Helvetica, which has NO ₹ (U+20B9) glyph. We must register a
// font that includes it AND that @react-pdf's subsetter embeds cleanly.
// Windows system fonts (Segoe UI etc.) subset badly here — the glyphs come out
// as tofu boxes in real PDF viewers. DejaVu Sans is the well-tested @react-pdf
// font, has ₹, and is bundled locally in ../fonts so there are no dead URLs or
// system-font dependencies. The family key stays "Inter" so the styles below
// don't need to change.
const FONT_DIR = nodePath.join(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  '../../../fonts',
);
Font.register({
  family: 'Inter',
  fonts: [
    { src: nodePath.join(FONT_DIR, 'DejaVuSans.ttf'), fontWeight: 400 },
    { src: nodePath.join(FONT_DIR, 'DejaVuSans.ttf'), fontWeight: 500 },
    { src: nodePath.join(FONT_DIR, 'DejaVuSans-Bold.ttf'), fontWeight: 600 },
    { src: nodePath.join(FONT_DIR, 'DejaVuSans-Bold.ttf'), fontWeight: 700 },
  ],
});

// ---- Brand palette ----
const COLORS = {
  navy: '#0B2545',
  accent: '#C9A227',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  lightBg: '#F4F6FA',
  success: '#15803D',
  successBg: '#F0FDF4',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  info: '#0284C7',
  infoBg: '#F0F9FF',
  white: '#FFFFFF',
};

// ---- Styles ----
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: COLORS.text,
    padding: 0,
    lineHeight: 1.4,
  },

  // ---- Top brand bar ----
  headerBar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 36,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  brandTagline: {
    color: COLORS.white,
    fontSize: 8,
    opacity: 0.85,
    marginTop: 2,
  },
  invoiceTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1.5,
  },
  invoiceMeta: {
    color: COLORS.white,
    fontSize: 8.5,
    opacity: 0.9,
    marginTop: 2,
    textAlign: 'right',
  },
  accentStripe: {
    height: 3,
    backgroundColor: COLORS.accent,
  },

  // ---- Body ----
  body: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 24,
  },

  // ---- Top info row: invoice meta + status ----
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaCell: {
    width: 110,
    marginRight: 16,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    fontWeight: 500,
  },
  metaValue: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: 500,
  },

  // ---- Status badge ----
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    fontSize: 8.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
  },

  // ---- Parties block ----
  partiesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 22,
  },
  partyCard: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
    borderRadius: 4,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.navy,
  },
  partyLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: 500,
  },
  partyName: {
    fontSize: 11.5,
    color: COLORS.navy,
    fontWeight: 700,
    marginBottom: 4,
  },
  partyLine: {
    fontSize: 9,
    color: COLORS.text,
    marginBottom: 1,
  },
  partyTaxId: {
    fontSize: 8.5,
    color: COLORS.muted,
    marginTop: 4,
  },

  // ---- Items table ----
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: COLORS.white,
    fontSize: 8.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightBg,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.text,
  },
  // Column widths (total = 100%)
  colNum: { width: '6%' },
  colDesc: { width: '52%', paddingRight: 8 },
  colQty: { width: '12%', textAlign: 'center' },
  colRate: { width: '14%', textAlign: 'right' },
  colAmount: { width: '16%', textAlign: 'right' },

  subDescription: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 2,
  },

  // ---- Totals block ----
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  totalsBox: {
    width: '46%',
  },
  totalsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  totalsLabel: {
    fontSize: 9,
    color: COLORS.muted,
  },
  totalsValue: {
    fontSize: 9.5,
    color: COLORS.text,
    fontWeight: 500,
  },
  totalsGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLORS.navy,
    marginTop: 2,
  },
  totalsGrandLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  totalsGrandValue: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: 700,
  },

  // ---- Amount in words ----
  amountInWords: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.lightBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  amountInWordsLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  amountInWordsText: {
    fontSize: 10,
    color: COLORS.navy,
    fontWeight: 600,
  },

  // ---- Bank details + notes section ----
  bottomRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  bottomCol: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: 8,
    color: COLORS.navy,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bankLabel: {
    width: 70,
    fontSize: 8.5,
    color: COLORS.muted,
  },
  bankValue: {
    flex: 1,
    fontSize: 8.5,
    color: COLORS.text,
    fontWeight: 500,
  },
  noteLine: {
    fontSize: 8.5,
    color: COLORS.text,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  termLine: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 2,
    lineHeight: 1.4,
  },

  // ---- Footer signature + thank you ----
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  signatureBox: {
    width: 180,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.text,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8.5,
    color: COLORS.muted,
  },

  // ---- Page footer ----
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 36,
    paddingVertical: 10,
    backgroundColor: COLORS.lightBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color: COLORS.muted,
  },
});

// ---- Status badge color mapping ----
function statusStyle(status?: string) {
  switch (status) {
    case 'paid':
      return { backgroundColor: COLORS.successBg, color: COLORS.success };
    case 'overdue':
      return { backgroundColor: COLORS.dangerBg, color: COLORS.danger };
    case 'issued':
      return { backgroundColor: COLORS.infoBg, color: COLORS.info };
    case 'draft':
      return { backgroundColor: COLORS.lightBg, color: COLORS.muted };
    case 'cancelled':
      return { backgroundColor: COLORS.lightBg, color: COLORS.muted };
    default:
      return { backgroundColor: COLORS.infoBg, color: COLORS.info };
  }
}

// ---- Component ----
export interface InvoiceDocumentProps {
  data: InvoiceData;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({ data }) => {
  const totals = computeInvoiceTotals(data);
  const locale = data.locale ?? 'en-IN';
  const currency = data.currency ?? 'INR';
  const fmt = (n: number) => formatCurrency(n, currency, locale);

  const statusBadgeStyle = statusStyle(data.status);

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={data.from.name}
      subject={`Invoice for ${data.to.name}`}
    >
      <Page size="A4" style={styles.page}>
        {/* ============ HEADER ============ */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.brandName}>{data.from.name}</Text>
            <Text style={styles.brandTagline}>
              A bespoke software consultancy delivering enterprise-grade digital products.
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{data.invoiceNumber}</Text>
          </View>
        </View>
        <View style={styles.accentStripe} />

        {/* ============ BODY ============ */}
        <View style={styles.body}>
          {/* Meta row */}
          <View style={styles.topInfoRow}>
            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Issue Date</Text>
                <Text style={styles.metaValue}>{formatDate(data.issueDate, locale)}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={styles.metaValue}>{formatDate(data.dueDate, locale)}</Text>
              </View>
              {data.poNumber && (
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>PO Number</Text>
                  <Text style={styles.metaValue}>{data.poNumber}</Text>
                </View>
              )}
              {data.contractRef && (
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>Contract Ref</Text>
                  <Text style={styles.metaValue}>{data.contractRef}</Text>
                </View>
              )}
            </View>
            {data.status && (
              <Text style={[styles.statusBadge, statusBadgeStyle]}>
                {data.status.toUpperCase()}
              </Text>
            )}
          </View>

          {/* Parties */}
          <View style={styles.partiesRow}>
            <PartyCard label="From" party={data.from} />
            <PartyCard label="Billed To" party={data.to} />
          </View>

          {/* Line items */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
              <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            </View>
            {data.items.map((item, idx) => (
              <LineItemRow
                key={item.id ?? idx}
                item={item}
                index={idx}
                fmt={fmt}
              />
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsRow}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{fmt(totals.subtotal)}</Text>
              </View>

              {(data.adjustments ?? []).map((adj, i) => (
                <View key={i} style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>{adj.label}</Text>
                  <Text
                    style={[
                      styles.totalsValue,
                      adj.amount < 0 ? { color: COLORS.success } : {},
                    ]}
                  >
                    {adj.amount < 0 ? '− ' : ''}
                    {fmt(Math.abs(adj.amount))}
                  </Text>
                </View>
              ))}

              {totals.taxBreakdown?.map((t, i) => (
                <View key={i} style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>{t.label}</Text>
                  <Text style={styles.totalsValue}>{fmt(t.amount)}</Text>
                </View>
              ))}

              <View style={styles.totalsGrandRow}>
                <Text style={styles.totalsGrandLabel}>Total Due</Text>
                <Text style={styles.totalsGrandValue}>{fmt(totals.total)}</Text>
              </View>
            </View>
          </View>

          {/* Amount in words — only for INR */}
          {currency === 'INR' && (
            <View style={styles.amountInWords}>
              <Text style={styles.amountInWordsLabel}>Amount in Words</Text>
              <Text style={styles.amountInWordsText}>
                {amountInWordsINR(totals.total)}
              </Text>
            </View>
          )}

          {/* Bank details + Notes */}
          <View style={styles.bottomRow}>
            {data.bankDetails && (
              <View style={styles.bottomCol}>
                <Text style={styles.sectionHeading}>Payment Details</Text>
                <BankRow label="Account Name" value={data.bankDetails.accountName} />
                <BankRow label="Bank" value={data.bankDetails.bankName} />
                <BankRow label="Account No." value={data.bankDetails.accountNumber} />
                <BankRow label="IFSC" value={data.bankDetails.ifsc} />
                {data.bankDetails.branch && (
                  <BankRow label="Branch" value={data.bankDetails.branch} />
                )}
                {data.bankDetails.upiId && (
                  <BankRow label="UPI ID" value={data.bankDetails.upiId} />
                )}
              </View>
            )}

            {(data.notes?.length ?? 0) > 0 && (
              <View style={styles.bottomCol}>
                <Text style={styles.sectionHeading}>Notes</Text>
                {data.notes!.map((n, i) => (
                  <Text key={i} style={styles.noteLine}>• {n}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Terms */}
          {(data.terms?.length ?? 0) > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeading}>Terms &amp; Conditions</Text>
              {data.terms!.map((t, i) => (
                <Text key={i} style={styles.termLine}>{i + 1}. {t}</Text>
              ))}
            </View>
          )}

        </View>

        {/* Page footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>
            This is a computer-generated invoice and does not require a physical signature.
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

// ---- Sub-components ----

const PartyCard: React.FC<{ label: string; party: InvoiceData['from'] }> = ({
  label, party,
}) => (
  <View style={styles.partyCard}>
    <Text style={styles.partyLabel}>{label}</Text>
    <Text style={styles.partyName}>{party.name}</Text>
    {party.addressLines.map((line, i) => (
      <Text key={i} style={styles.partyLine}>{line}</Text>
    ))}
    {(party.email || party.phone) && (
      <Text style={[styles.partyLine, { marginTop: 4 }]}>
        {[party.email, party.phone].filter(Boolean).join(' · ')}
      </Text>
    )}
    {party.taxId && (
      <Text style={styles.partyTaxId}>Tax ID: {party.taxId}</Text>
    )}
  </View>
);

const LineItemRow: React.FC<{
  item: InvoiceLineItem;
  index: number;
  fmt: (n: number) => string;
}> = ({ item, index, fmt }) => {
  const qty = item.quantity ?? 1;
  const amount = qty * item.rate;
  const rowStyle = index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow;
  return (
    <View style={rowStyle} wrap={false}>
      <Text style={[styles.tableCell, styles.colNum]}>{index + 1}</Text>
      <View style={styles.colDesc}>
        <Text style={styles.tableCell}>{item.description}</Text>
        {item.subDescription && (
          <Text style={styles.subDescription}>{item.subDescription}</Text>
        )}
      </View>
      <Text style={[styles.tableCell, styles.colQty]}>
        {qty}{item.unit ? ` ${item.unit}` : ''}
      </Text>
      <Text style={[styles.tableCell, styles.colRate]}>{fmt(item.rate)}</Text>
      <Text style={[styles.tableCell, styles.colAmount, { fontWeight: 600 }]}>
        {fmt(amount)}
      </Text>
    </View>
  );
};

const BankRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.bankRow}>
    <Text style={styles.bankLabel}>{label}</Text>
    <Text style={styles.bankValue}>{value}</Text>
  </View>
);
