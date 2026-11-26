import { useEffect, useId, useState } from 'react';
import { ArrowRight, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addRoleMembers,
  errorMessage,
  listPeople,
  ReauthCancelled,
  type ManagedPerson,
  type RoleSummary,
  type RolesData,
} from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { ViewError } from '../AdminStates';
import { candidateRole, movedWords } from './rolesRules';
import { usePaged } from './usePaged';

const SEARCH_DELAY_MS = 300;

/**
 * Suite spec 0018, child 0001 AC-14: "Add people to [role]". Candidates come from the server
 * (people in the system who don't hold the role, never the viewer or a suite admin, by name, 25
 * at a time). Several can be picked; Save moves them all or none through the members route. The
 * admin role asks for the password first (`withReauth` on `REAUTH_REQUIRED`, before anyone moves).
 */
export function AddPeopleDialog({
  open,
  data,
  role,
  onClose,
  onMoved,
}: {
  open: boolean;
  data: RolesData;
  role: RoleSummary;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      {open && <AddPeopleBody data={data} role={role} busy={busy} setBusy={setBusy} onClose={onClose} onMoved={onMoved} />}
    </Dialog>
  );
}

function AddPeopleBody({
  data,
  role,
  busy,
  setBusy,
  onClose,
  onMoved,
}: {
  data: RolesData;
  role: RoleSummary;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Map<string, ManagedPerson>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const candidates = usePaged<ManagedPerson>(`${data.system}|${role.code}|${q}`, (cursor) =>
    listPeople({
      system: data.system,
      q: q || undefined,
      excludeRole: role.code,
      assignable: true,
      sort: 'name',
      limit: 25,
      cursor,
    }),
  );

  const flip = (person: ManagedPerson) =>
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { moved } = await addRoleMembers(data.system, role.code, [...picked.keys()]);
      notifySuccess(movedWords(moved, role.name));
      setBusy(false);
      onMoved();
    } catch (e) {
      setBusy(false);
      if (e instanceof ReauthCancelled) return;
      setError(errorMessage(e, `We couldn't move these people into ${role.name}. Nobody was moved.`));
    }
  };

  const count = picked.size;
  return (
    <DialogContent className="flex flex-col sm:max-w-xl" onEscapeKeyDown={(e) => busy && e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Add people to {role.name}</DialogTitle>
        <DialogDescription>
          Their role in {data.system} becomes {role.name}. People who hold it already aren't listed.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor={searchId} className="sr-only">
          Find people by name or email
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="Find people by name or email"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-base-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11 md:text-body"
        />
      </div>

      <div className="-mx-2 min-h-40 flex-1 overflow-y-auto px-2">
        {candidates.state.kind === 'loading' && (
          <div aria-busy="true" className="flex flex-col gap-2 py-2">
            <span className="sr-only">Loading people</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {candidates.state.kind === 'error' && (
          <ViewError
            kind="tile"
            subject="people"
            message={errorMessage(candidates.state.error, "We couldn't load the people.")}
            onRetry={candidates.retry}
          />
        )}
        {candidates.state.kind === 'ready' && candidates.state.value.items.length === 0 && (
          <div role="status" className="flex flex-col items-start gap-2 py-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <p className="text-body text-muted-foreground">
              {q ? `No one in ${data.system} matches “${q}”.` : `Everyone in ${data.system} you can move has ${role.name} already.`}
            </p>
          </div>
        )}
        {candidates.state.kind === 'ready' && candidates.state.value.items.length > 0 && (
          <ul aria-label="People you can add" className="flex flex-col py-1">
            {candidates.state.value.items.map((person) => (
              <li key={person.id}>
                <Candidate
                  person={person}
                  data={data}
                  role={role}
                  checked={picked.has(person.id)}
                  disabled={busy}
                  onFlip={() => flip(person)}
                />
              </li>
            ))}
          </ul>
        )}
        {candidates.state.kind === 'ready' && candidates.state.value.next && (
          <div className="flex flex-col items-start gap-2 py-2">
            <Button variant="outline" size="sm" onClick={() => void candidates.loadMore()} disabled={candidates.busy}>
              {candidates.busy ? 'Loading…' : 'Load more'}
            </Button>
            {candidates.failed && (
              <p role="alert" className="text-small text-destructive">
                We couldn't load more people. Try again.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-small text-error">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy || count === 0}>
          {busy ? 'Moving…' : count === 0 ? 'Add people' : count === 1 ? 'Add 1 person' : `Add ${count} people`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Candidate({
  person,
  data,
  role,
  checked,
  disabled,
  onFlip,
}: {
  person: ManagedPerson;
  data: RolesData;
  role: RoleSummary;
  checked: boolean;
  disabled: boolean;
  onFlip: () => void;
}) {
  const id = useId();
  const current = candidateRole(person, data.system, data.roles);
  const temporary = current.temporaryUntil !== null;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 transition-colors',
        temporary ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-accent',
        checked && 'bg-info-bg hover:bg-info-bg',
      )}
    >
      <Checkbox id={id} checked={checked} disabled={disabled || temporary} onCheckedChange={onFlip} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-foreground">{person.name}</span>
        <span className="truncate text-small text-muted-foreground">{person.email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground max-sm:basis-full max-sm:pl-7.5">
        {temporary ? (
          <>
            Until <span className="font-mono">{formatDate(current.temporaryUntil!)}</span> · temporary, can't be moved
          </>
        ) : checked ? (
          <>
            {current.name}
            <ArrowRight className="size-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">{role.name}</span>
          </>
        ) : (
          current.name
        )}
      </span>
    </label>
  );
}
