import { cn } from '@/lib/utils';
import type { PeopleStatus } from '@/lib/adminApi';
import { STATUS_LABELS } from './personStatus';

const PILL = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide uppercase';

/** design.md: a status pill pairs color with its text label, soft tint and darker text. */
const STATUS_STYLE: Record<PeopleStatus, string> = {
  LOCKED: 'bg-destructive/10 text-destructive',
  SETUP_PENDING: 'bg-highlight text-highlight-foreground',
  EMAIL_NOT_VERIFIED: 'bg-highlight/40 text-foreground',
  ACTIVE: 'bg-success-fill/15 text-success',
  INACTIVE: 'bg-muted text-muted-strong',
  PENDING_DELETION: 'border border-destructive text-destructive',
};

export function StatusBadge({ status }: { status: PeopleStatus }) {
  return <span className={cn(PILL, STATUS_STYLE[status])}>{STATUS_LABELS[status]}</span>;
}

/** The suite's shared role colors (design.md, Role colors), always with the role name. */
const ROLE_STYLE: Record<string, string> = {
  ADMIN: 'bg-role-admin-bg text-role-admin-fg',
  CHIEF_MECHANIC: 'bg-role-chief-mechanic-bg text-role-chief-mechanic-fg',
  MECHANIC: 'bg-role-mechanic-bg text-role-mechanic-fg',
  OPERATIONS: 'bg-role-operations-bg text-role-operations-fg',
  CUSTOMER_SUPPORT: 'bg-role-customer-support-bg text-role-customer-support-fg',
  DRIVER: 'bg-role-driver-bg text-role-driver-fg',
};

export function RoleBadge({ code, name }: { code: string; name: string }) {
  return <span className={cn(PILL, ROLE_STYLE[code] ?? 'bg-role-driver-bg text-role-driver-fg')}>{name}</span>;
}

export function DeletedBadge() {
  return <span className={cn(PILL, 'bg-destructive text-destructive-foreground')}>Deleted</span>;
}

/** AC-23: a role that ends on its own (temporary access, AC-11). */
export function TemporaryBadge({ until }: { until: string }) {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(until));
  return <span className={cn(PILL, 'border border-highlight text-foreground')}>Temporary until {time}</span>;
}

export function SuiteAdminBadge() {
  return <span className={cn(PILL, 'bg-primary text-primary-foreground')}>Suite admin</span>;
}

/** AC-21: no other active admin of the person's systems is left to decide. */
export function OrphanBadge() {
  return <span className={cn(PILL, 'bg-destructive/10 text-destructive')}>No admin left</span>;
}
