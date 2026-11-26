import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CrashScreen } from '@/components/monitoring/CrashScreen';
import { ViewError } from '@/pages/admin/AdminStates';
import { LauncherError } from '@/pages/launcher/LauncherStates';
import NotFound from '@/pages/NotFound';

// covers: VRMS spec 0028 AC-18, AC-21, AC-22
// The kit itself is web-vrms's copy (checked byte for byte by scripts/check-scenes.mjs); these
// check that the portal's own screens draw the scenes the spec maps them to.

const crash = { error: new TypeError('x is undefined'), path: '/admin/people', at: new Date('2026-11-25T06:03:07.000Z') };
const scene = (container: HTMLElement) => container.querySelector('svg[data-scene]')?.getAttribute('data-scene');

describe('portal scenes', () => {
  it('crash inside a shell: the hazard glow panel, its title the page heading', () => {
    const { container } = render(
      <MemoryRouter>
        <CrashScreen crash={crash} variant="page" />
      </MemoryRouter>,
    );

    expect(scene(container)).toBe('crash');
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong on this page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveAttribute('href', '/');
  });

  it('crash of the whole app: the blackout band, with no router around it', () => {
    const { container } = render(<CrashScreen crash={crash} variant="full" />);

    expect(scene(container)).toBe('pole');
    expect(container.querySelector('main#main')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to apps' })).toHaveAttribute('href', '/');
  });

  it('keeps the alert to the title and line', () => {
    render(
      <MemoryRouter>
        <CrashScreen crash={crash} variant="page" code="abcdef01" />
      </MemoryRouter>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on this page');
    expect(alert).not.toHaveTextContent('abcdef01');
    expect(alert).not.toHaveTextContent('Reload');
  });

  it('launcher load failure: the idling truck in place of the tiles, with the reassurance', () => {
    const { container } = render(
      <MemoryRouter>
        <LauncherError onRetry={() => undefined} />
      </MemoryRouter>,
    );

    expect(scene(container)).toBe('load');
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't load your systems." })).toBeInTheDocument();
    expect(screen.getByText('Nothing you saved is lost.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('ViewError page: the panel under the view’s own h1, its default title', () => {
    const { container } = render(<ViewError kind="page" message="We couldn't load the suite admins." onRetry={() => undefined} />);

    expect(scene(container)).toBe('load');
    expect(screen.getByRole('heading', { level: 2, name: "We couldn't load this" })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the suite admins.");
  });

  it('ViewError tile: the subject’s drawing and a quiet status, never an alert', () => {
    const { container } = render(<ViewError kind="tile" subject="roles" message="We couldn't load the roles." onRetry={() => undefined} />);

    expect(scene(container)).toBe('tile-roles');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't load the roles.");
    expect(screen.queryByText('Nothing you saved is lost.')).toBeNull();
  });

  it('404: the same road, now drawn by the kit', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(scene(container)).toBe('road');
    expect(container.querySelector('svg[data-scene="road"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Wrong turn' })).toBeInTheDocument();
  });
});
