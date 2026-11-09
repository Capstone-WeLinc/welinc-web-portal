import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { notifyError } from '@/lib/notify';
import { signOutEverywhere } from '@/lib/session';

type SignOutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Sign out of every WeLinc system?" (spec 0007, AC-17). Confirming ends the shared session,
 * then shows the form. A failure closes the dialog, keeps the page and shows an error toast.
 */
export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await signOutEverywhere();
    } catch {
      setBusy(false);
      onOpenChange(false);
      notifyError("We couldn't sign you out. Try again.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of every WeLinc system?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be signed out of VRMS, VMMS and BMS on this browser, and need to sign in again to use any of them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={(event) => {
              // Stay open while the sign out runs; the page leaves on success
              event.preventDefault();
              void confirm();
            }}
          >
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
