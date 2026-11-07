import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('./components/SessionMonitor', () => ({ default: () => null }));

const hrefSet = vi.fn();
const reload = vi.fn();
const replaceState = vi.spyOn(window.history, 'replaceState');

function token(payload: object) {
  return `h.${btoa(JSON.stringify(payload))}.s`;
}
const live = () => Math.floor(Date.now() / 1000) + 600;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      pathname: '/',
      search: '',
      hash: '',
      get href() {
        return 'http://localhost/';
      },
      set href(v: string) {
        hrefSet(v);
      },
      reload,
    },
  });
});

// covers: spec 0002 AC-7 (return visit goes to the stored system, never worked out from roles)
describe('portal root', () => {
  it('sends a return visit to the stored system with its token', async () => {
    const t = token({ sub: 'u1', exp: live(), roles: [{ role: 'ADMIN', system: 'VRMS' }] });
    localStorage.setItem('welinc_token', t);
    localStorage.setItem('welinc_system', 'BMS');

    render(<App />);

    await waitFor(() =>
      expect(hrefSet).toHaveBeenCalledWith(`http://localhost:8003/login?token=${t}`),
    );
  });

  it('shows the login form when nothing is stored', async () => {
    render(<App />);

    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/login'));
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('shows the login form when the stored token has expired', async () => {
    localStorage.setItem('welinc_token', token({ sub: 'u1', exp: 1 }));
    localStorage.setItem('welinc_system', 'VRMS');

    render(<App />);

    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(expect.anything(), '', '/login'));
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('reloads when another tab changes the token or the system, not other keys', () => {
    render(<App />);

    window.dispatchEvent(new StorageEvent('storage', { key: 'welinc_system' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'welinc_token' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something_else' }));

    expect(reload).toHaveBeenCalledTimes(2);
  });
});
