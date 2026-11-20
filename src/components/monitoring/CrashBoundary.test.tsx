import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashBoundary } from './CrashBoundary';

// covers: VRMS spec 0025 AC-3, AC-7

const reportRenderCrash = vi.hoisted(() => vi.fn());
vi.mock('@/lib/monitoring/sentry', () => ({ reportRenderCrash }));

function Boom(): never {
  throw new Error('render failed');
}

const inRouter = (node: React.ReactNode) => <MemoryRouter>{node}</MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks();
  // React logs every error a boundary catches; the tests expect those
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('CrashBoundary', () => {
  it('shows its children when nothing crashes', () => {
    render(
      inRouter(
        <CrashBoundary variant="page">
          <p>All good</p>
        </CrashBoundary>,
      ),
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(reportRenderCrash).not.toHaveBeenCalled();
  });

  it('replaces a crashed child with the crash screen', () => {
    render(
      inRouter(
        <CrashBoundary variant="page">
          <Boom />
        </CrashBoundary>,
      ),
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('reports the crash exactly once, with the error and a component stack', () => {
    render(
      inRouter(
        <CrashBoundary variant="page">
          <Boom />
        </CrashBoundary>,
      ),
    );

    expect(reportRenderCrash).toHaveBeenCalledTimes(1);
    const [error, stack] = reportRenderCrash.mock.calls[0]!;
    expect((error as Error).message).toBe('render failed');
    expect(typeof stack).toBe('string');
  });

  it('shows the first 8 characters of the event id as the reference code', () => {
    reportRenderCrash.mockReturnValue('abcdef0123456789abcdef0123456789');

    render(
      inRouter(
        <CrashBoundary variant="page">
          <Boom />
        </CrashBoundary>,
      ),
    );

    expect(screen.getByText('abcdef01')).toBeInTheDocument();
    expect(screen.queryByText(/abcdef012/)).not.toBeInTheDocument();
  });

  it('shows no code when monitoring is off', () => {
    reportRenderCrash.mockReturnValue(undefined);

    render(
      inRouter(
        <CrashBoundary variant="full">
          <Boom />
        </CrashBoundary>,
      ),
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it('clears when the boundary is keyed on a new page, as the shell does on navigation', () => {
    const { rerender } = render(
      inRouter(
        <CrashBoundary key="/apps" variant="page">
          <Boom />
        </CrashBoundary>,
      ),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      inRouter(
        <CrashBoundary key="/profile" variant="page">
          <p>Profile page</p>
        </CrashBoundary>,
      ),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });
});
