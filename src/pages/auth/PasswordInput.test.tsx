import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PasswordInput } from './PasswordInput';

// covers: the sign in panel's Caps Lock line (suite spec 0019 sweep, your call on 2026-11-26)

function Field() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="pw">Password</label>
      <PasswordInput id="pw" value={value} onChange={setValue} autoComplete="current-password" />
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('PasswordInput Caps Lock line', () => {
  it('says Caps Lock is on while typing with it on, and goes when it is off or the field loses focus', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('aria-describedby', 'pw-caps');

    await user.click(field);
    await user.keyboard('a');
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();

    await user.keyboard('{CapsLock}b');
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();

    await user.keyboard('{CapsLock}c');
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();

    await user.keyboard('{CapsLock}d');
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });
});
