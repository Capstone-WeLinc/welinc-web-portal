import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashScreen } from './CrashScreen';

// covers: VRMS spec 0025 AC-7

const show = (props: { variant: 'page' | 'full'; code?: string }) =>
  render(
    <MemoryRouter>
      <CrashScreen {...props} />
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('CrashScreen', () => {
  it('tells the person what happened and what to do', () => {
    show({ variant: 'page' });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Something went wrong on this page' })).toBeInTheDocument();
    expect(screen.getByText(/Try reloading/)).toBeInTheDocument();
  });

  it('shows the reference code when there is one', () => {
    show({ variant: 'page', code: 'abcdef01' });

    expect(screen.getByText('abcdef01')).toBeInTheDocument();
    expect(screen.getByText(/Reference/)).toBeInTheDocument();
  });

  it('shows no reference line when monitoring is off', () => {
    show({ variant: 'page' });

    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it('reloads the page when Reload is pressed', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    show({ variant: 'page' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('offers Back to apps as a link home', () => {
    show({ variant: 'page' });

    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveAttribute('href', '/');
  });

  it('keeps the full variant a plain link, since the router may be the thing that crashed', () => {
    show({ variant: 'full' });

    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveAttribute('href', '/');
  });

  it('lets a keyboard user reach Reload and then the way back', async () => {
    show({ variant: 'page' });
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveFocus();
  });
});
