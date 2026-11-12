import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';
import { deletePerson } from './adminApi';

vi.mock('./api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  api: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

const del = vi.mocked(api.delete);

beforeEach(() => {
  del.mockReset();
  del.mockResolvedValue({ data: undefined });
});

describe('deletePerson (suite spec 0013)', () => {
  // covers: AC-16
  // A bodiless DELETE loses its JSON content type in axios and the CSRF guard answers 403.
  it('sends an empty JSON body so the content type survives', async () => {
    await deletePerson('u1', 'VRMS');
    expect(del).toHaveBeenCalledTimes(1);
    const [url, config] = del.mock.calls[0];
    expect(url).toBe('/auth/admin/users/u1');
    expect(config).toHaveProperty('data', {});
  });

  // covers: AC-16
  it('scopes the call to the system', async () => {
    await deletePerson('u1', 'BMS');
    expect(del.mock.calls[0][1]).toMatchObject({ params: { system: 'BMS' } });
  });

  // covers: AC-17
  it('sends no system for a suite wide delete', async () => {
    await deletePerson('u1', null);
    expect(del.mock.calls[0][1]).toMatchObject({ params: {} });
  });

  // covers: AC-22
  it('does not swallow a server refusal', async () => {
    del.mockRejectedValue({ response: { status: 409, data: { code: 'LAST_ADMIN' } } });
    await expect(deletePerson('u1', 'VRMS')).rejects.toMatchObject({ response: { status: 409 } });
  });
});
