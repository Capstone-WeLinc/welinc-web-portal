import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordStrength } from './password';

const met = (password: string) => passwordChecks(password).map((check) => check.met);

describe('passwordChecks', () => {
  it('matches welinc-auth rule, one check at a time', () => {
    expect(met('Marikina2026!')).toEqual([true, true, true, true]);
    expect(met('short1!')).toEqual([false, false, true, true]);
    expect(met('alllower1!')).toEqual([true, false, true, true]);
    expect(met('NoDigits!!')).toEqual([true, true, false, true]);
    expect(met('NoSymbol12')).toEqual([true, true, true, false]);
  });

  it('names the missing letter case in its fix', () => {
    expect(passwordChecks('alllower1!')[1].fix).toBe('Add at least one uppercase letter.');
    expect(passwordChecks('ALLUPPER1!')[1].fix).toBe('Add at least one lowercase letter.');
  });
});

describe('passwordStrength', () => {
  it('grows with the checks met', () => {
    expect(passwordStrength('')).toBe('Not set yet');
    expect(passwordStrength('abc')).toBe('Weak');
    expect(passwordStrength('abcdefgh1')).toBe('Fair');
    expect(passwordStrength('Abcdefgh1')).toBe('Good');
    expect(passwordStrength('Abcdefgh1!')).toBe('Strong');
  });
});
