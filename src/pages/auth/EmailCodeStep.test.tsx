import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailCodeStep from './EmailCodeStep';
import { api } from '../../lib/api';
import { CODE_EXPIRED_MESSAGE, type EmailStep } from '../../lib/auth';

vi.mock('../../lib/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: { post: vi.fn(), get: vi.fn() },
}));

// jsdom has no layout; input-otp measures its field with these
if (!document.elementFromPoint) document.elementFromPoint = () => null;
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const post = vi.mocked(api.post);
const STEP: EmailStep = {
  status: 'EMAIL_VERIFICATION_REQUIRED',
  challengeId: 'c'.repeat(43),
  email: 'state.unverified@welinc.com',
  resendAfter: 3,
};
const ANSWER = { user: { id: 'u1', name: 'Bong', email: STEP.email, picture: null }, systems: [] };

const failure = (data: Record<string, unknown>, status = 400) => ({ response: { status, data } });

function setup(step: EmailStep = STEP) {
  const onSignedIn = vi.fn();
  const onBack = vi.fn();
  render(<EmailCodeStep step={step} onSignedIn={onSignedIn} onBack={onBack} />);
  return { onSignedIn, onBack, field: screen.getByLabelText(/^Code/) as HTMLInputElement };
}

beforeEach(() => {
  post.mockClear();
  post.mockImplementation(() => Promise.resolve({ data: ANSWER }));
});
afterEach(() => vi.useRealTimers());

describe('EmailCodeStep (spec 0009)', () => {
  // covers: AC-25
  it('says where the code went and disables Verify until six digits are in', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(STEP.email)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  // covers: AC-26
  it('is one real numeric one time code input, labelled, with focus in it', () => {
    const { field } = setup();
    expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveFocus();
  });

  // covers: AC-26
  it('takes digits only', async () => {
    const user = userEvent.setup();
    const { field } = setup();
    await user.type(field, '12ab34');
    expect(field).toHaveValue('1234');
  });

  // covers: AC-25, AC-9
  it('submits on the 6th digit with the ticket, and hands the answer on', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: ANSWER });
    const { field, onSignedIn } = setup();
    await user.type(field, '123456');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ANSWER));
    expect(post).toHaveBeenCalledWith('/auth/login/verify-email', {
      challengeId: STEP.challengeId,
      code: '123456',
    });
  });

  // covers: AC-26
  it('fills every box when six digits are pasted', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: ANSWER });
    const { field } = setup();
    await user.click(field);
    await user.paste('654321');
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ code: '654321' });
  });

  // covers: AC-25, AC-4, AC-26
  it('announces a wrong code with the tries left, clears the boxes and refocuses', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => Promise.reject(failure({ code: 'INVALID_CODE', attemptsLeft: 4 })));
    const { field } = setup();
    await user.type(field, '000000');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("That code isn't right. 4 tries left.");
    await waitFor(() => expect(field).toHaveValue(''));
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  // covers: AC-25
  it('uses the singular for the last try', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => Promise.reject(failure({ code: 'INVALID_CODE', attemptsLeft: 1 })));
    const { field } = setup();
    await user.type(field, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('1 try left.');
  });

  // covers: AC-25
  it('goes back to the password step with the expired message when the code is dead', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => Promise.reject(failure({ code: 'CODE_EXPIRED' })));
    const { field, onBack } = setup();
    await user.type(field, '000000');
    await waitFor(() => expect(onBack).toHaveBeenCalledWith(CODE_EXPIRED_MESSAGE));
  });

  // covers: AC-25
  it('goes back with no message from "Use a different account"', async () => {
    const user = userEvent.setup();
    const { onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(onBack).toHaveBeenCalledWith();
  });

  // covers: AC-25, AC-10
  it('counts the Resend wait down from resendAfter, then sends a new code on the same ticket', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => Promise.resolve({ data: { resendAfter: 60 } }));
    setup({ ...STEP, resendAfter: 1 });
    expect(screen.getByRole('button', { name: /Resend code in 1 s/ })).toBeDisabled();
    const ready = await screen.findByRole('button', { name: 'Resend code' }, { timeout: 3000 });
    expect(ready).toBeEnabled();
    await user.click(ready);
    expect(post).toHaveBeenCalledWith('/auth/login/verify-email/resend', { challengeId: STEP.challengeId });
    expect(await screen.findByText(/We sent a new code/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend code in 60 s/ })).toBeDisabled();
  });

  // covers: AC-25, AC-10
  it('shows the send limit message when a resend is refused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    post.mockImplementation(() => Promise.reject(failure({ code: 'MAIL_FAILED' }, 503)));
    setup({ ...STEP, resendAfter: 0 });
    await user.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your code. Try again in a minute.");
  });

  // covers: AC-25
  it('keeps the ticket out of the page and out of browser storage', async () => {
    const user = userEvent.setup();
    post.mockImplementation(() => Promise.reject(failure({ code: 'INVALID_CODE', attemptsLeft: 3 })));
    const { field } = setup();
    await user.type(field, '000000');
    await screen.findByRole('alert');
    expect(document.body.innerHTML).not.toContain(STEP.challengeId);
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(STEP.challengeId);
    expect(window.location.href).not.toContain(STEP.challengeId);
  });
});
