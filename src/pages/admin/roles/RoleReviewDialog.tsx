import { useId, useState } from 'react';
import { ChevronRight, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { InitialsTile } from '@/components/ui/initials-tile';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorCode } from '@/lib/admin';
import { errorMessage, saveMatrix, type MatrixCellChange, type RolesData } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { NOTE_MAX, NOTE_MIN, takesAway, type MatrixDraft } from '../permissions/matrixDraft';
import { holderNames, holdsPowerAfter } from './rolesRules';

/** A save welinc-auth refused for a reason the page handles by reading the data again (AC-11). */
export type SaveConflict = 'MATRIX_STALE' | 'LOCKED_CELL' | 'UNKNOWN_ROLE';
const CONFLICTS: readonly string[] = ['MATRIX_STALE', 'LOCKED_CELL', 'UNKNOWN_ROLE'];

/**
 * Suite spec 0018, child 0001 AC-9 and AC-11 (board Picks8, RC): the one step between the draft
 * and the save. One block per role: who holds it, then its permission groups, each folding with
 * "+a −r". When anything is taken away the note starts open and is required (5 to 500 characters,
 * the server's rule); otherwise it folds behind "Add a note for the activity log". A conflict goes
 * back to the page, which reads the data again; a network error stays here with Save enabled.
 */
