import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCrashViewerStanding } from '@/lib/monitoring/standing';
import { CrashScreen } from './CrashScreen';

// covers: VRMS spec 0025 AC-7, AC-7a

const crash = {
  error: new TypeError('x is undefined'),
  path: '/admin/people',
  at: new Date('2026-11-25T06:03:07.000Z'),
};

const view = (props: { variant: 'page' | 'full'; code?: string }) => (
  <MemoryRouter>
    <CrashScreen crash={crash} {...props} />
  </MemoryRouter>
);

const show = (props: { variant: 'page' | 'full'; code?: string }) => render(view(props));

/** A clipboard the test controls. Call it after userEvent.setup(), which installs its own. */
function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setCrashViewerStanding('u1', false);
});

describe('CrashScreen, staff with a code', () => {
  it('asks the person to send the code, and shows it', () => {
    show({ variant: 'page', code: 'abcdef01' });

    expect(screen.getByRole('heading', { name: 'Something went wrong on this page' })).toBeInTheDocument();
    expect(screen.getByText('Try reloading. If it keeps happening, send this code to your admin.')).toBeInTheDocument();
    expect(screen.getByText('abcdef01')).toBeInTheDocument();
    expect(screen.getByText(/Reference/)).toBeInTheDocument();
  });

  it('shows no details box and no Copy details', () => {
    show({ variant: 'page', code: 'abcdef01' });

    expect(screen.queryByLabelText('Crash details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy details/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/x is undefined/)).not.toBeInTheDocument();
  });
});

describe('CrashScreen, staff without a code', () => {
  it('never asks for a code it does not show', () => {
    show({ variant: 'page' });

    expect(
      screen.getByText('Try reloading. If it keeps happening, tell your admin what you were doing.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/send this code/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});

describe('CrashScreen, admin', () => {
  it('asks for a bug report and shows the details, one item per line', () => {
    setCrashViewerStanding('u1', true);
    show({ variant: 'page' });

    expect(screen.getByText('Try reloading. Copy the details below into your bug report.')).toBeInTheDocument();
    const lines = screen.getByLabelText('Crash details').textContent!.split('\n');
    expect(lines[0]).toBe('TypeError: x is undefined');
    expect(lines[1]).toBe('Page: /admin/people');
    expect(lines[2]).toMatch(/^Time: .+ \(2026-11-25T06:03:07\.000Z\)$/);
    expect(lines[3]).toMatch(/^App: web-portal \S+$/);
    expect(lines).toHaveLength(4);
  });

  it('adds the Code line when the code arrives, with the time unchanged, and no Reference line', () => {
    setCrashViewerStanding('u1', true);
    const { rerender } = show({ variant: 'page' });
    const before = screen.getByLabelText('Crash details').textContent!;

    rerender(view({ variant: 'page', code: 'abcdef01' }));

    const after = screen.getByLabelText('Crash details').textContent!;
    expect(after).toBe(`${before}\nCode: abcdef01`);
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it('keeps the details box outside the alert', () => {
    setCrashViewerStanding('u1', true);
    show({ variant: 'page' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on this page');
    expect(alert).not.toContainElement(screen.getByLabelText('Crash details'));
  });

  it('copies exactly the box text, reads Copied, then Copy details again after 2 seconds', async () => {
    setCrashViewerStanding('u1', true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard({ writeText });
    show({ variant: 'page', code: 'abcdef01' });

    await user.click(screen.getByRole('button', { name: 'Copy details' }));

    expect(writeText).toHaveBeenCalledWith(screen.getByLabelText('Crash details').textContent);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeInTheDocument();
  });

  it('asks the person to select the text when the copy fails', async () => {
    setCrashViewerStanding('u1', true);
    const user = userEvent.setup();
    stubClipboard({ writeText: () => Promise.reject(new Error('denied')) });
    show({ variant: 'page' });

    await user.click(screen.getByRole('button', { name: 'Copy details' }));

    expect(await screen.findByRole('button', { name: 'Select and copy the text above' })).toBeInTheDocument();
  });

  it('asks the person to select the text when the browser has no clipboard API', async () => {
    setCrashViewerStanding('u1', true);
    const user = userEvent.setup();
    stubClipboard(undefined);
    show({ variant: 'page' });

    await user.click(screen.getByRole('button', { name: 'Copy details' }));

    expect(await screen.findByRole('button', { name: 'Select and copy the text above' })).toBeInTheDocument();
  });

  it('reads the standing once and never upgrades later', () => {
    const { rerender } = show({ variant: 'page' });
    setCrashViewerStanding('u1', true);

    rerender(view({ variant: 'page' }));

    expect(screen.queryByLabelText('Crash details')).not.toBeInTheDocument();
  });
});

describe('CrashScreen, both versions', () => {
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

  it('lets a keyboard user reach Reload, the way back, then Copy details', async () => {
    setCrashViewerStanding('u1', true);
    show({ variant: 'page' });
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Copy details' })).toHaveFocus();
  });
});
