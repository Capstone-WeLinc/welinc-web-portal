import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { AdminMe } from '@/lib/admin';
import {
  approveDeletion,
  errorMessage,
  graceAccounts,
  pendingDeletions,
  rejectDeletion,
  restorePerson,
  type DeletionRequest,
  type GraceItem,
  type Scope,
} from '@/lib/adminApi';
import { OrphanBadge } from '../people/Badges';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NoSystemScope, Segmented, SystemSwitcher, Toolbar, ViewEmpty, ViewError, ViewHeader } from '../AdminStates';
import { useAdminScope } from '../useAdminSystem';
import { Cell, DataTable, Muted, PersonCell, Row } from '../AdminTable';
import { useAsync } from '../useAsync';

type Tab = 'pending' | 'grace';

/** Spec 0012: a reject note is required, 5 to 500 characters. */
export const NOTE_MIN = 5;
export const NOTE_MAX = 500;

/**
 * Suite spec 0013, AC-23: deletion requests waiting for this system's admins, and accounts in
 * their grace period (spec 0012). Any one admin of the person's systems decides.
 */
export function DeletionRequestsView({ me }: { me: AdminMe }) {
  const scope = useAdminScope(me);
  const system = scope.kind === 'ok' ? scope.system : null;
  const key = system ?? 'all';
  const [tab, setTab] = useState<Tab>('pending');

  return (
    <>
      <ViewHeader
        title="Deletion requests"
        context="Requests to delete an account, and deleted accounts you can still restore."
      />
      {scope.kind !== 'none' && (
        <Toolbar>
          <SystemSwitcher
            value={system}
            choices={scope.choices}
            onChange={scope.choose}
            allowAll={scope.kind === 'ok' && scope.allowAll}
          />
          {scope.kind === 'ok' && (
            <Segmented
              label="Deletion views"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'pending', label: 'Waiting for a decision' },
                { value: 'grace', label: 'Deleted, can restore' },
              ]}
            />
          )}
        </Toolbar>
      )}
      {scope.kind === 'none' && <NoSystemScope />}
      {scope.kind === 'not-admin' && <NoSystemScope asked={scope.asked} />}
      {scope.kind === 'ok' && (
        <>
          {tab === 'pending' ? <PendingList key={key} system={system} /> : <GraceList key={key} system={system} />}
        </>
      )}
    </>
  );
}