export function RoleReviewDialog({
  open,
  data,
  draft,
  changes,
  holders,
  onClose,
  onSaved,
  onConflict,
}: {
  open: boolean;
  data: RolesData;
  draft: MatrixDraft;
  changes: MatrixCellChange[];
  /** Up to three holder names per role code, when they were read. */
  holders: Record<string, string[]>;
  onClose: () => void;
  onSaved: (count: number) => void;
  onConflict: (code: SaveConflict) => void;
}) {
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A fresh form each time the dialog opens, reset during render (no effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNote('');
      setNoteOpen(false);
      setFailure(null);
    }
  }

  const required = takesAway(changes);
  const length = note.trim().length;
  const noteOk = required ? length >= NOTE_MIN && length <= NOTE_MAX : length <= NOTE_MAX;
  const count = changes.length;
  const roles = data.roles.filter((r) => changes.some((c) => c.role === r.code));
  const noteId = useId();

  const submit = async () => {
    if (!noteOk || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await saveMatrix(data.system, {
        version: data.version,
        changes,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onSaved(count);
    } catch (error) {
      const code = errorCode(error);
      if (code && CONFLICTS.includes(code)) onConflict(code as SaveConflict);
      else setFailure(errorMessage(error, "We couldn't save the changes. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-120">
        <div className="flex flex-col gap-2.5 px-6 pt-6 pb-3.5">
          <DialogTitle className="pr-8">{count === 1 ? 'Save 1 change?' : `Save ${count} changes?`}</DialogTitle>
          <DialogDescription className="sr-only">
            Everyone with these {data.system} roles gets the change the next time they open {data.system}.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-4 pb-1">
          {roles.map((role) => (
            <RoleBlock
              key={role.code}
              name={role.name}
              system={data.system}
              names={holders[role.code] ?? []}
              peopleCount={role.peopleCount}
              warn={holdsPowerAfter(data, draft, role)}
              groups={groupsOf(data, changes.filter((c) => c.role === role.code))}
            />
          ))}
        </div>
        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="px-6 pt-3">
            {required || noteOpen ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={noteId}>
                  Note for the activity log
                  {required && (
                    <>
                      <span aria-hidden="true"> *</span>
                      <span className="sr-only"> (required)</span>
                    </>
                  )}
                </Label>
                <Textarea
                  id={noteId}
                  value={note}
                  maxLength={NOTE_MAX}
                  disabled={busy}
                  required={required}
                  autoFocus={!required}
                  rows={2}
                  placeholder="Why, for whoever reads the history later"
                  onChange={(e) => setNote(e.target.value)}
                  aria-describedby={`${noteId}-help`}
                />
                <p id={`${noteId}-help`} className="text-caption text-muted-foreground tabular-nums">
                  {required
                    ? `Required when something is taken away, ${NOTE_MIN} to ${NOTE_MAX} characters. ${length} so far.`
                    : `Optional, up to ${NOTE_MAX} characters. It shows on the role's History tab.`}
                </p>
              </div>
            ) : (
              <Button type="button" variant="link" className="h-auto px-0 py-1.5" onClick={() => setNoteOpen(true)}>
                <Plus aria-hidden="true" />
                Add a note for the activity log
              </Button>
            )}
          </div>
          {failure && (
            <p role="alert" className="px-6 pt-3 text-body text-destructive">
              {failure}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2.5 px-6 pt-3.5 pb-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Keep editing
            </Button>
            <Button type="submit" disabled={!noteOk} loading={busy}>
              {busy ? 'Saving…' : count === 1 ? 'Save 1 change' : `Save ${count} changes`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ChangeGroup = { name: string; items: { key: string; label: string; allowed: boolean }[] };

function groupsOf(data: RolesData, changes: MatrixCellChange[]): ChangeGroup[] {
  return data.groups
    .map((g) => ({
      name: g.name,
      items: g.permissions.flatMap((p) => {
        const c = changes.find((x) => x.key === p.key);
        return c ? [{ key: p.key, label: p.label, allowed: c.allowed }] : [];
      }),
    }))
    .filter((g) => g.items.length > 0);
}

function RoleBlock({
  name,
  system,
  names,
  peopleCount,
  warn,
  groups,
}: {
  name: string;
  system: string;
  names: string[];
  peopleCount: number;
  warn: boolean;
  groups: ChangeGroup[];
}) {
  const who =
    peopleCount === 0
      ? 'no one holds it yet'
      : (holderNames(names, peopleCount) ?? (peopleCount === 1 ? '1 person' : `${peopleCount} people`));
  return (
    <section aria-label={name} className="flex flex-col">
      <div className="mx-6 flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5">
        {names.length > 0 && (
          <span className="flex -space-x-1.5">
            {names.slice(0, 3).map((person) => (
              <InitialsTile key={person} name={person} className="ring-2 ring-background" />
            ))}
          </span>
        )}
        <span className="min-w-0 text-small text-foreground">
          <strong className="font-semibold">{name}</strong> · {who}
        </span>
      </div>
      {warn && (
        <p className="mx-6 mt-2 flex items-start gap-2 text-small text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {name} can manage the team and change settings in {system}.
        </p>
      )}
      <div className="mt-3 border-y border-divider">
        {groups.map((g) => (
          <GroupFold key={g.name} group={g} />
        ))}
      </div>
    </section>
  );
}

function GroupFold({ group }: { group: ChangeGroup }) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const added = group.items.filter((i) => i.allowed).length;
  const removed = group.items.length - added;
  return (
    <div className="border-b border-divider last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2.5 px-6 py-2.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted-strong transition-transform duration-(--duration-fold) ease-enter motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
        <span className="flex-1 text-body font-semibold text-foreground">{group.name}</span>
        {added > 0 && (
          <span className="font-mono text-caption text-success">
            <span className="sr-only">allowed </span>+{added}
          </span>
        )}
        {removed > 0 && (
          <span className="font-mono text-caption text-error">
            <span className="sr-only">taken away </span>−{removed}
          </span>
        )}
      </button>
      <div id={bodyId} className="fold" data-open={open || undefined} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-0.5 pr-6 pb-2.5 pl-12">
            {group.items.map((item) => (
              <li key={item.key} className="flex gap-2.5 py-0.5 text-small">
                <span aria-hidden="true" className={cn('w-2.5 font-mono', item.allowed ? 'text-success' : 'text-error')}>
                  {item.allowed ? '+' : '−'}
                </span>
                <span className={item.allowed ? 'text-foreground' : 'text-muted-strong'}>
                  <span className="sr-only">{item.allowed ? 'Allowed: ' : 'Taken away: '}</span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
