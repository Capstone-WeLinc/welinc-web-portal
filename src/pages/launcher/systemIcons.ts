import { CalendarCheck, Truck, Wrench, type LucideIcon } from 'lucide-react';

/** A fixed icon per system code (spec 0007, AC-15); callers pick their own fallback. */
export const SYSTEM_ICONS: Record<string, LucideIcon> = { BMS: CalendarCheck, VMMS: Truck, VRMS: Wrench };

/**
 * Suite spec 0019, AC-2 (board `R30Launcher`): each system's one line on its launcher card and in
 * the system switcher. BMS is about bookings (not dispatch), VMMS maintenance, VRMS repair.
 */
export const SYSTEM_LINES: Record<string, string> = {
  BMS: 'Bookings, trips and drivers',
  VMMS: 'Maintenance schedules and fleet upkeep',
  VRMS: 'Repair tickets, mechanics and workshop work',
};
