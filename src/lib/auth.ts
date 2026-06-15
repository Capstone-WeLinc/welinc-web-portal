export interface JwtPayload {
  sub: string;
  username: string;
  system: string;
  roles: { role: string; system: string }[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  system: string;
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

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('welinc_user');
}

export function getCurrentUser(): AuthenticatedUser | null {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const decoded = decodeJwt<JwtPayload>(token);
    return {
      id: decoded.sub,
      username: decoded.username,
      system: decoded.system,
      roles: decoded.roles || [],
    };
  } catch (e) {
    logout();
    return null;
  }
}
