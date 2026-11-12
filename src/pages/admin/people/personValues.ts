export type PersonFormValues = { name: string; email: string; role: string };

/** The checks the form makes before sending; welinc-auth checks everything again. */
export function validatePerson(values: PersonFormValues): Partial<Record<keyof PersonFormValues, string>> {
  const errors: Partial<Record<keyof PersonFormValues, string>> = {};
  if (!values.name.trim()) errors.name = 'Enter a name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter an email like name@example.com.';
  if (!values.role) errors.role = 'Pick a role.';
  return errors;
}
