import { errorCode } from './admin';
import { errorMessage } from './adminApi';

/** What the password check answered, in the dialog's words. */
export function reauthFailure(error: unknown): string {
  switch (errorCode(error)) {
    case 'WRONG_PASSWORD': {
      const left = (error as { response?: { data?: { attemptsLeft?: number } } }).response?.data?.attemptsLeft;
      return typeof left === 'number'
        ? `That password is not right. ${left} ${left === 1 ? 'try' : 'tries'} left before your account locks.`
        : 'That password is not right.';
    }
    case 'ACCOUNT_LOCKED':
      return 'Your account is locked after too many tries. Ask another admin to unlock it.';
    case 'RATE_LIMITED':
      return 'Too many password checks. Wait a minute and try again.';
    default:
      return errorMessage(error, "We couldn't check your password. Try again.");
  }
}
