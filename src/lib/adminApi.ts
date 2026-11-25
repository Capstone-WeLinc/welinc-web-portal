import { api } from './api';
import { errorCode, withStepUp, type SystemCode } from './admin';

/**
 * Suite spec 0013, AC-16: the portal's account calls on `/auth/admin/*`. Every call runs through
 * `withStepUp` (AC-22). Writes that may need the actor's password again go through `withReauth`:
 * welinc-auth decides when (giving the admin role, acting on an admin account), answers 403
 * `REAUTH_REQUIRED`, and the call is sent again once with a fresh token (AC-14a, AC-14b).
 */

export type RoleAssignment = { role: string; system: SystemCode };

/** Suite spec 0017, AC-21: a role on the People list and person answers, with when it ends. */
export type PersonRole = RoleAssignment & {
  temporaryUntil?: string | null;
  /** When the person was given this role (People list only; suite spec 0018, AC-13). */
  createdAt?: string;
};

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
  /**
   * With a `system`: only that system's roles, the rest named in `otherSystems`. Without one
   * (suite spec 0017, AC-19): every role in every system, and `otherSystems` is empty.
   */
  roles: PersonRole[];
  otherSystems: SystemCode[];
  /** The newest sign in, null if never (People list and person answers only). */
  lastSignedInAt?: string | null;
  /** When a temporary role in this system ends (AC-11), else null. */
  temporaryUntil?: string | null;
  /** The person is a suite admin (lists and the person page). */
  suiteAdmin?: boolean;
  pendingDeletion?: boolean;
  /** Set on a soft deleted account still in its grace period (the person page only). */
  deletedAt?: string | null;
};

export type PeopleStatus = 'LOCKED' | 'SETUP_PENDING' | 'EMAIL_NOT_VERIFIED' | 'ACTIVE' | 'INACTIVE' | 'PENDING_DELETION';

/** Suite spec 0017, AC-5: the server puts each person in exactly one group. */
export type PeopleGroup = 'attention' | 'active' | 'inactive';

/** Suite spec 0017, AC-4: name A to Z, last sign in (newest first), account made (newest first). */
export type PeopleSort = 'name' | 'lastSignedIn' | 'newest';

export type PeopleCounts = Record<PeopleGroup, number>;

export type PeoplePage = { items: ManagedPerson[]; next: string | null; counts?: PeopleCounts };

/** The person page answer (suite spec 0017, AC-21): the list item plus the facts of the header. */
export type PersonDetail = ManagedPerson & {
  lastSignedInAt: string | null;
  pendingDeletion: boolean;
  suiteAdmin: boolean;
  deletedAt: string | null;
  addedBy: { id: string; name: string } | null;
  failedSignIns30d: number;
  sessionCount: number;
  setupCodeExpiresAt: string | null;
  restorableUntil: string | null;
};

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

/**
 * `GET /auth/admin/users`. No `system` means every system the caller admins (suite spec 0017,
 * AC-19); with `group` the answer adds `counts` for all three groups (AC-20).
 */
export function listPeople(params: {
  system: Scope;
  q?: string;
  /** Only holders of this role in `system` (suite spec 0018: faces and the People tab). */
  role?: string;
  /** Leaves out holders of this role in `system` (suite spec 0018: Add people candidates). */
  excludeRole?: string;
  /** Leaves out suite admins and the caller, who can't be moved into a role. */
  assignable?: boolean;
  status?: PeopleStatus;
  group?: PeopleGroup;
  sort?: PeopleSort;
  limit?: number;
  cursor?: string;
}): Promise<PeoplePage> {
  const { system, assignable, ...rest } = params;
  const query = { ...rest, ...(assignable ? { assignable: 'true' } : {}), ...scoped(system) };
  return withStepUp(async () => (await api.get<PeoplePage>('/auth/admin/users', { params: query })).data,
  );
}

