// Subsystem URL map — update these env vars for production
export const SUBSYSTEMS = {
  VRMS: {
    name: 'Vehicle Repair & Maintenance (VRMS)',
    url: import.meta.env.VITE_VRMS_URL || 'http://localhost:8001',
    color: 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400',
    iconColor: 'bg-blue-500 text-brand-dark',
  },
  VMMS: {
    name: 'Vehicle Monitoring & Maintenance (VMMS)',
    url: import.meta.env.VITE_VMMS_URL || 'http://localhost:8002',
    color: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400',
    iconColor: 'bg-emerald-500 text-brand-dark',
  },
  BMS: {
    name: 'Booking & Operations (BMS)',
    url: import.meta.env.VITE_BMS_URL || 'http://localhost:8003',
    color: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400',
    iconColor: 'bg-amber-500 text-brand-dark',
  },
};
