import { api } from './api';
import { errorCode, withStepUp, type SystemCode } from './admin';

/**
 * Suite spec 0013, AC-16: the portal's account calls on `/auth/admin/*`. Every call runs through
 * `withStepUp` (AC-22). Writes that may need the actor's password again go through `withReauth`:
 * welinc-auth decides when (giving the admin role, acting on an admin account), answers 403
 * `REAUTH_REQUIRED`, and the call is sent again once with a fresh token (AC-14a, AC-14b).
 */

export type RoleAssignment = { role: string; system: SystemCode };

export type ManagedPerson = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  passwordSet: boolean;
  contact: string | null;
  profilePicture: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only the roles of the system the page acts in (every system's in a suite wide list). */
  roles: RoleAssignment[];
  otherSystems: SystemCode[];
  /** When a temporary role in this system ends (AC-11), else null. */
  temporaryUntil?: string | null;
  /** The person is a suite admin (lists and the person page). */
  suiteAdmin?: boolean;
  pendingDeletion?: boolean;
  /** Set on a soft deleted account still in its grace period (the person page only). */
  deletedAt?: string | null;
};

export type PeopleStatus = 'LOCKED' | 'SETUP_PENDING' | 'EMAIL_NOT_VERIFIED' | 'ACTIVE' | 'INACTIVE' | 'PENDING_DELETION';

export type PeoplePage = { items: ManagedPerson[]; next: string | null };

export type LookupPerson = { id: string; name: string; email: string; systems: SystemCode[] };

export type SessionView = {
  sid: string;
  kind: 'web' | 'mobile';
  device: string;
  client: string;
  systems: SystemCode[];
  createdAt: string;
  lastActiveAt: string;
};

export type EventView = {
  id: string;
  category: string;
  type: string;
  reason: string | null;
  system: SystemCode | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  address: string | null;
  device: string | null;
  country: string | null;
  createdAt: string;
  actor: { kind: 'SELF' | 'ADMIN' | 'SYSTEM'; id?: string; name?: string };
  user?: { id: string; name: string; email: string };
};

export type EventPage = { data: EventView[]; nextCursor: string | null };

export type DeletionRequest = {
  id: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  eraseAfter: string | null;
  user?: { id: string; name: string; email: string; systems: SystemCode[] };
  /** Suite view only (AC-21). */
  orphan?: boolean;
};

export type GraceItem = {
  user: { id: string; name: string; email: string };
  deletedAt: string;
  eraseAfter: string;
  requestId: string | null;
  /** Suite view only (AC-21). */
  orphan?: boolean;
};

/** A system, or null for the suite wide view (suite admins, AC-17). */
export type Scope = SystemCode | null;

const scoped = (system: Scope) => (system ? { system } : {});

export type CatalogRole = { code: string; name: string; description: string; isSystemAdmin: boolean };
export type CatalogSystem = { code: SystemCode; name: string; maxRolesPerUser: number; roles: CatalogRole[] };

export type EventCatalog = {
  categories: { code: string; label: string }[];
  types: { code: string; category: string; label: string; labelAdmin: string }[];
  reasons: { code: string; label: string }[];
};

// ---- the password recheck -------------------------------------------------------------------

/** Shows the password dialog; resolves the reauth token, or null when the person cancels. */
type ReauthHost = () => Promise<string | null>;
let reauthHost: ReauthHost | null = null;

export function registerReauthHost(next: ReauthHost | null) {
  reauthHost = next;
}

export function askForPassword(): Promise<string | null> {
  return reauthHost ? reauthHost() : Promise.resolve(null);
}

/** Thrown when the person closed the password dialog, so callers can stay quiet. */
export class ReauthCancelled extends Error {
  constructor() {
    super('reauth cancelled');
  }
}

export async function withReauth<T>(call: (reauthToken?: string) => Promise<T>): Promise<T> {
  try {
    return await withStepUp(() => call());
  } catch (error) {
    if (errorCode(error) !== 'REAUTH_REQUIRED') throw error;
    const token = await askForPassword();
    if (!token) throw new ReauthCancelled();
    return withStepUp(() => call(token));
  }
}