function PendingList({ system }: { system: Scope }) {
  const [attempt, setAttempt] = useState(0);
  const [rejecting, setRejecting] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { state, replace } = useAsync(`${system ?? 'all'}|${attempt}`, async () => (await pendingDeletions(system)).data);

  const drop = (id: string) => replace((current) => current.filter((r) => r.id !== id));

  const approve = async (request: DeletionRequest) => {
    setBusy(request.id);
    try {
      await approveDeletion(request.id, system);
      notifySuccess(`${request.user?.name ?? 'The account'} is deleted. You can restore it during the grace period.`);
      drop(request.id);
    } catch (err) {
      notifyError(errorMessage(err, "We couldn't approve this request."));
    } finally {
      setBusy(null);
    }
  };

  if (state.kind === 'error') {
    return (
      <ViewError
        kind="tile"
        subject="people"
        message={errorMessage(state.error, "We couldn't load the requests.")}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  if (state.kind === 'loading') return <ListSkeleton />;
  const rows = state.value;
  if (rows.length === 0) {
    return <ViewEmpty icon={<Inbox className="size-5" aria-hidden="true" />} message="No requests are waiting." />;
  }
  return (
    <>
      <DataTable
        columns={[
          { label: 'Person' },
          { label: 'Reason' },
          { label: 'Asked' },
          { label: <span className="sr-only">Actions</span>, align: 'end' },
        ]}
      >
        {rows.map((request) => (
          <Row key={request.id}>
            <Cell>
              <PersonCell
                name={
                  request.user ? (
                    <Link
                      to={personLink(request.user.id, system ?? request.user.systems[0])}
                      className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      {request.user.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
                email={request.user?.email}
                extra={request.orphan && <OrphanBadge />}
              />
            </Cell>
            <Cell className="max-w-md">
              <p className="break-words text-foreground">
                {request.reason ? `"${request.reason}"` : <span className="text-muted-foreground">No reason given.</span>}
              </p>
            </Cell>
            <Cell className="whitespace-nowrap">
              <Muted>{formatDateTime(request.requestedAt)}</Muted>
            </Cell>
            <Cell align="end">
              <div className="inline-flex gap-2">
                <Button variant="outline" disabled={busy !== null} onClick={() => setRejecting(request)}>
                  Reject
                </Button>
                <Button loading={busy === request.id} disabled={busy !== null} onClick={() => void approve(request)}>
                  Approve
                </Button>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <RejectDialog
        request={rejecting}
        system={system}
        onClose={() => setRejecting(null)}
        onRejected={(id) => {
          setRejecting(null);
          drop(id);
        }}
      />
    </>
  );
}

function RejectDialog({
  request,
  system,
  onClose,
  onRejected,
}: {
  request: DeletionRequest | null;
  system: Scope;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const length = note.trim().length;

  const submit = async () => {
    if (!request) return;
    if (length < NOTE_MIN || length > NOTE_MAX) {
      setError(`Write a note of ${NOTE_MIN} to ${NOTE_MAX} characters. The person reads it.`);
      return;
    }
    setBusy(true);
    try {
      await rejectDeletion(request.id, system, note.trim());
      notifySuccess(`We told ${request.user?.name ?? 'them'} the request was rejected.`);
      setNote('');
      onRejected(request.id);
    } catch (err) {
      setError(errorMessage(err, "We couldn't reject this request."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (open || busy) return;
        setNote('');
        setError('');
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject {request?.user?.name ?? 'this request'}?</AlertDialogTitle>
          <AlertDialogDescription>Their account stays as it is. We email them your note.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reject-note">
            Note to the person <span aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="reject-note"
            value={note}
            maxLength={NOTE_MAX}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="reject-note-help"
          />
          <p id="reject-note-help" className={cn('text-caption tabular-nums', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error || `${length} of ${NOTE_MAX} characters`}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {busy ? 'Rejecting' : 'Reject request'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GraceList({ system }: { system: Scope }) {
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const { state, replace } = useAsync(`${system ?? 'all'}|${attempt}`, async () => (await graceAccounts(system)).data);

  const restore = async (item: GraceItem) => {
    setBusy(item.user.id);
    try {
      await restorePerson(item.user.id, system);
      notifySuccess(`${item.user.name} is back, still inactive. Reactivate them on their page.`);
      replace((current) => current.filter((r) => r.user.id !== item.user.id));
    } catch (err) {
      notifyError(errorMessage(err, "We couldn't restore this account."));
    } finally {
      setBusy(null);
    }
  };

  if (state.kind === 'error') {
    return (
      <ViewError
        kind="tile"
        subject="people"
        message={errorMessage(state.error, "We couldn't load deleted accounts.")}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  if (state.kind === 'loading') return <ListSkeleton />;
  const rows = state.value;
  if (rows.length === 0) {
    return <ViewEmpty icon={<Inbox className="size-5" aria-hidden="true" />} message="No deleted accounts to restore." />;
  }
  return (
    <DataTable
      columns={[
        { label: 'Person' },
        { label: 'Deleted' },
        { label: 'Erased for good' },
        { label: <span className="sr-only">Actions</span>, align: 'end' },
      ]}
    >
      {rows.map((item) => (
        <Row key={item.user.id}>
          <Cell>
            <PersonCell name={item.user.name} email={item.user.email} extra={item.orphan && <OrphanBadge />} />
          </Cell>
          <Cell className="whitespace-nowrap">
            <Muted>
              <span className="md:hidden">Deleted </span>
              {formatDate(item.deletedAt)}
            </Muted>
          </Cell>
          <Cell className="whitespace-nowrap">
            <Muted>
              <span className="md:hidden">Erased for good on </span>
              {formatDate(item.eraseAfter)}
            </Muted>
          </Cell>
          <Cell align="end">
            <Button
              variant="outline"
              loading={busy === item.user.id}
              disabled={busy !== null}
              onClick={() => void restore(item)}
            >
              Restore
            </Button>
          </Cell>
        </Row>
      ))}
    </DataTable>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">Loading</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

/** The person page, in a system when there is one to act in. */
function personLink(id: string, system: string | undefined): string {
  return system ? `/admin/people/${id}?system=${system}` : `/admin/people/${id}`;
}
