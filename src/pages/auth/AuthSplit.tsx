import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { BranchMap } from '@/components/brand/BranchMap';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/*
  Suite spec 0019, AC-13 to AC-16 (boards `R37SignIn`, `R32Forgot1` to `R32Forgot4`,
  `R34NoAccess`): the sign in split. The navy side holds the copy and the branch map; the white
  side holds the form, or a result centred on it. Below 1024px the navy side shrinks to a strip
  with the logo over the white side.
*/

/** Fields on the split: the app's field, 46px, with focus as a navy edge and a soft navy ring (AC-14, never gold). */
export const splitInput =
  'h-11.5 rounded-xl md:h-11.5 focus-visible:inset-ring-0 focus-visible:ring-3 focus-visible:ring-primary/15';

/** The split's one action: navy, 48px, full width. */
export const splitButton = 'h-12 w-full rounded-xl bg-sidebar text-group font-bold hover:bg-primary max-sm:h-12';

/** A code box (board `R32Forgot2`): 52 by 58 on wider screens, the active one with a navy edge and a soft ring. */
export const splitCodeSlot =
  'h-14.5 w-11 rounded-lg font-sans text-heading font-bold tabular-nums first:rounded-lg first:border last:rounded-lg sm:w-13 md:h-14.5 md:w-13 data-[active=true]:ring-4 data-[active=true]:ring-sidebar/10';

/** The navy band beside every sign in screen, on large screens. */
function BrandSide() {
  return (
    <div className="relative hidden overflow-hidden bg-sidebar text-white lg:col-span-7 lg:block">
      <div className="relative z-10 px-16 pt-10">
        <BrandLockup />
        <div className="mt-14">
          <p className="text-small font-bold tracking-widest text-highlight uppercase">#hasslefree transport solution</p>
          <h1 className="mt-3 text-5xl leading-none font-extrabold tracking-tight">
            Keep the fleet
            <br />
            moving.
          </h1>
          <p className="mt-3.5 max-w-md text-group leading-relaxed font-normal text-white/70">
            Sign in with your WeLinc work account to pick up where you left off.
          </p>
        </div>
      </div>
      <BranchMap className="pointer-events-none absolute top-82 left-36 h-140 w-180" />
    </div>
  );
}

/**
 * The split page. `toaster` mounts inside the white column only, so the sign in toasts sit at
 * its top (AC-15); `transform-gpu` makes the column the box sonner's fixed list is placed in.
 */
export function AuthSplit({ children, toaster }: { children: ReactNode; toaster?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-card lg:grid lg:grid-cols-12">
      <BrandSide />
      <div className="bg-sidebar px-6 py-5 lg:hidden">
        <BrandLockup />
      </div>
      <div className="relative flex min-w-0 flex-1 transform-gpu items-center justify-center bg-card px-6 py-10 text-foreground lg:col-span-5">
        {toaster}
        <main className="flex w-full max-w-sm flex-col gap-6.5">{children}</main>
      </div>
    </div>
  );
}

/** "Step 1 of 3" over a forgot password step. */
export function StepLabel({ step }: { step: number }) {
  return <p className="-mb-3.5 text-small font-bold tracking-wider text-muted-foreground uppercase">Step {step} of 3</p>;
}

/** The page heading and its line. */
export function SplitHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h2 className="text-title font-extrabold tracking-tight text-foreground">{title}</h2>
      {children && <p className="mt-2 text-group leading-relaxed font-normal break-words text-muted-strong">{children}</p>}
    </div>
  );
}

/** An email in a line of copy, in the text colour. */
export function Strong({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

/** A back link above a step ("Back to sign in", "Use a different email"). */
export function BackAction({ to, onClick, children }: { to?: string; onClick?: () => void; children: ReactNode }) {
  const className =
    'inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-md text-body font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden -my-3';
  const content = (
    <>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/** Field label on the split. */
export function SplitLabel({ htmlFor, id, children }: { htmlFor?: string; id?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} id={id} className="mb-1.5 block text-body font-semibold text-foreground">
      {children}
    </label>
  );
}

/** A message above a form that stops the step (`role="alert"`), or confirms one (`role="status"`). */
export function SplitNotice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl p-3.5 text-body',
        tone === 'error' ? 'bg-error-bg text-error' : 'bg-success-bg text-success',
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** The muted line under a form ("No account yet?", the resend wait). */
export function SplitHint({ children }: { children: ReactNode }) {
  return <div className="text-body leading-normal text-muted-foreground">{children}</div>;
}

/** A result centred on the white side (forgot password step 4, No access): a round icon, the words, the actions. */
export function SplitResult({
  icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  tone: 'success' | 'info';
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5.5 text-center">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-16 items-center justify-center rounded-full ring-8',
          tone === 'success' ? 'bg-success-bg text-success ring-success-bg/50' : 'bg-info-bg text-primary ring-info-bg/50',
        )}
      >
        {icon}
      </span>
      <SplitHeading title={title}>{children}</SplitHeading>
      <div className="flex flex-col gap-3 self-stretch">{actions}</div>
    </div>
  );
}

/** The sign in shape while `/auth/sso` runs (spec 0007, AC-22). */
export function LoginLoading() {
  return (
    <AuthSplit>
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6.5">
        <span className="sr-only">Checking your sign in</span>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <div className="flex flex-col gap-4.5">
          <Skeleton className="h-11.5 w-full rounded-xl" />
          <Skeleton className="h-11.5 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </AuthSplit>
  );
}
