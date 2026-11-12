/** Suite spec 0013: a written reason is 10 to 500 characters once trimmed (AC-1, AC-2, AC-9). */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function reasonProblem(reason: string): string | null {
  const length = reason.trim().length;
  return length < REASON_MIN || length > REASON_MAX
    ? `Write a reason of ${REASON_MIN} to ${REASON_MAX} characters. Other admins read it.`
    : null;
}