export type ReauthPurpose = 'ADMIN_ACTION' | 'TEMPORARY_ACCESS';

export async function verifyPassword(password: string, purpose: ReauthPurpose = 'ADMIN_ACTION'): Promise<string> {
  const { data } = await api.post<{ reauthToken: string }>('/auth/admin/verify-password', {
    password,
    purpose,
  });
  return data.reauthToken;
}

// ---- catalogs (public) ----------------------------------------------------------------------

export async function fetchSystems(): Promise<CatalogSystem[]> {
  const { data } = await api.get<{ systems: CatalogSystem[] }>('/auth/systems');
  return data.systems;
}

export async function fetchEventCatalog(): Promise<EventCatalog> {
  const { data } = await api.get<EventCatalog>('/auth/activity/catalog');
  return data;
}

// ---- people ---------------------------------------------------------------------------------

export function listPeople(params: {
  system: Scope;
  q?: string;
  status?: PeopleStatus;
  cursor?: string;
}): Promise<PeoplePage> {
  const { system, ...rest } = params;
  return withStepUp(
    async () => (await api.get<PeoplePage>('/auth/admin/users', { params: { ...rest, ...scoped(system) } })).data,
  );
}

export function getPerson(id: string, system: Scope): Promise<ManagedPerson> {
  return withStepUp(
    async () => (await api.get<ManagedPerson>(`/auth/admin/users/${id}`, { params: scoped(system) })).data,
  );
}

export function lookupPeople(system: SystemCode, q: string): Promise<LookupPerson[]> {
  return withStepUp(
    async () => (await api.get<LookupPerson[]>('/auth/admin/users/lookup', { params: { system, q } })).data,
  );
}

export type CreatePersonInput = {
  system: SystemCode;
  name: string;
  email: string;
  roleAssignments: RoleAssignment[];
  attachExisting?: boolean;
};

export function createPerson(input: CreatePersonInput): Promise<ManagedPerson & { setupEmailSent?: boolean }> {
  return withReauth(
    async (reauthToken) =>
      (await api.post<ManagedPerson & { setupEmailSent?: boolean }>('/auth/admin/users', { ...input, reauthToken }))
        .data,
  );
}

export type UpdatePersonInput = {
  name?: string;
  email?: string;
  roleAssignments?: RoleAssignment[];
};

export function updatePerson(id: string, system: SystemCode, input: UpdatePersonInput): Promise<ManagedPerson> {
  return withReauth(
    async (reauthToken) =>
      (await api.patch<ManagedPerson>(`/auth/admin/users/${id}`, { ...input, system, reauthToken })).data,
  );
}

export function setPersonActive(id: string, system: SystemCode, isActive: boolean): Promise<ManagedPerson> {
  return withStepUp(
    async () => (await api.patch<ManagedPerson>(`/auth/admin/users/${id}/status`, { system, isActive })).data,
  );
}

export function unlockPerson(id: string, system: SystemCode): Promise<ManagedPerson> {
  return withReauth(
    async (reauthToken) =>
      (await api.patch<ManagedPerson>(`/auth/admin/users/${id}/unlock`, { system, reauthToken })).data,
  );
}

export function sendResetCode(id: string, system: SystemCode): Promise<void> {
  return withReauth(async (reauthToken) => {
    await api.post(`/auth/admin/users/${id}/reset-code`, { system, reauthToken });
  });
}

export function listPersonSessions(id: string, system: SystemCode): Promise<SessionView[]> {
  return withStepUp(
    async () =>
      (await api.get<{ sessions: SessionView[] }>(`/auth/admin/users/${id}/sessions`, { params: { system } })).data
        .sessions,
  );
}

export function endPersonSessions(id: string, system: SystemCode): Promise<void> {
  return withReauth(async (reauthToken) => {
    await api.delete(`/auth/admin/users/${id}/sessions`, { data: { system, reauthToken } });
  });
}

