import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (classname utility)', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toContain('base');
    expect(result).toContain('active');
  });

  it('handles undefined values', () => {
    const result = cn('foo', undefined, 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).not.toContain('undefined');
  });

  it('handles empty strings', () => {
    const result = cn('', 'foo', '');
    expect(result).toContain('foo');
  });

  it('merges tailwind classes correctly', () => {
    const result = cn('px-2 py-1 bg-red', 'hover:bg-red-500', 'px-2');
    expect(result).toContain('bg-red');
  });
});
