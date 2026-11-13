import { CalendarCheck, Truck, Wrench, type LucideIcon } from 'lucide-react';

/** A fixed icon per system code (spec 0007, AC-15); callers pick their own fallback. */
export const SYSTEM_ICONS: Record<string, LucideIcon> = { BMS: CalendarCheck, VMMS: Truck, VRMS: Wrench };
