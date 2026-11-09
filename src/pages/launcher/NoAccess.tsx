import SignOutButton from './SignOutButton';

/** Signed in, but no role in any system (spec 0007, AC-19). */
export default function NoAccess({ email }: { email: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-darker p-6 text-white">
      <div className="max-w-md space-y-4 text-center">
        <p role="alert">Your account has no access to any WeLinc system. Ask your admin for a role.</p>
        {email && <p className="text-sm text-white/60">Signed in as {email}</p>}
        <SignOutButton />
      </div>
    </main>
  );
}
