import { createElement } from 'react';
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

/** Tests only. */
export function resetNotifyForTests() {
  shown = [];
}
