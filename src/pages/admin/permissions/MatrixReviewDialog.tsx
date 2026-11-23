import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorCode } from '@/lib/admin';
import { errorMessage, saveMatrix, type MatrixCellChange, type PermissionMatrix } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { NOTE_MAX, NOTE_MIN, noteProblem, takesAway } from './matrixDraft';

/**
 * Suite spec 0013, AC-27: the step between the matrix and the save. It lists each role's gains
 * and losses, then a note, required when a right is taken away. A stale matrix says so and offers
 * a reload, since someone else saved first.
 */
export function MatrixReviewDialog({
  open,
  matrix,
  changes,
  onClose,
  onSaved,
  onReload,
}: {
  open: boolean;
  matrix: PermissionMatrix;
  changes: MatrixCellChange[];
  onClose: () => void;
  onSaved: (next: PermissionMatrix) => void;
  onReload: () => void;
}) {
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);
  // A fresh form each time the dialog opens, reset during render (no effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNote('');
      setTouched(false);
      setFailure(null);
    }
  }

  const required = takesAway(changes);
  const problem = noteProblem(note, required);
  const label = new Map(matrix.permissions.map((p) => [p.key, p.label]));
  const byRole = matrix.roles
    .map((role) => ({ role, items: changes.filter((c) => c.role === role.code) }))
    .filter((r) => r.items.length > 0);

  const submit = async () => {
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setFailure(null);
    try {
      const next = await saveMatrix(matrix.system, {
        version: matrix.version,
        changes,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onSaved(next);
    } catch (error) {
      const code = errorCode(error);
      setFailure({
        stale: code === 'MATRIX_STALE',
        message:
          code === 'MATRIX_STALE'
            ? 'Someone saved this matrix after you opened it. Reload, then make your changes again.'
            : errorMessage(error, "We couldn't save the permissions."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {changes.length === 1 ? 'Save 1 permission change?' : `Save ${changes.length} permission changes?`}
          </DialogTitle>
          <DialogDescription>
            Everyone with these {matrix.system} roles gets the new rights within about a minute, and the {matrix.system}{' '}
            admins get an email.
          </DialogDescription>
        </DialogHeader>
        <form
          id="matrix-review-form"
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-4">
            {byRole.map(({ role, items }) => (
              <section key={role.code} aria-label={role.name}>
                <h3 className="mb-1 text-label text-muted-strong">{role.name}</h3>
                <ul className="flex flex-col gap-1">
                  {items.map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-body text-foreground">
                      {c.allowed ? (
                        <Plus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <span className="break-words">
                        <span className="sr-only">{c.allowed ? 'Gets: ' : 'Loses: '}</span>
                        {label.get(c.key) ?? c.key}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="matrix-note">
              Note {required ? <span aria-hidden="true">*</span> : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <Textarea
              id="matrix-note"
              value={note}
              maxLength={NOTE_MAX}
              disabled={busy}
              placeholder={required ? 'Why these roles lose a right' : 'Why you made this change'}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={touched && problem ? true : undefined}
              aria-describedby="matrix-note-help"
            />
            <p
              id="matrix-note-help"
              className={cn('text-caption tabular-nums', touched && problem ? 'text-destructive' : 'text-muted-foreground')}
            >
              {touched && problem
                ? problem
                : `${note.trim().length} of ${NOTE_MAX} characters${required ? `, at least ${NOTE_MIN}` : ''}`}
            </p>
          </div>
          {failure && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="text-body text-destructive">{failure.message}</p>
              {failure.stale && (
                <Button type="button" variant="outline" onClick={onReload}>
                  Reload the matrix
                </Button>
              )}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Back to the matrix
          </Button>
          <Button type="submit" form="matrix-review-form" disabled={busy || failure?.stale === true}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
