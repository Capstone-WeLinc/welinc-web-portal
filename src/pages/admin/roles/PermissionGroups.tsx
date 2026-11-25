import { useId, useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { PermissionMatrix, RolesData } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { cellId, shownValue, type MatrixDraft } from '../permissions/matrixDraft';
import { groupSummary } from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-4 and AC-6: one role's permissions in catalog groups that fold.
 * The first group is open the first time a role opens (the parent remounts this per role). Each
 * row has its description under the label and a switch labelled by the label; a locked cell says
 * "Always on" or "Always off"; a changed row is marked "Not saved". A viewer who can't edit reads
 * "On" or "Off" instead of switches.
 */
export function PermissionGroups({
  data,
  matrix,
  role,
  draft,
  onToggle,
}: {
  data: RolesData;
  matrix: PermissionMatrix;
  role: string;
  draft: MatrixDraft;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(data.groups.slice(0, 1).map((g) => g.name)));
  const allOpen = data.groups.every((g) => open.has(g.name));

  const flip = (name: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(allOpen ? new Set() : new Set(data.groups.map((g) => g.name)))}
        >
          {allOpen ? 'Close all' : 'Open all'}
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-transparent bg-card shadow-card">
        {data.groups.map((group) => (
          <Group
            key={group.name}
            name={group.name}
            permissions={group.permissions}
            matrix={matrix}
            role={role}
            draft={draft}
            open={open.has(group.name)}
            onFlip={() => flip(group.name)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function Group({
  name,
  permissions,
  matrix,
  role,
  draft,
  open,
  onFlip,
  onToggle,
}: {
  name: string;
  permissions: RolesData['groups'][number]['permissions'];
  matrix: PermissionMatrix;
  role: string;
  draft: MatrixDraft;
  open: boolean;
  onFlip: () => void;
  onToggle: (key: string) => void;
}) {
  const bodyId = useId();
  const summary = groupSummary(matrix, draft, role, permissions);
  return (
    <section aria-label={name} className="border-t border-divider first:border-t-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onFlip}
          className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline gap-2.5">
              <span className="text-group text-foreground">{name}</span>
              <span className="font-mono text-caption text-muted-strong">
                {summary.allowed}/{summary.total}
              </span>
            </span>
            {!open && <span className="truncate text-small text-muted-foreground">{summary.preview}</span>}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fold) ease-enter motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>
      <div id={bodyId} className="fold" data-open={open || undefined} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <ul className="divide-y divide-divider border-t border-divider">
            {permissions.map((p) => (
              <Row
                key={p.key}
                label={p.label}
                description={p.description}
                locked={p.lockedRoles.includes(role)}
                value={shownValue(matrix, draft, role, p.key)}
                changed={draft[cellId(role, p.key)] !== undefined}
                editable={matrix.canEdit}
                onToggle={() => onToggle(p.key)}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  description,
  locked,
  value,
  changed,
  editable,
  onToggle,
}: {
  label: string;
  description: string;
  locked: boolean;
  value: boolean;
  changed: boolean;
  editable: boolean;
  onToggle: () => void;
}) {
  const labelId = useId();
  return (
    <li className={cn('flex items-center gap-4 px-5 py-3', changed && 'bg-draft-row')}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span id={labelId} className="text-body font-medium break-words text-foreground">
            {label}
          </span>
          {changed && (
            <span className="rounded-md bg-draft-tag px-1.5 py-0.5 text-caption text-draft-tag-foreground">
              Not saved
            </span>
          )}
        </p>
        <p className="text-small break-words text-muted-foreground">{description}</p>
      </div>
      {locked ? (
        <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-strong">
          <Lock className="size-4" aria-hidden="true" />
          {value ? 'Always on' : 'Always off'}
        </span>
      ) : editable ? (
        <Switch aria-labelledby={labelId} checked={value} onCheckedChange={onToggle} className="shrink-0" />
      ) : (
        <span className={cn('shrink-0 text-body', value ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {value ? 'On' : 'Off'}
        </span>
      )}
    </li>
  );
}