export function personActivity(id: string, system: Scope, cursor?: string): Promise<EventPage> {
  return withStepUp(
    async () =>
      (
        await api.get<EventPage>(`/auth/admin/users/${id}/activity`, {
          params: { ...scoped(system), cursor, limit: 20 },
        })
      ).data,
  );
}

export function deletePerson(id: string, system: Scope): Promise<void> {
  return withStepUp(async () => {
    await api.delete(`/auth/admin/users/${id}`, { params: scoped(system) });
  });
}

export function restorePerson(id: string, system: Scope): Promise<ManagedPerson> {
  return withStepUp(
    async () => (await api.post<ManagedPerson>(`/auth/admin/users/${id}/restore`, scoped(system))).data,
  );
}

// ---- activity and deletion requests ---------------------------------------------------------

export function systemActivity(system: Scope, cursor?: string): Promise<EventPage> {
  return withStepUp(
    async () =>
      (await api.get<EventPage>('/auth/admin/activity', { params: { ...scoped(system), cursor, limit: 30 } })).data,
  );
}

export function pendingDeletions(
  system: Scope,
  cursor?: string,
): Promise<{ data: DeletionRequest[]; nextCursor: string | null }> {
  return withStepUp(
    async () =>
      (
        await api.get<{ data: DeletionRequest[]; nextCursor: string | null }>('/auth/admin/deletion-requests', {
          params: { ...scoped(system), view: 'pending', cursor },
        })
      ).data,
  );
}

export function graceAccounts(
  system: Scope,
  cursor?: string,
): Promise<{ data: GraceItem[]; nextCursor: string | null }> {
  return withStepUp(
    async () =>
      (
        await api.get<{ data: GraceItem[]; nextCursor: string | null }>('/auth/admin/deletion-requests', {
          params: { ...scoped(system), view: 'grace', cursor },
        })
      ).data,
  );
}

export function approveDeletion(id: string, system: Scope): Promise<DeletionRequest> {
  return withStepUp(
    async () =>
      (await api.post<DeletionRequest>(`/auth/admin/deletion-requests/${id}/approve`, scoped(system))).data,
  );
}

export function rejectDeletion(id: string, system: Scope, note: string): Promise<DeletionRequest> {
  return withStepUp(
    async () =>
      (await api.post<DeletionRequest>(`/auth/admin/deletion-requests/${id}/reject`, { ...scoped(system), note }))
        .data,
  );
}

// ---- suite admins, temporary access and the report (AC-1, AC-2, AC-9 to AC-11, AC-19) ----------

export type Named = { id: string; name: string } | null;

export type SuiteAdmin = {
  id: string;
  name: string;
  email: string;
  grantedAt: string;
  grantedBy: Named;
  reason: string | null;
};

export function listSuiteAdmins(): Promise<SuiteAdmin[]> {
  return withStepUp(async () => (await api.get<{ items: SuiteAdmin[] }>('/auth/admin/suite-admins')).data.items);
}

export function addSuiteAdmin(input: { userId: string; reason: string; reauthToken: string }): Promise<SuiteAdmin> {
  return withStepUp(async () => (await api.post<SuiteAdmin>('/auth/admin/suite-admins', input)).data);
}

export function removeSuiteAdmin(userId: string, input: { reason: string; reauthToken: string }): Promise<void> {
  return withStepUp(async () => {
    await api.post(`/auth/admin/suite-admins/${userId}/remove`, input);
  });
}

export type TemporaryGrant = {
  id: string;
  holder: { id: string; name: string; email: string };
  system: SystemCode;
  role: string;
  roleName: string;
  reason: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endReason: 'EXPIRED' | 'ENDED_EARLY' | 'SUITE_ADMIN_REMOVED' | null;
  endedBy: Named;
};

export function listGrants(params: {
  state: 'live' | 'all';
  system?: SystemCode;
  cursor?: string;
}): Promise<{ items: TemporaryGrant[]; next: string | null }> {
  return withStepUp(
    async () =>
      (await api.get<{ items: TemporaryGrant[]; next: string | null }>('/auth/admin/temporary-grants', { params }))
        .data,
  );
}