/** One person; with no `system`, the whole person across the caller's systems (AC-19). */
export function getPerson(id: string, system: Scope = null): Promise<PersonDetail> {
  return withStepUp(
    async () => (await api.get<PersonDetail>(`/auth/admin/users/${id}`, { params: scoped(system) })).data,
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

/** A person's events; with no `system`, every system the caller admins (suite spec 0017, AC-15). */
export function personActivity(id: string, system: Scope, cursor?: string, limit = 20): Promise<EventPage> {
  return withStepUp(
    async () =>
      (
        await api.get<EventPage>(`/auth/admin/users/${id}/activity`, {
          params: { ...scoped(system), cursor, limit },
        })
      ).data,
  );
}

export function deletePerson(id: string, system: Scope): Promise<void> {
  return withStepUp(async () => {
    // `data: {}` keeps the JSON content type: axios drops it on a bodiless DELETE, and the portal
    // CSRF guard refuses a write without it (403 CSRF_REJECTED).
    await api.delete(`/auth/admin/users/${id}`, { params: scoped(system), data: {} });
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

export function saveMatrix(
  system: SystemCode,
  input: { version: number; changes: MatrixCellChange[]; note?: string },
): Promise<PermissionMatrix> {
  return withStepUp(async () => (await api.patch<PermissionMatrix>(`/auth/admin/permissions/${system}`, input)).data);
}

// ---- roles page (suite spec 0018) -----------------------------------------------------------

export type RoleSummary = {
  code: string;
  name: string;
  description: string;
  builtIn: boolean;
  isSystemAdmin: boolean;
  copiedFrom: { code: string; name: string } | null;
  /** People who hold it and aren't deleted. */
  peopleCount: number;
  /** The newest permission change or role event; `byName` is "System" for the catalog sync. */
  lastChanged: { at: string; byName: string } | null;
};

export type RolePermission = {
  key: string;
  label: string;
  description: string;
  lockedRoles: string[];
  /** Built in roles whose catalog default is on (Reset to defaults). */
  defaultRoles: string[];
};

export type RolesData = {
  system: SystemCode;
  /** The system has permission keys, so custom roles can be offered. */
  supportsCustomRoles: boolean;
  /** Only suite admins change permissions and roles. */
  canEdit: boolean;
  /** The matrix version a save sends. */
  version: number;
  /** Live roles: built in first in catalog order, then custom by name. */
  roles: RoleSummary[];
  /** Permission groups in catalog order. */
  groups: { name: string; permissions: RolePermission[] }[];
  /** Each live role's allowed keys. */
  cells: Record<string, string[]>;
};

export function fetchRoles(system: SystemCode): Promise<RolesData> {
  return withStepUp(async () => (await api.get<RolesData>(`/auth/admin/roles/${system}`)).data);
}

/** The message welinc-auth sent with an error, when there is one. */
/** A role's history item (AC-15): a permission change, or a role event from child 0002. */
export type RoleHistoryItem = {
  id: string;
  at: string;
  /** "System" for the catalog sync. */
  actorName: string;
  kind: 'PERMISSION' | 'CREATED' | 'RENAMED' | 'DESCRIBED' | 'DELETED';
  key?: string;
  label?: string;
  before?: boolean | null;
  after?: boolean | null;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
};

export type RoleHistoryPage = { items: RoleHistoryItem[]; next: string | null };

export function roleHistory(system: SystemCode, code: string, cursor?: string): Promise<RoleHistoryPage> {
  return withStepUp(
    async () =>
      (
        await api.get<RoleHistoryPage>(`/auth/admin/roles/${system}/${encodeURIComponent(code)}/history`, {
          params: cursor ? { cursor, limit: 25 } : { limit: 25 },
        })
      ).data,
  );
}

/**
 * AC-14, AC-17: Add people, all or nothing. The admin role asks for the password again
 * (`REAUTH_REQUIRED`, through `withReauth`) before anyone moves.
 */
export function addRoleMembers(
  system: SystemCode,
  code: string,
  userIds: string[],
): Promise<{ moved: number; skipped: number }> {
  return withReauth(
    async (reauthToken) =>
      (
        await api.post<{ moved: number; skipped: number }>(
          `/auth/admin/roles/${system}/${encodeURIComponent(code)}/members`,
          reauthToken ? { userIds, reauthToken } : { userIds },
        )
      ).data,
  );
}

export function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data;
  const message = data?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
