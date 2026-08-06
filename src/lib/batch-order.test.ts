import { describe, expect, it } from 'vitest';
import { compareByLevel, levelRank } from './batch-order';

type Row = { level: 'Foundation' | 'Intermediate' | 'Advanced'; startDate: string };

const b = (level: Row['level'], startDate: string): Row => ({ level, startDate });

describe('levelRank', () => {
  it('orders Foundation before Intermediate before Advanced', () => {
    expect(levelRank('Foundation')).toBeLessThan(levelRank('Intermediate'));
    expect(levelRank('Intermediate')).toBeLessThan(levelRank('Advanced'));
  });

  it('sinks an unknown level to the end rather than the front', () => {
    // A future level name added in the admin must never outrank Foundation
    // on a page built for first-timers.
    expect(levelRank('Masterclass' as never)).toBeGreaterThan(levelRank('Advanced'));
  });
});

describe('compareByLevel', () => {
  it('puts every Foundation batch ahead of every other level', () => {
    const rows = [b('Advanced', '2026-08-10'), b('Foundation', '2026-12-01'), b('Intermediate', '2026-08-08')];
    const sorted = [...rows].sort(compareByLevel);
    expect(sorted.map((r) => r.level)).toEqual(['Foundation', 'Intermediate', 'Advanced']);
  });

  it('breaks ties within a level by soonest start date', () => {
    const rows = [b('Foundation', '2026-09-05'), b('Foundation', '2026-08-29'), b('Foundation', '2026-12-01')];
    const sorted = [...rows].sort(compareByLevel);
    expect(sorted.map((r) => r.startDate)).toEqual(['2026-08-29', '2026-09-05', '2026-12-01']);
  });

  it('is stable across a realistic mixed board', () => {
    const rows = [
      b('Intermediate', '2026-08-08'),
      b('Foundation', '2026-08-29'),
      b('Advanced', '2026-08-15'),
      b('Foundation', '2026-09-05'),
    ];
    const sorted = [...rows].sort(compareByLevel);
    expect(sorted.map((r) => `${r.level}:${r.startDate}`)).toEqual([
      'Foundation:2026-08-29',
      'Foundation:2026-09-05',
      'Intermediate:2026-08-08',
      'Advanced:2026-08-15',
    ]);
  });
});
