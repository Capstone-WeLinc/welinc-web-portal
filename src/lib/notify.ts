import { createElement, type ReactElement } from 'react';
import { toast, type ExternalToast } from 'sonner';
import { Toast, type ToastKind } from '@/components/ui/toast';

/*
  Suite spec 0016 AC-11 (design.md, Feedback: Toasts): every toast is our own Toast through
  sonner's toast.custom. Success and info last 5 seconds, warnings 8, errors stay until closed.
  At most MAX_TOASTS show: when full, the oldest non error goes first, then the oldest error.
  Errors carry role="alert", so screen readers hear them at once.
*/
export type NotifyKind = ToastKind;

export const TOAST_MS: Record<NotifyKind, number> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: Infinity,
};
export const MAX_TOASTS = 3;

/**
 * Suite spec 0019, AC-25: the session warning's fixed id. It never counts toward MAX_TOASTS (it
 * is not in `shown`), so the toaster shows one more than the limit.
 */
export const SESSION_TOAST_ID = 'session-warning';

/** Suite spec 0019, AC-15: the Toaster mounted only inside the sign in split's white side. */
export const SIGN_IN_TOASTER = 'sign-in';

export type NotifyOptions = {
  /** One optional line under the title. */
  body?: string;
  action?: { label: string; onClick: () => void };
  /** A toast with the same id replaces the one showing instead of stacking. */
  id?: string;
};

type Shown = { id: string | number; type: NotifyKind };
let shown: Shown[] = [];
let nextId = 0;

/** Which shown toast has to go to make room for one more, or null when there is room. */
export function pickToastToEvict(list: Shown[], max = MAX_TOASTS): Shown | null {
  if (list.length < max) return null;
  return list.find((item) => item.type !== 'error') ?? list[0] ?? null;
}

function forget(id: string | number) {
  shown = shown.filter((item) => item.id !== id);
}

export function notify(message: string, type: NotifyKind = 'success', options: NotifyOptions = {}) {
  const id = options.id ?? `toast-${++nextId}`;
  if (!shown.some((item) => item.id === id)) {
    const evict = pickToastToEvict(shown);
    if (evict) {
      forget(evict.id);
      toast.dismiss(evict.id);
    }
    shown = [...shown, { id, type }];
  }
  const duration = TOAST_MS[type];
  const settings: ExternalToast = {
    id,
    duration,
    onDismiss: () => forget(id),
    onAutoClose: () => forget(id),
  };
  toast.custom(
    () =>
      createElement(Toast, {
        kind: type,
        title: message,
        body: options.body,
        action: options.action,
        durationMs: Number.isFinite(duration) && type !== 'warning' ? duration : undefined,
        onClose: () => {
          forget(id);
          toast.dismiss(id);
        },
      }),
    settings,
  );
}

export function notifyError(message: string, options?: NotifyOptions) {
  notify(message, 'error', options);
}

export function notifySuccess(message: string, options?: NotifyOptions) {
  notify(message, 'success', options);
}

/**
 * Suite spec 0019, AC-25: shows the session warning (or redraws it), with no time limit and no
 * swipe away. `render` reads the session store itself, so its countdown ticks on its own.
 */
export function showSessionToast(render: () => ReactElement) {
  toast.custom(render, { id: SESSION_TOAST_ID, duration: Infinity, dismissible: false });
}

export function dismissSessionToast() {
  toast.dismiss(SESSION_TOAST_ID);
}

/**
 * Suite spec 0019, AC-15: a message on the sign in page, on the sign in Toaster. A warning (the
 * session ended) stays until closed with no time bar; a success lasts as any success toast. The
 * id is the message, so drawing the page twice never stacks it.
 */
export function notifySignIn(message: string, type: 'success' | 'warning') {
  const id = `sign-in:${message}`;
  const duration = type === 'warning' ? Infinity : TOAST_MS.success;
  toast.custom(
    () =>
      createElement(Toast, {
        kind: type,
        title: message,
        durationMs: Number.isFinite(duration) ? duration : undefined,
        onClose: () => toast.dismiss(id),
      }),
    { id, duration, toasterId: SIGN_IN_TOASTER },
  );
}

/** Tests only. */
export function resetNotifyForTests() {
  shown = [];
}
