import type { EventCatalog, EventView } from '@/lib/adminApi';

/**
 * One event in an admin's words: the catalog's plain label, then why, who and where. Not
 * `labelAdmin`: that is the person's own view of an admin's action ("An admin sent you a code"),
 * wrong here because the admin reading is not the person, and the "By …" part already names the actor.
 */
export function describeEvent(event: EventView, catalog: EventCatalog | null) {
  const type = catalog?.types.find((t) => t.code === event.type);
  const reason = event.reason ? (catalog?.reasons.find((r) => r.code === event.reason)?.label ?? event.reason) : null;
  const by =
    event.actor.kind === 'SELF'
      ? 'By the person'
      : event.actor.kind === 'ADMIN'
        ? `By ${event.actor.name ?? 'an admin'}`
        : 'By WeLinc';
  const label = type?.label ?? event.type;
  return {
    label,
    // A reason that only repeats the label ("Signed out · Signed out") adds nothing
    details: [reason === label ? null : reason, by, event.system, event.device].filter(Boolean).join(' · '),
  };
}
