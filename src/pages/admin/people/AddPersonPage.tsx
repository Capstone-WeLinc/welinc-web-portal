import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRoundCheck } from 'lucide-react';
import { notifySuccess } from '@/lib/notify';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorCode, type AdminMe, type SystemCode } from '@/lib/admin';
import { createPerson, errorMessage, ReauthCancelled, type CreatePersonInput } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { NoSystemScope, ViewHeader } from '../AdminStates';
import { useSystemsCatalog } from '../useCatalogs';
import { useAdminSystem } from '../useAdminSystem';
import { PersonForm, SubmitRow } from './PersonForm';
import type { PersonFormValues } from './personValues';

/** 409 `ACCOUNT_EXISTS`: the email has a WeLinc account outside this system (spec 0011, AC-30). */
type Existing = { id: string; name: string; systems: SystemCode[]; input: CreatePersonInput };

function existingAccount(error: unknown, input: CreatePersonInput): Existing | null {
  if (errorCode(error) !== 'ACCOUNT_EXISTS') return null;
  const data = (error as { response?: { data?: { id?: string; name?: string; systems?: SystemCode[] } } }).response
    ?.data;
  if (!data?.id) return null;
  return { id: data.id, name: data.name ?? '', systems: data.systems ?? [], input };
}

/**
 * Suite spec 0013, AC-23: `/admin/people/new?system=VRMS`, the deep link VRMS's Add user opens.
 * A new account gets a setup code by email; an email that already has an account offers to add
 * this system's role to it instead.
 */
export function AddPersonPage({ me }: { me: AdminMe }) {
  const scope = useAdminSystem(me);
  if (scope.kind === 'none') return <NoSystemScope />;
  if (scope.kind === 'not-admin') return <NoSystemScope asked={scope.asked} />;
  return <AddPerson system={scope.system} />;
}

function AddPerson({ system }: { system: SystemCode }) {
  const navigate = useNavigate();
  const catalog = useSystemsCatalog();
  const roles = catalog?.find((s) => s.code === system)?.roles ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [existing, setExisting] = useState<Existing | null>(null);

  const save = async (input: CreatePersonInput) => {
    setSubmitting(true);
    setServerError('');
    try {
      const person = await createPerson(input);
      notifySuccess(
        input.attachExisting
          ? `${person.name} now has a ${system} role.`
          : person.setupEmailSent === false
            ? `${person.name} was added, but the setup email didn't go out. Send a setup code from their page.`
            : `${person.name} was added. They got an email to set their password.`,
      );
      navigate(`/admin/people/${person.id}?system=${system}`, { replace: true });
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ReauthCancelled) return;
      const found = existingAccount(error, input);
      if (found) {
        setExisting(found);
        return;
      }
      setServerError(errorMessage(error, "We couldn't add this person. Try again."));
    }
  };

  const fromForm = (values: PersonFormValues): CreatePersonInput => ({
    system,
    name: values.name,
    email: values.email,
    roleAssignments: [{ role: values.role, system }],
  });

  return (
    <>
      <BackToPeople system={system} />
      <ViewHeader title="Add person" context={`They get a ${system} role and an email to set their password.`} />
      {existing ? (
        <AttachExisting
          existing={existing}
          system={system}
          submitting={submitting}
          serverError={serverError}
          onAttach={() => void save({ ...existing.input, attachExisting: true })}
          onBack={() => {
            setExisting(null);
            setServerError('');
          }}
        />
      ) : roles ? (
        <div className="max-w-lg">
          <PersonForm
            id="add-person"
            system={system}
            roles={roles}
            initial={{ name: '', email: '', role: '' }}
            submitting={submitting}
            serverError={serverError}
            onSubmit={(values) => void save(fromForm(values))}
            footer={<SubmitRow form="add-person" label="Add person" busyLabel="Adding" submitting={submitting} />}
          />
        </div>
      ) : (
        <div aria-busy="true" className="flex max-w-lg flex-col gap-4">
          <span className="sr-only">Loading the form</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      )}
    </>
  );
}

function AttachExisting({
  existing,
  system,
  submitting,
  serverError,
  onAttach,
  onBack,
}: {
  existing: Existing;
  system: SystemCode;
  submitting: boolean;
  serverError: string;
  onAttach: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-strong">
          <UserRoundCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-body font-medium break-words text-foreground">
            {existing.input.email} already has a WeLinc account
            {existing.name ? ` (${existing.name})` : ''}.
          </p>
          <p className="mt-1 text-body text-muted-foreground">
            {existing.systems.length > 0 ? `It is used in ${existing.systems.join(', ')}. ` : ''}
            You can add the {system} role to that account. Their name and password stay as they are.
          </p>
        </div>
      </div>
      {serverError && (
        <p role="alert" className="text-body text-destructive">
          {serverError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="touch" className="md:h-10" disabled={submitting} onClick={onBack}>
          Change the email
        </Button>
        <Button size="touch" className="md:h-10" loading={submitting} onClick={onAttach}>
          {submitting ? 'Adding' : `Add the ${system} role`}
        </Button>
      </div>
    </div>
  );
}

export function BackToPeople({ system }: { system: SystemCode }) {
  return (
    <Link
      to={`/admin/people?system=${system}`}
      className={cn(buttonVariants({ variant: 'ghost' }), 'mb-2 -ml-3 min-h-11 md:min-h-9')}
    >
      <ArrowLeft aria-hidden="true" />
      All people
    </Link>
  );
}
