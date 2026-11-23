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
import { signOutLine } from '@/lib/launcher';
import { signOutEverywhere } from '@/lib/session';

type SignOutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person's own systems (`signedInSystems`), named in the line; left out where unknown. */
  systems?: readonly string[];
};

/**
 * "Sign out of WeLinc?" (spec 0007, AC-17), naming only the person's own systems. Confirming ends the shared session,
 * then shows the form. A failure closes the dialog, keeps the page and shows an error toast.
 */
export function SignOutDialog({ open, onOpenChange, systems }: SignOutDialogProps) {
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
          <AlertDialogTitle>Sign out of WeLinc?</AlertDialogTitle>
          <AlertDialogDescription>{signOutLine(systems)}</AlertDialogDescription>
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
