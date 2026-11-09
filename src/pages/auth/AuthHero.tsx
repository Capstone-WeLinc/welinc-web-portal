import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// The login hero (spec 0007, AC-22): today's split layout, dark navy, gradient and gold glows,
// a deliberate exception to design.md that only the sign in pages use. Drawn with tokens.

export const LOGO_URL =
  'https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg';
const HERO_PHOTO_URL =
  'https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/42c68fef-2874-4f.avif';

/** Dark inputs on the hero: 44px tall, text-base so iOS doesn't zoom, a visible gold focus ring. */
export const heroInput =
  'h-11 rounded-xl border-white/10 bg-white/6 px-4 text-base text-white placeholder:text-white/30 md:h-11 md:text-base focus-visible:border-highlight/50 focus-visible:ring-highlight/60 focus-visible:ring-offset-hero-deep';

/** The gold submit on the hero, 44px and up. */
export const heroButton =
  'h-12 w-full rounded-xl bg-highlight text-base font-black text-primary shadow-lg shadow-highlight/20 hover:bg-highlight-hover focus-visible:ring-highlight focus-visible:ring-offset-hero-deep';

export function HeroLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-highlight shadow-lg shadow-highlight/30',
        size === 'md' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl',
      )}
    >
      <img src={LOGO_URL} alt="WeLinc" crossOrigin="anonymous" className={size === 'md' ? 'h-8 w-auto' : 'h-7 w-auto'} />
    </div>
  );
}

/** The brand pane on large screens. */
export function HeroPane() {
  return (
    <div className="relative hidden w-1/2 flex-col overflow-hidden lg:flex">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_PHOTO_URL})` }}
      />
      <div className="absolute inset-0 bg-linear-to-br from-hero/95 via-primary/80 to-hero/95" />
      <div className="absolute top-0 right-0 size-72 translate-x-1/3 -translate-y-1/2 rounded-full bg-highlight/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 size-96 -translate-x-1/3 translate-y-1/3 rounded-full bg-highlight/5 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <HeroLogo />
          <span className="text-xl font-black tracking-tight text-white">WeLinc Logistics</span>
        </div>
        <div>
          <h1 className="mb-4 text-4xl leading-tight font-black text-white xl:text-5xl">
            WeLinc Logistics
            <br />
            <span className="text-highlight">Operations</span>
            <br />
            Workspace
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/60">
            Centralized platform for managing logistics operations, vehicle monitoring, and maintenance schedules.
          </p>
        </div>
        <div />
      </div>
    </div>
  );
}

/** The dark backdrop with its glows, behind the card. */
export function HeroBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-br from-hero via-hero-deep to-hero-deep" />
      <div className="absolute top-0 right-0 size-64 rounded-full bg-primary/30 blur-3xl" />
      <div className="absolute bottom-0 left-0 size-64 rounded-full bg-primary/15 blur-3xl" />
    </>
  );
}

/** The glass card the form sits in. */
export function HeroCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/4 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
      {children}
    </div>
  );
}

type Tone = 'info' | 'error' | 'success';

/** A message above the form: an icon, and `role="alert"` for errors (AC-22). */
export function HeroNotice({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-5 flex items-start gap-2.5 rounded-xl border p-4',
        tone === 'error' ? 'border-hero-danger/20 bg-hero-danger/10' : 'border-white/10 bg-white/6',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'error' ? 'text-hero-danger' : tone === 'success' ? 'text-hero-success' : 'text-highlight',
        )}
      />
      <div className={cn('flex-1 text-sm', tone === 'error' ? 'text-hero-danger' : 'text-white/70')}>{children}</div>
    </div>
  );
}

/** Field label on the hero, with the required marker. */
export function HeroLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-white/70">
      {children} <span className="text-hero-danger" aria-hidden="true">*</span>
    </label>
  );
}

/** A light placeholder on the dark hero. */
function HeroSkeleton({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none', className)} />;
}

/** The login's shape while `/auth/sso` runs, instead of a line of bold text (AC-22). */
export function LoginLoading() {
  return (
    <div className="flex min-h-screen bg-hero">
      <HeroPane />
      <div className="relative flex flex-1 items-center justify-center p-6 lg:p-12">
        <HeroBackdrop />
        <div className="relative z-10 w-full max-w-md" aria-busy="true" aria-live="polite">
          <span className="sr-only">Checking your sign in</span>
          <HeroCard>
            <HeroSkeleton className="mb-5 size-12 rounded-2xl" />
            <HeroSkeleton className="mb-2 h-8 w-32" />
            <HeroSkeleton className="mb-8 h-4 w-64 max-w-full" />
            <div className="flex flex-col gap-5">
              <HeroSkeleton className="h-11 w-full rounded-xl" />
              <HeroSkeleton className="h-11 w-full rounded-xl" />
              <HeroSkeleton className="h-12 w-full rounded-xl" />
            </div>
          </HeroCard>
        </div>
      </div>
    </div>
  );
}
