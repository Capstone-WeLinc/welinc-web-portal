import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonForm } from './PersonForm';

afterEach(cleanup);

const ROLES = [
  { code: 'MECHANIC', name: 'Mechanic', description: 'Works tickets.', isSystemAdmin: false },
  { code: 'ADMIN', name: 'Admin', description: 'Runs the system.', isSystemAdmin: true },
];
const INITIAL = { name: 'Ana Cruz', email: 'ana@welinc.com', role: 'MECHANIC' };

function setup(props: { emailLocked?: boolean; submitting?: boolean; initial?: typeof INITIAL } = {}) {
  const onSubmit = vi.fn();
  render(
    <PersonForm
      id="p"
      system="VRMS"
      roles={ROLES as never}
      initial={props.initial ?? INITIAL}
      submitting={props.submitting ?? false}
      serverError=""
      emailLocked={props.emailLocked}
      onSubmit={onSubmit}
      footer={<button type="submit">Save</button>}
    />,
  );
  return { onSubmit, email: screen.getByLabelText(/^Email/) as HTMLInputElement };
}

describe('PersonForm emailLocked (suite spec 0013)', () => {
  // covers: AC-16
  it('keeps the email editable by default', async () => {
    const user = userEvent.setup();
    const { email } = setup();
    expect(email).toBeEnabled();
    await user.clear(email);
    await user.type(email, 'new@welinc.com');
    expect(email).toHaveValue('new@welinc.com');
  });

  // covers: AC-16
  it('locks the email on your own page but leaves the name editable', () => {
    const { email } = setup({ emailLocked: true });
    expect(email).toBeDisabled();
    expect(email).toHaveValue(INITIAL.email);
    expect(screen.getByLabelText(/^Name/)).toBeEnabled();
  });

  // covers: AC-16
  it('still submits the unchanged email when it is locked', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ emailLocked: true });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(INITIAL);
  });

  it('disables the email while submitting even when not locked', () => {
    const { email } = setup({ submitting: true });
    expect(email).toBeDisabled();
  });
});
