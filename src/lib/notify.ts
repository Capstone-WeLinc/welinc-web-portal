import { toast } from 'sonner';

// Toasts through sonner (design.md): errors are also announced in a role="alert" region the
// Toaster owns, so screen readers hear them at once.

type AlertAnnouncer = (message: string) => void;
let announceAlert: AlertAnnouncer | null = null;

export function registerAlertAnnouncer(announcer: AlertAnnouncer | null) {
  announceAlert = announcer;
}

export function notifyError(message: string) {
  toast.error(message);
  announceAlert?.(message);
}
