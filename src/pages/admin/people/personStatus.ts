import type { ManagedPerson, PeopleStatus } from '@/lib/adminApi';

/**
 * Suite spec 0013, AC-23: the badges a person row shows. The account status is the first that
 * applies (Inactive, Locked, Setup pending, Email not verified, Active), the same rule as the
 * VRMS Users page and welinc-auth's status filter; Pending deletion and Deleted sit beside it.
 */
export type AccountStatus = Exclude<PeopleStatus, 'PENDING_DELETION'>;

export function accountStatus(person: Pick<ManagedPerson, 'isActive' | 'isLocked' | 'passwordSet' | 'emailVerified'>): AccountStatus {
  if (!person.isActive) return 'INACTIVE';
  if (person.isLocked) return 'LOCKED';
  if (!person.passwordSet) return 'SETUP_PENDING';
  if (!person.emailVerified) return 'EMAIL_NOT_VERIFIED';
  return 'ACTIVE';
}

export const STATUS_LABELS: Record<PeopleStatus, string> = {
  LOCKED: 'Locked',
  SETUP_PENDING: 'Setup pending',
  EMAIL_NOT_VERIFIED: 'Email not verified',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PENDING_DELETION: 'Pending deletion',
};

/** The status filter choices, in the order the status is decided ("All" is none). */
export const STATUS_FILTERS: PeopleStatus[] = [
  'LOCKED',
  'SETUP_PENDING',
  'EMAIL_NOT_VERIFIED',
  'ACTIVE',
  'INACTIVE',
  'PENDING_DELETION',
];

export function parseStatus(raw: string | null): PeopleStatus | undefined {
  return STATUS_FILTERS.find((s) => s === raw);
}

/** The display name of a role code from the catalog, or the code made readable. */
export function roleName(code: string, names: ReadonlyMap<string, string>): string {
  return names.get(code) ?? code.charAt(0) + code.slice(1).toLowerCase().replaceAll('_', ' ');
}
