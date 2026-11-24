import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AdminPage from './AdminPage';

const handlers = vi.hoisted(() => ({ ended: null as (() => void) | null }));

vi.mock('@/lib/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: {},
  onSessionEnded: (handler: (() => void) | null) => {
    handlers.ended = handler;
  },
}));
vi.mock('@/lib/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin')>()),
  // The standing never answers, so only the session ended handler moves the page
  fetchAdminMe: () => new Promise(() => {}),
}));
vi.mock('@/lib/sessionWatch/watch', () => ({ useSessionWatch: () => undefined }));

// covers: suite spec 0013 AC-14 (a session that ends on an admin page signs in again and returns
// to that page), including several admin calls answering 401 at once

function renderAt(path: string) {
  window.history.replaceState(null, '', path);
  render(
    <BrowserRouter>
      <Routes>
        <Route path="/admin/:view?" element={<AdminPage />} />
        <Route path="/login" element={<p>Sign in</p>} />
      </Routes>
    </BrowserRouter>,
  );
}

beforeEach(() => {
  handlers.ended = null;
});

describe('a session that ends on an admin page (AC-14)', () => {
  it('sends you to sign in with this page as next', () => {
    renderAt('/admin/people?q=bong');
    act(() => handlers.ended?.());
    expect(window.location.pathname + window.location.search).toBe('/login?reason=ended&next=%2Fadmin%2Fpeople%3Fq%3Dbong');
  });

  it('keeps one next when several calls end at once', () => {
    renderAt('/admin/people');
    act(() => {
      handlers.ended?.();
      handlers.ended?.();
    });
    expect(window.location.pathname + window.location.search).toBe('/login?reason=ended&next=%2Fadmin%2Fpeople');
  });
});
