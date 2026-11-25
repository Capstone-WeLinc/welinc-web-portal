import type { RolesData } from '@/lib/adminApi';
import { csvFileName, rolesCsv } from './rolesRules';

/**
 * Suite spec 0018, child 0001 AC-16: the spreadsheet download, built in the browser from the
 * saved data (never the draft). UTF-8 with a byte order mark so spreadsheets read the accents.
 * Runs from a click handler with an object URL.
 */
export function downloadRolesCsv(data: RolesData, now = new Date()): void {
  const blob = new Blob(['﻿', rolesCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName(data.system, now);
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has handed the file to the browser
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
