import { useRef, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { SignInMap } from '@/components/brand/SignInMap';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/*
  Suite spec 0019, AC-13 to AC-16 (board `R47Quiet`, S27d Quiet; the forgot boards `R32Forgot1` to
  `R32Forgot4` and `R34NoAccess` for their content): the drawn map under the whole page, the copy
  on its left, and the form, or a result centred, on a navy glass panel at the right. Inside the
  panel `signin-dark` turns the app's colour tokens light on dark, so the shared fields, links and
  notices follow. Below 1024px the copy gives way to a strip with the logo, and the panel takes
  the width.
*/

/** Fields on the sign in page: 48px glass fields; focus is a light edge with a soft ring (AC-14, never gold). */
export const splitInput =
  'h-12 rounded-xl placeholder:text-white/42 md:h-12 focus-visible:inset-ring-0 focus-visible:ring-3 focus-visible:ring-primary/15';

/** The sign in page's one action: gold on the navy glass (`R47Quiet`), 50px, full width. */
export const splitButton =
  'h-12.5 w-full rounded-xl bg-highlight text-group font-extrabold text-highlight-foreground hover:bg-commit-hover max-sm:h-12.5';

/** A code box (board `R32Forgot2`): 52 by 58 on wider screens, the active one with a light edge and a soft ring. */
export const splitCodeSlot =
  'h-14.5 w-11 rounded-lg font-sans text-heading font-bold tabular-nums first:rounded-lg first:border last:rounded-lg sm:w-13 md:h-14.5 md:w-13 data-[active=true]:ring-4 data-[active=true]:ring-primary/15';

/** The copy beside the panel, on large screens (AC-13). */
function CopySide({ copyRef }: { copyRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="relative z-10 hidden min-w-0 flex-1 flex-col px-16 pt-11 lg:flex">
      <BrandLockup />
      <div ref={copyRef} className="mt-15">
        <p className="font-mono text-small font-semibold tracking-widest text-highlight">#HASSLEFREE TRANSPORT SOLUTION</p>
        <h1 className="mt-4 text-hero">
          WeLinc Logistics
          <br />
          <em className="text-highlight not-italic">Operations</em>
          <br />
          Workspace
        </h1>
        <p className="mt-4.5 max-w-120 text-subheading leading-relaxed font-normal text-white/66">
          Centralized platform for managing logistics operations, vehicle monitoring, maintenance schedules and repairs.
        </p>
      </div>
    </div>
  );
}

/**
 * The sign in page. `toaster` mounts inside the glass panel but outside its dark colours, so the
 * sign in toasts sit at its top in their own colours (AC-15); `transform-gpu` makes the panel the
 * box sonner's fixed list is placed in.
 */
export function AuthSplit({ children, toaster }: { children: ReactNode; toaster?: ReactNode }) {
  const copyRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-sidebar text-white lg:flex-row">
      <SignInMap clearOf={copyRef} />
      <CopySide copyRef={copyRef} />
      <div className="relative z-10 px-6 py-5 lg:hidden">
        <BrandLockup />
      </div>
      <div className="signin-glass relative z-10 flex min-w-0 flex-1 transform-gpu flex-col items-center justify-center px-6 pt-10 pb-20 lg:w-150 lg:flex-none">
        {toaster}
        <main className="signin-dark flex w-full max-w-96 flex-col gap-7">{children}</main>
        <p className="absolute inset-x-0 bottom-7 flex flex-wrap justify-center gap-x-2.5 gap-y-1 px-6 text-caption font-normal whitespace-nowrap text-white/56">
          <span>© 2026 WeLinc Logistics</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:outline-hidden"
          >
            © OpenStreetMap
          </a>
        </p>
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
