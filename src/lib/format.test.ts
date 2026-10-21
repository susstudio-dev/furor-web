import { describe, expect, it } from 'vitest';
import { addDaysIso } from './format';

describe('addDaysIso', () => {
  it('adds days within a month', () => {
    expect(addDaysIso('2026-08-01', 14)).toBe('2026-08-15');
  });
  it('rolls over month and year boundaries', () => {
    expect(addDaysIso('2026-12-25', 14)).toBe('2027-01-08');
  });
  it('handles leap years', () => {
    expect(addDaysIso('2028-02-20', 14)).toBe('2028-03-05');
  });
});
