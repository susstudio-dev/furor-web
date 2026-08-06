'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Batch } from '@/lib/content-schema';
import { formatBatchDate, formatInr } from '@/lib/format';
import { compareByLevel } from '@/lib/batch-order';
import { EnquiryCTA } from './EnquiryCTA';
import { BatchActions } from './BatchActions';

export interface BatchRow {
  batch: Batch;
  styleSlugs: string[];
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

// ── derived attributes ──────────────────────────────────────────────────────

function timeOfDay(time: string): 'Morning' | 'Afternoon' | 'Evening' {
  const m = time.trim().match(/^(\d{1,2}):(\d{2}).*?(AM|PM)\s*$/i);
  if (!m) return 'Evening';
  let h = parseInt(m[1], 10);
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const WEEKEND = new Set(['Sat', 'Sun']);
function dayKinds(days: string[]): string[] {
  const out: string[] = [];
  if (days.some((d) => WEEKEND.has(d))) out.push('Weekend');
  if (days.some((d) => !WEEKEND.has(d))) out.push('Weekday');
  return out;
}

function startBucket(startDate: string, now: Date): string {
  const d = new Date(startDate + 'T00:00:00');
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth())
    return 'This month';
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  if (days <= 30) return 'Next 30 days';
  return 'Later';
}

type FacetKey = 'style' | 'level' | 'branch' | 'tod' | 'days' | 'starting' | 'price' | 'status';

interface Enriched {
  row: BatchRow;
  styleSlugs: string[];
  styleName: string;
  level: string;
  branch: string;
  branchName: string;
  tod: string;
  days: string[];
  starting: string;
  price: string;
  priceN: number;
  status: string;
}

const STARTING_ORDER = ['This month', 'Next 30 days', 'Later'];
const TOD_ORDER = ['Morning', 'Afternoon', 'Evening'];
const LEVEL_ORDER = ['Foundation', 'Intermediate', 'Advanced'];

export function BatchesBrowser({ rows, styles, studios, whatsappNumber, instagramHandle }: Props) {
  const [now] = useState(() => new Date());
  const multiBranch = studios.length > 1;

  const enriched: Enriched[] = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        styleSlugs: r.styleSlugs,
        styleName: r.styleName,
        level: r.batch.level,
        branch: r.branchSlug,
        branchName: r.branchName,
        tod: timeOfDay(r.batch.time),
        days: dayKinds(r.batch.daysOfWeek),
        starting: startBucket(r.batch.startDate, now),
        price: String(r.batch.priceInr),
        priceN: r.batch.priceInr,
        status: r.batch.status,
      })),
    [rows, now],
  );

  // selected values per facet (multi-select; OR within a facet, AND across)
  const [sel, setSel] = useState<Record<FacetKey, Set<string>>>({
    style: new Set(),
    level: new Set(),
    branch: new Set(),
    tod: new Set(),
    days: new Set(),
    starting: new Set(),
    price: new Set(),
    status: new Set(),
  });
  // Level-first is the default on purpose: the primary visitor has never
  // danced, and a date-sorted list can put an Advanced batch at the top.
  // Price sorting was dropped — with a handful of batches at two price
  // points it was two extra decisions that answered nothing; the price
  // FILTER below still exists.
  const [sort, setSort] = useState<'level' | 'soon' | 'late'>('level');
  // Detailed facets are collapsed by default on mobile so the batch list isn't
  // pushed off-screen by a wall of pills. Always expanded on lg+ (room for it).
  const [showFilters, setShowFilters] = useState(false);

  // ── URL sync (works in static export + server) ──
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSel((prev) => {
      const next = { ...prev };
      (Object.keys(next) as FacetKey[]).forEach((k) => {
        const v = q.get(k);
        next[k] = new Set(v ? v.split(',').filter(Boolean) : []);
      });
      return next;
    });
    const s = q.get('sort');
    // Old bookmarked ?sort=priceLow/priceHigh URLs fall back to the default.
    if (s === 'level' || s === 'soon' || s === 'late') setSort(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    (Object.keys(sel) as FacetKey[]).forEach((k) => {
      if (sel[k].size) q.set(k, [...sel[k]].join(','));
    });
    if (sort !== 'level') q.set('sort', sort);
    const qs = q.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [sel, sort]);

  const facetValues = (k: FacetKey, e: Enriched): string[] => {
    if (k === 'days') return e.days;
    if (k === 'style') return e.styleSlugs;
    const v = (e as unknown as Record<string, string>)[
      k === 'branch' ? 'branch' : k
    ];
    return [v];
  };

  const passesExcept = (e: Enriched, except: FacetKey | null): boolean => {
    for (const k of Object.keys(sel) as FacetKey[]) {
      if (k === except) continue;
      const chosen = sel[k];
      if (!chosen.size) continue;
      const vals = facetValues(k, e);
      if (!vals.some((v) => chosen.has(v))) return false;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const out = enriched.filter((e) => passesExcept(e, null));
    out.sort((a, b) => {
      if (sort === 'level') return compareByLevel(a.row.batch, b.row.batch);
      const cmp = a.row.batch.startDate.localeCompare(b.row.batch.startDate);
      return sort === 'late' ? -cmp : cmp;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, sel, sort]);

  // count for an option = rows passing every OTHER facet, that also have it
  const countFor = (k: FacetKey, value: string): number => {
    let n = 0;
    for (const e of enriched) {
      if (!passesExcept(e, k)) continue;
      if (facetValues(k, e).includes(value)) n++;
    }
    return n;
  };

  function toggle(k: FacetKey, v: string) {
    setSel((prev) => {
      const nextSet = new Set(prev[k]);
      if (nextSet.has(v)) nextSet.delete(v);
      else nextSet.add(v);
      return { ...prev, [k]: nextSet };
    });
  }
  function clearAll() {
    setSel({
      style: new Set(), level: new Set(), branch: new Set(), tod: new Set(),
      days: new Set(), starting: new Set(), price: new Set(), status: new Set(),
    });
  }
  function applyPreset(p: Partial<Record<FacetKey, string[]>>) {
    setSel({
      style: new Set(p.style), level: new Set(p.level), branch: new Set(p.branch),
      tod: new Set(p.tod), days: new Set(p.days), starting: new Set(p.starting),
      price: new Set(p.price), status: new Set(p.status),
    });
  }

  const activeChips: { k: FacetKey; v: string; label: string }[] = [];
  (Object.keys(sel) as FacetKey[]).forEach((k) =>
    sel[k].forEach((v) => activeChips.push({ k, v, label: labelFor(k, v, styles, studios) })),
  );
  const anyActive = activeChips.length > 0;

  // facet definitions (only render options that exist in the data)
  const present = (vals: string[], pick: (e: Enriched) => string | string[]) => {
    const seen = new Set<string>();
    enriched.forEach((e) => {
      const x = pick(e);
      (Array.isArray(x) ? x : [x]).forEach((v) => seen.add(v));
    });
    return vals.filter((v) => seen.has(v));
  };

  const priceVals = [...new Set(enriched.map((e) => e.price))].sort(
    (a, b) => Number(a) - Number(b),
  );

  const groups: { key: FacetKey; label: string; options: { v: string; label: string }[] }[] = [
    { key: 'style', label: 'Dance', options: styles.filter((s) => enriched.some((e) => e.styleSlugs.includes(s.slug))).map((s) => ({ v: s.slug, label: s.name })) },
    { key: 'level', label: 'Level', options: present(LEVEL_ORDER, (e) => e.level).map((v) => ({ v, label: v })) },
    ...(multiBranch ? [{ key: 'branch' as FacetKey, label: 'Studio', options: studios.filter((s) => enriched.some((e) => e.branch === s.slug)).map((s) => ({ v: s.slug, label: s.name })) }] : []),
    { key: 'tod', label: 'Time of day', options: present(TOD_ORDER, (e) => e.tod).map((v) => ({ v, label: v })) },
    { key: 'days', label: 'Days', options: present(['Weekend', 'Weekday'], (e) => e.days).map((v) => ({ v, label: v === 'Weekend' ? 'Weekends' : 'Weekdays' })) },
    { key: 'starting', label: 'Starting', options: present(STARTING_ORDER, (e) => e.starting).map((v) => ({ v, label: v })) },
    { key: 'price', label: 'Price', options: priceVals.map((v) => ({ v, label: formatInr(Number(v)) })) },
    { key: 'status', label: 'Availability', options: present(['Filling Fast', 'Open'], (e) => e.status).map((v) => ({ v, label: v === 'Filling Fast' ? 'Filling fast' : 'Open' })) },
  ];

  const presets: { label: string; p: Partial<Record<FacetKey, string[]>> }[] = [
    { label: '🔰 Beginner-friendly', p: { level: ['Foundation'] } },
    { label: '🗓️ Weekend classes', p: { days: ['Weekend'] } },
    { label: '🌙 Evening classes', p: { tod: ['Evening'] } },
    { label: '⚡ Starting soon', p: { starting: ['This month', 'Next 30 days'] } },
    { label: '🔥 Filling fast', p: { status: ['Filling Fast'] } },
  ];

  return (
    <>
      <section className="container-x">
        <div className="sticky top-16 z-20 -mx-5 sm:-mx-6 lg:-mx-8 px-5 sm:px-6 lg:px-8 py-5 bg-ink-950/85 backdrop-blur border-y border-cream/10">
          {/* Quick picks — wrap so all presets stay visible (no off-screen scroll) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full sm:w-auto text-[11px] uppercase tracking-widest text-cream/45 sm:mr-1">
              Quick picks
            </span>
            {presets.map((pre) => (
              <button
                key={pre.label}
                onClick={() => applyPreset(pre.p)}
                className="pill whitespace-nowrap bg-ember-500/12 text-ember-400 hover:bg-ember-500/22 transition"
              >
                {pre.label}
              </button>
            ))}
          </div>

          {/* Filters toggle — mobile only. Detailed facets live behind this so
              the batch list stays reachable without a long scroll. */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="lg:hidden mt-3 flex w-full items-center justify-between rounded-xl border border-cream/10 bg-cream/5 px-4 py-2.5 text-sm text-cream/85 hover:bg-cream/10 transition"
          >
            <span className="flex items-center gap-2">
              {showFilters ? 'Hide filters' : 'All filters'}
              {activeChips.length ? (
                <span className="rounded-full bg-ember-500 px-2 py-0.5 text-xs font-semibold text-cream">
                  {activeChips.length}
                </span>
              ) : null}
            </span>
            <span aria-hidden className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {/* Facet groups — collapsed on mobile (toggle above), always shown lg+ */}
          <div
            className={`mt-4 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 max-h-[55vh] overflow-y-auto lg:mt-4 lg:max-h-none lg:overflow-visible ${
              showFilters ? 'grid' : 'hidden'
            } lg:grid`}
          >
            {groups.map((g) =>
              g.options.length === 0 ? null : (
                <div key={g.key}>
                  <p className="text-[11px] uppercase tracking-widest text-cream/45 mb-2">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => {
                      const active = sel[g.key].has(o.v);
                      const c = countFor(g.key, o.v);
                      const disabled = c === 0 && !active;
                      return (
                        <button
                          key={o.v}
                          onClick={() => !disabled && toggle(g.key, o.v)}
                          disabled={disabled}
                          className={`pill transition ${
                            active
                              ? 'bg-ember-500 text-cream'
                              : disabled
                              ? 'bg-cream/5 text-cream/25 cursor-not-allowed'
                              : 'bg-cream/5 text-cream/75 hover:bg-cream/10'
                          }`}
                        >
                          {o.label}
                          <span
                            suppressHydrationWarning
                            className={active ? 'text-cream/70' : 'text-cream/35'}
                          >
                            {c}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Result bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-cream/80 text-sm">
            <span className="font-semibold text-cream">{filtered.length}</span> of {enriched.length} batches
          </p>
          {anyActive ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeChips.map((ch) => (
                <button
                  key={ch.k + ch.v}
                  onClick={() => toggle(ch.k, ch.v)}
                  className="pill bg-cream/10 text-cream/80 hover:bg-cream/15"
                  title="Remove filter"
                >
                  {ch.label} <span aria-hidden>✕</span>
                </button>
              ))}
              <button onClick={clearAll} className="text-xs text-ember-400 hover:text-ember-300 ml-1">
                Clear all
              </button>
            </div>
          ) : null}
          <label className="ml-auto text-sm text-cream/60 flex items-center gap-2">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-full bg-cream/5 border border-cream/15 px-3 py-1.5 text-cream/85 text-sm outline-none focus:border-ember-500"
            >
              <option value="level">Beginner → advanced</option>
              <option value="soon">Soonest first</option>
              <option value="late">Latest first</option>
            </select>
          </label>
        </div>
      </section>

      <section className="container-x py-10">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-8">
            <p className="text-cream/80">
              No batches match these filters yet. Chat with us — we&apos;ll tell you when one opens.
            </p>
            <div className="mt-4 flex gap-3">
              <EnquiryCTA whatsappNumber={whatsappNumber} instagramHandle={instagramHandle} ctx={{ source: 'primary' }} variant="primary" label="Chat on WhatsApp" />
              <button onClick={clearAll} className="btn-secondary">Clear filters</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(({ row }) => {
              const b = row.batch;
              return (
                <div
                  key={b.id}
                  className="grid gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 lg:grid-cols-12 lg:items-center"
                >
                  <div className="lg:col-span-3">
                    <p className="display text-xl font-bold">{row.styleName}</p>
                    <p className="text-cream/60 text-sm">{b.level}</p>
                  </div>
                  <div className="lg:col-span-3">
                    <p className="text-cream">{row.branchName}</p>
                    <p className="text-cream/60 text-sm">{row.neighborhood}</p>
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
                  <div className="lg:col-span-2 flex flex-wrap gap-2 justify-start lg:justify-end items-center">
                    {b.status === 'Filling Fast' ? (
                      <span className="pill bg-gold-500/15 text-gold-400">Filling fast</span>
                    ) : null}
                    <BatchActions
                      batch={b}
                      style={{ slug: row.styleSlugs[0], name: row.styleName }}
                      branch={{ slug: row.branchSlug, name: row.branchName }}
                      whatsappNumber={whatsappNumber}
                      primaryLabelWhenNoLink="Enquire"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function labelFor(
  k: FacetKey,
  v: string,
  styles: { slug: string; name: string }[],
  studios: { slug: string; name: string }[],
): string {
  if (k === 'style') return styles.find((s) => s.slug === v)?.name ?? v;
  if (k === 'branch') return studios.find((s) => s.slug === v)?.name ?? v;
  if (k === 'price') return formatInr(Number(v));
  if (k === 'days') return v === 'Weekend' ? 'Weekends' : 'Weekdays';
  if (k === 'status') return v === 'Filling Fast' ? 'Filling fast' : v;
  return v;
}
