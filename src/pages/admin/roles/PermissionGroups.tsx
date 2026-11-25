import { useEffect, useId, useState } from "react";
import { ChevronRight, Lock, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Switch } from "@/components/ui/switch";
import type { PermissionMatrix, RolesData } from "@/lib/adminApi";
import { cn } from "@/lib/utils";
import {
  cellId,
  shownValue,
  type MatrixDraft,
} from "../permissions/matrixDraft";
import { filterGroups, groupSummary } from "./rolesRules";

const FILTER_DELAY_MS = 300;

/**
 * Suite spec 0018, child 0001 AC-4 and AC-6: one role's permissions in catalog groups that fold.
 * The first group is open the first time a role opens (the parent remounts this per role). Each
 * row has its description under the label and a switch labelled by the label; a locked cell says
 * "Always on" or "Always off"; a changed row is marked "Not saved". A viewer who can't edit reads
 * "On" or "Off" instead of switches. "Find a permission" (AC-5) keeps only matching rows and opens
 * their groups while it holds text; the folds underneath stay as they were, so clearing it brings
 * them back. The text lives here only, never in the address or the draft.
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
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(data.groups.slice(0, 1).map((g) => g.name)),
  );
  const allOpen = data.groups.every((g) => open.has(g.name));
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const filterId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), FILTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const filtering = q !== "";
  const groups = filterGroups(data.groups, q);
  const clear = () => {
    setText("");
    setQ("");
  };

  const flip = (name: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor={filterId} className="sr-only">
            Find a permission
          </label>
          <input
            id={filterId}
            type="search"
            placeholder="Find a permission"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim() === "") setQ("");
            }}
            className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-base-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden max-sm:h-11 md:text-body"
          />
        </div>
        {!filtering && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              setOpen(
                allOpen ? new Set() : new Set(data.groups.map((g) => g.name)),
              )
            }
          >
            {allOpen ? "Close all" : "Open all"}
          </Button>
        )}
      </div>
      {filtering && groups.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-2xl bg-card p-5 shadow-card"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-strong">
            <SearchX className="size-5" aria-hidden="true" />
          </span>
          <p className="text-body font-semibold break-words text-foreground">
            No permission matches “{q}”
          </p>
          <Button variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Group
              key={group.name}
              name={group.name}
              permissions={group.permissions}
              all={
                data.groups.find((g) => g.name === group.name)?.permissions ??
                group.permissions
              }
              matrix={matrix}
              role={role}
              draft={draft}
              open={filtering || open.has(group.name)}
              onFlip={() => (filtering ? undefined : flip(group.name))}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({
  name,
  permissions,
  all,
  matrix,
  role,
  draft,
  open,
  onFlip,
  onToggle,
}: {
  name: string;
  permissions: RolesData["groups"][number]["permissions"];
  /** The whole group, for "allowed/total" and the preview while the filter hides rows. */
  all: RolesData["groups"][number]["permissions"];
  matrix: PermissionMatrix;
  role: string;
  draft: MatrixDraft;
  open: boolean;
  onFlip: () => void;
  onToggle: (key: string) => void;
}) {
  const bodyId = useId();
  const summary = groupSummary(matrix, draft, role, all);
  return (
    <section
      aria-label={name}
      className="overflow-hidden rounded-2xl bg-card shadow-card"
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onFlip}
          className="flex min-h-14 w-full items-start gap-3 px-5 py-4 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "mt-0.75 size-4 shrink-0 text-muted-strong transition-transform duration-(--duration-fold) ease-enter motion-reduce:transition-none",
              open && "rotate-90",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-group text-foreground">{name}</span>
              <span aria-hidden="true" className="w-32 shrink-0 max-sm:w-24">
                <Meter value={summary.allowed} max={summary.total} label={`${name} allowed`} className="gap-2.5" />
              </span>
              <span className="sr-only">
                , {summary.allowed} of {summary.total} allowed
              </span>
            </span>
            {!open && (
              <span className="truncate text-small text-muted-foreground">
                {summary.preview}
              </span>
            )}
          </span>
        </button>
      </h3>
      <div
        id={bodyId}
        className="fold"
        data-open={open || undefined}
        inert={!open}
      >
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
    <li
      className={cn(
        "flex items-center gap-5 py-2.75 pr-5 pl-12 max-sm:pl-5",
        changed && "bg-draft-row",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span
            id={labelId}
            className="text-body font-medium break-words text-foreground"
          >
            {label}
          </span>
          {changed && (
            <span className="rounded-full bg-draft-tag px-2 py-0.5 text-caption font-semibold text-draft-tag-foreground">
              Not saved
            </span>
          )}
        </p>
        <p className="text-small break-words text-muted-foreground">
          {description}
        </p>
      </div>
      {locked ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-caption font-normal text-muted-strong">
          <Lock className="size-3" aria-hidden="true" />
          {value ? "Always on" : "Always off"}
        </span>
      ) : editable ? (
        <Switch
          aria-labelledby={labelId}
          checked={value}
          onCheckedChange={onToggle}
          className="shrink-0"
        />
      ) : (
        <span
          className={cn(
            "shrink-0 text-body",
            value ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {value ? "On" : "Off"}
        </span>
      )}
    </li>
  );
}
