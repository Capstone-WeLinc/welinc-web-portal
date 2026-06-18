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

export function setTokens(accessToken: string): void {
  localStorage.setItem('welinc_token', accessToken);
}

export function getToken(): string | null {
  return localStorage.getItem('welinc_token');
}

export function logout(): void {
  localStorage.removeItem('welinc_token');
  localStorage.removeItem('welinc_user');
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
  } catch (e) {
    logout();
    return null;
  }
}
