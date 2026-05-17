'use client';

import { useMemo, useState } from 'react';
import type { Batch } from '@/lib/content-schema';
import { formatBatchDate, formatInr } from '@/lib/format';
import { EnquiryCTA } from './EnquiryCTA';

export interface BatchRow {
  batch: Batch;
  styleSlug: string;
  styleName: string;
  branchSlug: string;
  branchName: string;
  neighborhood: string;
}

interface Props {
  rows: BatchRow[];
  styles: { slug: string; name: string }[];
  studios: { slug: string; name: string }[];
  whatsappNumber: string;
  instagramHandle: string;
}

const LEVELS = ['Foundation', 'Intermediate', 'Advanced'];

export function BatchesBrowser({ rows, styles, studios, whatsappNumber, instagramHandle }: Props) {
  const [style, setStyle] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    let r = rows.filter(
      (x) =>
        (!style || x.styleSlug === style) &&
        (!branch || x.branchSlug === branch) &&
        (!level || x.batch.level.toLowerCase() === level.toLowerCase()),
    );
    r = r.slice().sort((a, b) =>
      sort === 'asc'
        ? a.batch.startDate.localeCompare(b.batch.startDate)
        : b.batch.startDate.localeCompare(a.batch.startDate),
    );
    return r;
  }, [rows, style, branch, level, sort]);

  return (
    <>
      <section className="container-x">
        <FilterRow>
          <Pill label="All styles" active={!style} onClick={() => setStyle(null)} />
          {styles.map((s) => (
            <Pill key={s.slug} label={s.name} active={style === s.slug} onClick={() => setStyle(s.slug)} />
          ))}
        </FilterRow>
        {studios.length > 1 ? (
          <FilterRow className="mt-3">
            <Pill label="All studios" active={!branch} onClick={() => setBranch(null)} />
            {studios.map((s) => (
              <Pill key={s.slug} label={s.name} active={branch === s.slug} onClick={() => setBranch(s.slug)} />
            ))}
          </FilterRow>
        ) : null}
        <FilterRow className="mt-3">
          <Pill label="All levels" active={!level} onClick={() => setLevel(null)} />
          {LEVELS.map((l) => (
            <Pill key={l} label={l} active={level === l} onClick={() => setLevel(l)} />
          ))}
          <span className="mx-1 w-px self-stretch bg-cream/10" />
          <Pill
            label={sort === 'asc' ? 'Soonest first' : 'Latest first'}
            active={false}
            onClick={() => setSort((s) => (s === 'asc' ? 'desc' : 'asc'))}
          />
        </FilterRow>
      </section>

      <section className="container-x py-12">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-8">
            <p className="text-cream/80">
              No batches match these filters yet. Chat with us about future batches in this combination.
            </p>
            <div className="mt-4">
              <EnquiryCTA
                whatsappNumber={whatsappNumber}
                instagramHandle={instagramHandle}
                ctx={{ source: 'primary' }}
                variant="primary"
                label="Chat on WhatsApp"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(({ batch: b, styleName, styleSlug, branchName, branchSlug, neighborhood }) => (
              <div
                key={b.id}
                className="grid gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 lg:grid-cols-12 lg:items-center"
              >
                <div className="lg:col-span-3">
                  <p className="display text-xl font-bold">{styleName}</p>
                  <p className="text-cream/60 text-sm">{b.level}</p>
                </div>
                <div className="lg:col-span-3">
                  <p className="text-cream">{branchName}</p>
                  <p className="text-cream/60 text-sm">{neighborhood}</p>
                </div>
                <div className="lg:col-span-3">
                  <p className="text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                  <p className="text-cream/60 text-sm">starts {formatBatchDate(b.startDate)}</p>
                </div>
                <div className="lg:col-span-1">
                  <p className="text-cream font-semibold">{formatInr(b.priceInr)}</p>
                  {typeof b.seatsLeft === 'number' ? (
                    <p className="text-cream/60 text-xs">{b.seatsLeft} seats</p>
                  ) : null}
                </div>
                <div className="lg:col-span-2 flex flex-wrap gap-2 justify-start lg:justify-end">
                  {b.status === 'Filling Fast' ? (
                    <span className="pill bg-gold-500/15 text-gold-400">Filling fast</span>
                  ) : null}
                  <EnquiryCTA
                    whatsappNumber={whatsappNumber}
                    ctx={{
                      source: 'batch_row',
                      style: { slug: styleSlug, name: styleName },
                      branch: { slug: branchSlug, name: branchName },
                      batch: b,
                    }}
                    variant="batch-row"
                    label="Enquire"
                  />
                  {b.razorpayLink ? (
                    <a
                      className="btn-ghost text-xs"
                      href={b.razorpayLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pre-register
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FilterRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>{children}</div>;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ${active ? 'bg-ember-500 text-ink-950' : 'bg-cream/5 text-cream/70 hover:bg-cream/10'}`}
    >
      {label}
    </button>
  );
}
