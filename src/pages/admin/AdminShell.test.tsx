import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { History, KeyRound } from 'lucide-react';
import type { AdminMe } from '@/lib/admin';
import { holdCutoffs } from '@/lib/sessionWatch/watch';
import { AdminShell } from './AdminShell';
import { viewsFor } from './adminViews';

vi.mock('@/lib/api', () => ({ API_BASE_URL: 'http://localhost:3000', api: {} }));

const me = (over: Partial<AdminMe> = {}): AdminMe => ({
  user: { id: 'me', name: 'Leonora Castillo', email: 'suite.admin@welinc.com', picture: null },
  suiteAdmin: true,
  adminOf: [],
  codeRequired: false,
  codePassed: true,
  pendingDeletionRequests: 3,
  ...over,
});

function renderShell(admin: AdminMe) {
  render(
    <MemoryRouter initialEntries={['/admin/people']}>
      <AdminShell me={admin} views={viewsFor(admin)} current="people">
        <p>Body</p>
      </AdminShell>
    </MemoryRouter>,
  );
}

// covers: VRMS spec 0027 AC-12 (suite spec 0019 AC-17 to AC-20 as built before f6e4985)
describe('the Suite management frame', () => {
  it('has the title with your role, the footer strip with the collapse button, and no sidebar switcher', () => {
    renderShell(me());
    const sidebar = screen.getAllByRole('complementary')[0];

    expect(within(sidebar).getByRole('link', { name: /Suite management/ })).toHaveTextContent('Suite admin');
    expect(within(sidebar).getByText('WeLinc Logistics')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(within(sidebar).queryByText('WeLinc portal')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText(/Account menu for/)).not.toBeInTheDocument();
  });

  it('keeps the switcher and the account menu top right, the switcher only with a web system', () => {
    holdCutoffs({
      user: { id: 'me', name: 'Leonora Castillo', email: 'suite.admin@welinc.com', picture: null },
      systems: [{ system: 'VRMS', name: 'Vehicle Repair', url: 'http://vrms.test', roles: [{ code: 'ADMIN', name: 'Admin', isSystemAdmin: true }] }],
    });
    renderShell(me());
    const bar = screen.getByRole('banner');

    expect(within(bar).getByRole('button', { name: 'Switch system' })).toBeInTheDocument();
    expect(within(bar).getByText('Account menu for Leonora Castillo')).toBeInTheDocument();
    expect(within(bar).getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('People');
  });

  it('keeps the Deletion requests count, named for screen readers', () => {
    renderShell(me());
    const link = screen.getAllByRole('link', { name: /Deletion requests/ })[0];

    expect(link).toHaveTextContent('3');
    expect(link).toHaveAccessibleName(/3 waiting for a decision/);
  });

  it('keeps the KeyRound and History icons the Shell20 boards use', () => {
    const icon = (path: string) => viewsFor(me()).find((view) => view.path === path)?.icon;

    expect(icon('temporary-access')).toBe(KeyRound);
    expect(icon('activity')).toBe(History);
  });
});
