import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatNumber, formatInteger } from '@/lib/format';

describe('formatCurrency', () => {
  it('formats amount with EUR currency for French locale', () => {
    const result = formatCurrency(19.99, 'EUR', 'fr');
    expect(result).toContain('19');
    expect(result).toMatch(/€|EUR/);
  });

  it('formats amount with USD currency for US locale', () => {
    const result = formatCurrency(29.99, 'USD', 'en');
    expect(result).toContain('29');
    expect(result).toMatch(/\$|USD/);
  });

  it('handles whole numbers', () => {
    const result = formatCurrency(1000, 'EUR', 'fr');
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('handles zero', () => {
    const result = formatCurrency(0, 'EUR', 'fr');
    expect(result).toBeDefined();
  });

  it('handles large numbers', () => {
    const result = formatCurrency(999999.99, 'EUR', 'fr');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const date = new Date('2024-06-15');
    const result = formatDate(date, 'fr');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a string date', () => {
    const result = formatDate('2024-12-25', 'fr');
    expect(result).toBeDefined();
  });

  it('formats a timestamp', () => {
    const timestamp = new Date('2024-03-01').getTime();
    const result = formatDate(timestamp, 'fr');
    expect(result).toBeDefined();
  });

  it('respects different locales', () => {
    const date = new Date('2024-06-15');
    const frResult = formatDate(date, 'fr');
    const enResult = formatDate(date, 'en');
    expect(frResult).not.toBe(enResult);
  });
});

describe('formatNumber', () => {
  it('formats integers', () => {
    const result = formatNumber(1234, 'fr');
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
    expect(result).toContain('4');
  });

  it('formats decimals', () => {
    const result = formatNumber(1234.56, 'fr');
    expect(result).toContain('56');
  });

  it('handles zero', () => {
    const result = formatNumber(0, 'fr');
    expect(result).toBeDefined();
  });
});

describe('formatInteger', () => {
  it('formats whole numbers without decimals', () => {
    const result = formatInteger(1234, 'fr');
    expect(result).not.toContain('.');
    expect(result).not.toContain(',');
  });

  it('rounds decimal numbers', () => {
    const result = formatInteger(1234.99, 'fr');
    expect(result.replace(/\s/g, '')).toContain('1235');
  });
});
