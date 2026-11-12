import type { EventCatalog, EventView } from '@/lib/adminApi';

/** One event in an admin's words: the catalog's admin label, then why, who and where. */
export function describeEvent(event: EventView, catalog: EventCatalog | null) {
  const type = catalog?.types.find((t) => t.code === event.type);
  const reason = event.reason ? (catalog?.reasons.find((r) => r.code === event.reason)?.label ?? event.reason) : null;
  const by =
    event.actor.kind === 'SELF'
      ? 'By the person'
      : event.actor.kind === 'ADMIN'
        ? `By ${event.actor.name ?? 'an admin'}`
        : 'By WeLinc';
  return {
    label: type?.labelAdmin ?? event.type,
    details: [reason, by, event.system, event.device].filter(Boolean).join(' · '),
  };
}
