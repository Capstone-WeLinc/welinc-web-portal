export interface JwtPayload {
  sub: string;
  email: string;
  roles: { role: string; system: string }[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: JwtPayload['roles'];
}

export function decodeJwt<T>(token: string): T {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid token');
  }

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );

  return JSON.parse(json) as T;
}

export type SubsystemKey = 'VRMS' | 'VMMS' | 'BMS';

const SYSTEM_KEY = 'welinc_system';

function isSubsystem(value: unknown): value is SubsystemKey {
  return value === 'VRMS' || value === 'VMMS' || value === 'BMS';
}

export function setTokens(accessToken: string): void {
  localStorage.setItem('welinc_token', accessToken);
}

/**
 * Stores the token and the system welinc-auth signed it for (spec 0002, AC-7). Overwritten on
 * every login, so a return visit goes back to the same system.
 */
export function setSession(accessToken: string, system: SubsystemKey): void {
  setTokens(accessToken);
  localStorage.setItem(SYSTEM_KEY, system);
}

/** The system of the last login, or null when none is stored. */
export function getStoredSystem(): SubsystemKey | null {
  const value = localStorage.getItem(SYSTEM_KEY);
  return isSubsystem(value) ? value : null;
}

/**
 * Where a return visit goes: the stored system, when the stored token hasn't expired. Null sends
 * the user to the login form.
 */
export function getReturnSystem(): SubsystemKey | null {
  if (!getCurrentUser()) return null;
  return getStoredSystem();
}

export function getToken(): string | null {
  return localStorage.getItem('welinc_token');
}

export function logout(): void {
  localStorage.removeItem('welinc_token');
  localStorage.removeItem('welinc_user');
  localStorage.removeItem(SYSTEM_KEY);
}

export function getCurrentUser(): AuthenticatedUser | null {
  const token = getToken();
  if (!token) return null;

  try {
    const decoded = decodeJwt<JwtPayload>(token);

    // Check token expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      logout();
      return null;
    }

    return {
      id: decoded.sub,
      email: decoded.email || '',
      roles: decoded.roles || [],
    };
  } catch {
    logout();
    return null;
  }
}
