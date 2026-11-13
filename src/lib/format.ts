/**
 * Dates as the suite shows them (design.md): `YYYY-MM-DD`, times 24 hour, in Asia/Manila so every
 * admin reads the same time whatever their device says.
 */
const DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  return `${DATE.format(at)} ${TIME.format(at)}`;
}

/** The time alone (`05:40`), for a short label whose date is shown nearby or is today. */
export function formatTime(iso: string): string {
  return TIME.format(new Date(iso));
}
