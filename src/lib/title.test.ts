import { describe, expect, it } from 'vitest';
import { pageTitle, SUITE_MANAGEMENT } from './title';

// covers: suite spec 0019 AC-28 (tab titles)
describe('pageTitle', () => {
  it('puts the most specific part first and WeLinc last', () => {
    expect(pageTitle('Sign in')).toBe('Sign in · WeLinc');
    expect(pageTitle('People', SUITE_MANAGEMENT)).toBe('People · Suite management · WeLinc');
    expect(pageTitle('Maria Santos', 'People')).toBe('Maria Santos · People · WeLinc');
  });

  it('leaves out empty parts', () => {
    expect(pageTitle('  ', 'People')).toBe('People · WeLinc');
    expect(pageTitle(null)).toBe('WeLinc');
  });
});
