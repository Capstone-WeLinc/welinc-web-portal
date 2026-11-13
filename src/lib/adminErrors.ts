import { errorCode } from './admin';
import { errorMessage } from './adminApi';

/** What the password check answered, in the dialog's words. */
export function reauthFailure(error: unknown): string {
  switch (errorCode(error)) {
    case 'WRONG_PASSWORD': {
      const left = (error as { response?: { data?: { attemptsLeft?: number } } }).response?.data?.attemptsLeft;
      return typeof left === 'number'
        ? `That password is not right. ${left} ${left === 1 ? 'try' : 'tries'} left before a 15 minute lock.`
        : 'That password is not right.';
    }
    case 'ACCOUNT_LOCKED':
      return 'Too many wrong passwords, so your account is locked for 15 minutes. Try again then, or ask another admin to unlock it.';
    case 'RATE_LIMITED':
      return 'Too many password checks. Wait a minute and try again.';
    default:
      return errorMessage(error, "We couldn't check your password. Try again.");
  }
}
