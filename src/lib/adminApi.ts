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
  /** Only the roles of the system the page acts in. */
  roles: RoleAssignment[];
  otherSystems: SystemCode[];
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
};

export type GraceItem = {
  user: { id: string; name: string; email: string };
  deletedAt: string;
  eraseAfter: string;
  requestId: string | null;
};

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

export async function verifyPassword(password: string): Promise<string> {
  const { data } = await api.post<{ reauthToken: string }>('/auth/admin/verify-password', {
    password,
    purpose: 'ADMIN_ACTION',
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
  system: SystemCode;
  q?: string;
  status?: PeopleStatus;
  cursor?: string;
}): Promise<PeoplePage> {
  return withStepUp(async () => (await api.get<PeoplePage>('/auth/admin/users', { params })).data);
}

export function getPerson(id: string, system: SystemCode): Promise<ManagedPerson> {
  return withStepUp(async () => (await api.get<ManagedPerson>(`/auth/admin/users/${id}`, { params: { system } })).data);
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

export function personActivity(id: string, system: SystemCode, cursor?: string): Promise<EventPage> {
  return withStepUp(
    async () =>
      (await api.get<EventPage>(`/auth/admin/users/${id}/activity`, { params: { system, cursor, limit: 20 } })).data,
  );
}

export function deletePerson(id: string, system: SystemCode): Promise<void> {
  return withStepUp(async () => {
    await api.delete(`/auth/admin/users/${id}`, { params: { system } });
  });
}

export function restorePerson(id: string, system: SystemCode): Promise<ManagedPerson> {
  return withStepUp(
    async () => (await api.post<ManagedPerson>(`/auth/admin/users/${id}/restore`, { system })).data,
  );
}

// ---- activity and deletion requests ---------------------------------------------------------

export function systemActivity(system: SystemCode, cursor?: string): Promise<EventPage> {
  return withStepUp(
    async () => (await api.get<EventPage>('/auth/admin/activity', { params: { system, cursor, limit: 30 } })).data,
  );
}

export function pendingDeletions(
  system: SystemCode,
  cursor?: string,
): Promise<{ data: DeletionRequest[]; nextCursor: string | null }> {
  return withStepUp(
    async () =>
      (
        await api.get<{ data: DeletionRequest[]; nextCursor: string | null }>('/auth/admin/deletion-requests', {
          params: { system, view: 'pending', cursor },
        })
      ).data,
  );
}

export function graceAccounts(
  system: SystemCode,
  cursor?: string,
): Promise<{ data: GraceItem[]; nextCursor: string | null }> {
  return withStepUp(
    async () =>
      (
        await api.get<{ data: GraceItem[]; nextCursor: string | null }>('/auth/admin/deletion-requests', {
          params: { system, view: 'grace', cursor },
        })
      ).data,
  );
}

export function approveDeletion(id: string, system: SystemCode): Promise<DeletionRequest> {
  return withStepUp(
    async () => (await api.post<DeletionRequest>(`/auth/admin/deletion-requests/${id}/approve`, { system })).data,
  );
}

export function rejectDeletion(id: string, system: SystemCode, note: string): Promise<DeletionRequest> {
  return withStepUp(
    async () =>
      (await api.post<DeletionRequest>(`/auth/admin/deletion-requests/${id}/reject`, { system, note })).data,
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
