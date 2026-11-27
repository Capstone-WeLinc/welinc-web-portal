import { useEffect, useState } from 'react';
import { fetchEventCatalog, fetchSystems, type CatalogSystem, type EventCatalog } from '@/lib/adminApi';

// The two public catalogs change only with a deploy, so one fetch per page load is enough. A
// failed fetch is forgotten, so the next view to ask tries again.
let systemsOnce: Promise<CatalogSystem[]> | null = null;
let eventsOnce: Promise<EventCatalog> | null = null;

function once<T>(get: () => Promise<T> | null, set: (p: Promise<T> | null) => void, load: () => Promise<T>) {
  const existing = get();
  if (existing) return existing;
  const next = load().catch((error: unknown) => {
    set(null);
    throw error;
  });
  set(next);
  return next;
}

/**
 * Suite spec 0018, child 0002 AC-28: a create, rename or delete changes the role list, so the
 * next view that asks reads `/auth/systems` again (it revalidates with its ETag, AC-29).
 */
export function refreshSystemsCatalog(): void {
  systemsOnce = null;
}

/** `GET /auth/systems`: every system with its roles in display order (spec 0004). */
export function useSystemsCatalog(): CatalogSystem[] | null {
  const [systems, setSystems] = useState<CatalogSystem[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    once(() => systemsOnce, (p) => (systemsOnce = p), fetchSystems)
      .then((next) => !cancelled && setSystems(next))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return systems;
}

/** `GET /auth/activity/catalog`: labels for event types and reasons (spec 0011, AC-15). */
export function useEventCatalog(): EventCatalog | null {
  const [catalog, setCatalog] = useState<EventCatalog | null>(null);
  useEffect(() => {
    let cancelled = false;
    once(() => eventsOnce, (p) => (eventsOnce = p), fetchEventCatalog)
      .then((next) => !cancelled && setCatalog(next))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

/** Role code to display name for one system. */
export function roleNames(systems: CatalogSystem[] | null, system: string): Map<string, string> {
  const found = systems?.find((s) => s.code === system);
  return new Map(found?.roles.map((r) => [r.code, r.name]) ?? []);
}
