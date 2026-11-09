import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/toast';
import { signOutEverywhere } from '../../lib/session';

/** Sign out everywhere, behind a confirm (spec 0007, AC-17). A failure keeps the page. */
export default function SignOutButton() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOutEverywhere();
    } catch {
      setBusy(false);
      setOpen(false);
      showToast("We couldn't sign you out. Try again.", 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
      >
        Sign out
      </button>
      <ConfirmModal
        isOpen={open}
        title="Sign out of every WeLinc system?"
        message="You'll need to sign in again to use any system."
        confirmText="Sign out"
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