export function startGrant(input: {
  system: SystemCode;
  role: string;
  hours: number;
  reason: string;
  reauthToken: string;
}): Promise<TemporaryGrant> {
  return withStepUp(async () => (await api.post<TemporaryGrant>('/auth/admin/temporary-grants', input)).data);
}

export function endGrant(id: string): Promise<void> {
  return withStepUp(async () => {
    await api.delete(`/auth/admin/temporary-grants/${id}`, { data: {} });
  });
}

type Person = { id: string; name: string; email: string };

export type AdminReport = {
  suiteAdmins: SuiteAdmin[];
  systems: {
    system: SystemCode;
    name: string;
    adminRole: { code: string; name: string } | null;
    admins: (Person & { since: string; grantedBy: Named })[];
    temporaryGrants: {
      id: string;
      holder: Person;
      role: string;
      roleName: string;
      reason: string;
      startedAt: string;
      expiresAt: string;
    }[];
  }[];
  attention: {
    locked: { count: number; first: (Person & { lockedAt: string })[] };
    setupPending: { count: number; first: (Person & { createdAt: string })[] };
    emailNotVerified: { count: number; first: (Person & { createdAt: string })[] };
    deletionRequests: {
      count: number;
      first: { id: string; user: Person; requestedAt: string; orphan: boolean }[];
    };
    inGrace: { count: number; first: (Person & { deletedAt: string; eraseAfter: string; orphan: boolean })[] };
  };
  systemsWithoutAdmin: SystemCode[];
  recentAdminChanges: {
    id: string;
    type: string;
    at: string;
    user: Person;
    actor: Named;
    system: SystemCode | null;
    oldValue: string | null;
    newValue: string | null;
    reason: string | null;
  }[];
};

export function fetchReport(): Promise<AdminReport> {
  return withStepUp(async () => (await api.get<AdminReport>('/auth/admin/report')).data);
}

// ---- permission matrix (AC-27) --------------------------------------------------------------

export type MatrixPermission = {
  key: string;
  label: string;
  group: string;
  description: string;
  /** Roles whose cell always keeps its default. */
  lockedRoles: string[];
};

export type PermissionMatrix = {
  system: SystemCode;
  version: number;
  roles: { code: string; name: string }[];
  permissions: MatrixPermission[];
  /** Each role's keys that are on. */
  grants: Record<string, string[]>;
  /** Only suite admins save; a system admin reads. */
  canEdit: boolean;
};

export type MatrixCellChange = { role: string; key: string; allowed: boolean };

export type MatrixHistoryItem = {
  id: string;
  role: string;
  roleName: string;
  key: string;
  label: string;
  /** Null: the cell was created. */
  before: boolean | null;
  /** Null: the cell was removed with its key or role. */
  after: boolean | null;
  actorName: string;
  actorEmail: string | null;
  note: string | null;
  /** Copied from VRMS when the matrix moved here. */
  imported: boolean;
  createdAt: string;
};

export type MatrixHistoryPage = { items: MatrixHistoryItem[]; nextCursor: string | null };

export function fetchMatrix(system: SystemCode): Promise<PermissionMatrix> {
  return withStepUp(async () => (await api.get<PermissionMatrix>(`/auth/admin/permissions/${system}`)).data);
}

export function saveMatrix(
  system: SystemCode,
  input: { version: number; changes: MatrixCellChange[]; note?: string },
): Promise<PermissionMatrix> {
  return withStepUp(async () => (await api.patch<PermissionMatrix>(`/auth/admin/permissions/${system}`, input)).data);
}

export function matrixHistory(system: SystemCode, cursor?: string): Promise<MatrixHistoryPage> {
  return withStepUp(
    async () =>
      (
        await api.get<MatrixHistoryPage>(`/auth/admin/permissions/${system}/changes`, {
          params: cursor ? { cursor } : {},
        })
      ).data,
  );
}

/** The message welinc-auth sent with an error, when there is one. */
export function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data;
  const message = data?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
