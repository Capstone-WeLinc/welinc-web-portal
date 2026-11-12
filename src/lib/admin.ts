import { api } from './api';

/**
 * Suite spec 0013: the portal admin section's client side. Every `/auth/admin/*` call is
 * authenticated by the `welinc_sso` cookie, so nothing here holds a token or a flag.
 */

export type SystemCode = 'VRMS' | 'VMMS' | 'BMS';

/** `GET /auth/admin/me` (AC-15). */
export type AdminMe = {
  user: { id: string; name: string; email: string; picture: string | null };
  suiteAdmin: boolean;
  adminOf: SystemCode[];
  codeRequired: boolean;
  codePassed: boolean;
};

export function isAdmin(me: AdminMe | null): boolean {
  return Boolean(me && (me.suiteAdmin || me.adminOf.length > 0));
}

/** Whether the session still owes the emailed code before admin powers work (AC-6). */
export function needsCode(me: AdminMe): boolean {
  return me.codeRequired && !me.codePassed;
}

export async function fetchAdminMe(): Promise<AdminMe> {
  const { data } = await api.get<AdminMe>('/auth/admin/me');
  return data;
}

/** The error code of an Axios failure, if welinc-auth sent one. */
export function errorCode(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data;
  return typeof data?.code === 'string' ? data.code : undefined;
}

export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

/** `POST /auth/admin/code`: a code was sent, or this session passed already (AC-7). */
export type AdminCodeAnswer = { challengeId: string; email: string; resendAfter: number } | { passed: true };

export function codeAlreadyPassed(answer: AdminCodeAnswer): answer is { passed: true } {
  return 'passed' in answer && answer.passed === true;
}

/**
 * AC-22: whoever shows the step up dialog registers here. `askForCode` resolves true once the
 * session passed the code, false when the person closed the dialog. Calls that arrive while the
 * dialog is open share the same answer.
 */
type StepUpHost = () => Promise<boolean>;
let host: StepUpHost | null = null;
let pending: Promise<boolean> | null = null;

export function registerStepUpHost(next: StepUpHost | null) {
  host = next;
}

export function askForCode(): Promise<boolean> {
  if (!host) return Promise.resolve(false);
  pending ??= host().finally(() => {
    pending = null;
  });
  return pending;
}

/** Runs an admin call; on 403 `ADMIN_CODE_REQUIRED` asks for the code, then retries once (AC-22). */
export async function withStepUp<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (errorCode(error) !== 'ADMIN_CODE_REQUIRED') throw error;
    if (!(await askForCode())) throw error;
    return call();
  }
}
