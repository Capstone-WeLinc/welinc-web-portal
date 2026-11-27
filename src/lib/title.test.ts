import { describe, expect, it } from 'vitest';
import { pageTitle, SUITE_MANAGEMENT } from './title';

// covers: suite spec 0019 AC-28 (tab titles)
describe('pageTitle', () => {
  it('puts the most specific part first and WeLinc last', () => {
    expect(pageTitle('Sign in')).toBe('Sign in');
    expect(pageTitle('People', SUITE_MANAGEMENT)).toBe('People · Suite management');
    expect(pageTitle('Maria Santos', 'People')).toBe('Maria Santos · People');
  });

  it('leaves out empty parts', () => {
    expect(pageTitle('  ', 'People')).toBe('People');
    expect(pageTitle(null)).toBe('WeLinc');
  });
});
