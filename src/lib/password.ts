/**
 * welinc-auth's password rule (`OtpResetPasswordDto`: 8 or more characters, an uppercase and a
 * lowercase letter, a number, and a character that is neither), as the four checks the strength
 * box on board `R32Forgot3` lists. welinc-auth stays the judge; these only guide the typing.
 */
export type PasswordCheck = { label: string; met: boolean; fix: string };

export function passwordChecks(password: string): PasswordCheck[] {
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  return [
    { label: '8 or more characters', met: password.length >= 8, fix: 'Use at least 8 characters.' },
    {
      label: 'Upper and lowercase',
      met: upper && lower,
      fix: upper ? 'Add at least one lowercase letter.' : 'Add at least one uppercase letter.',
    },
    { label: 'A number', met: /\d/.test(password), fix: 'Add at least one number.' },
    { label: 'A symbol, like ! or #', met: /[^A-Za-z0-9]/.test(password), fix: 'Add at least one special character.' },
  ];
}

/** The word beside "Password strength": how many of the four checks pass. */
export function passwordStrength(password: string): string {
  if (!password) return 'Not set yet';
  const met = passwordChecks(password).filter((check) => check.met).length;
  return ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][met];
}
