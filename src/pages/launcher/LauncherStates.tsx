/** While `/auth/sso` runs. */
export function LauncherLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-darker text-white/60" aria-busy="true">
      Loading your workspace...
    </div>
  );
}

/** `/auth/sso` failed with 429, 5xx or no network (spec 0007, AC-20). */
export function LauncherError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-darker p-6 text-white">
      <div className="space-y-4 text-center">
        <p role="alert">We couldn't load your systems.</p>
        <button type="button" onClick={onRetry} className="rounded-xl bg-brand-gold px-4 py-2 font-black text-brand-blueAccent">
          Retry
        </button>
      </div>
    </main>
  );
}
