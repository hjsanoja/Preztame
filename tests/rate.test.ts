import { describe, expect, it } from 'vitest';
import { formatRate, roundUpRate } from '../src/lib/rate';
import { localDay, nextMonthKey } from '../src/lib/format';

describe('rate and dates', () => {
  it('formats rates with two decimals and rounds up to a whole number', () => {
    expect(formatRate(36.4712)).toBe('36.47');
    expect(roundUpRate(36.4712)).toBe(37);
    expect(roundUpRate(37)).toBe(37);
    expect(roundUpRate(37.001)).toBe(37);
  });
  it('uses the local day and the following month', () => {
    expect(localDay(new Date(2026, 9, 10, 23, 30))).toBe('2026-10-10');
    expect(nextMonthKey(new Date(2026, 9, 31))).toBe('2026-11');
    expect(nextMonthKey(new Date(2026, 11, 15))).toBe('2027-01');
  });
});
