# welinc-web-portal

## Overview

The SSO portal: a React 19 + Vite SPA on port 8000. It is the front door for the suite. A user logs in against `welinc-auth` (through the gateway), welinc-auth answers which system the token is for (spec 0002), and the portal sends them to that subsystem app with the token in the URL (`<app>/login?token=...`). It also holds forgot password and the 15 minute inactivity monitor. This repo is shared, so keep changes small.

## Key files

| File | Owns |
|---|---|
| `src/App.tsx` | Routes, `PortalRootRedirect` (a return visit goes to the stored system of the last login, while the token is live), cross tab storage reload |
| `src/pages/auth/Login.tsx` | Login form and the redirect to the chosen subsystem |
| `src/lib/subsystems.ts` | The `SUBSYSTEMS` map (name, URL from `VITE_*_URL`, colors) |
| `src/pages/auth/ForgotPassword.tsx` | OTP and password reset flow |
| `src/lib/api.ts` | Axios client, base URL from `VITE_API_BASE_URL` or `VITE_API_URL`, adds the bearer token |
| `src/lib/auth.ts` | JWT decode, token and system storage (`welinc_token`, `welinc_system`), `setSession`, `getReturnSystem`, `getCurrentUser`, `logout` |
| `src/components/SessionMonitor.tsx` | Inactivity warning and sign out |
| `src/context/toast.ts`, `ToastContext.tsx` | `useToast()` hook and context, and the provider component |
| `tailwind.config.js` | `brand` color tokens |

## Commands

```bash
npm run dev       # Vite on 8000
npm run lint
npm run build     # tsc -b && vite build, this is the typecheck too
npm test          # Vitest, run once
```

There is no `typecheck` script. `npm test` runs Vitest (jsdom, Testing Library; `vitest.config.ts`, setup in `src/test/setup.ts`), with tests beside the source as `*.test.ts(x)`.

## Conventions

- Tailwind is on v3 here (`tailwind.config.js`, `@tailwind` directives), unlike web-vrms which is on v4. Do not copy v4 syntax across.
- Use the `brand` tokens from `tailwind.config.js`, not raw hex values. `design.md` at the workspace root governs the look.
- Subsystem URLs come from `VITE_VRMS_URL`, `VITE_VMMS_URL`, `VITE_BMS_URL`, and the API from `VITE_API_URL`. `VITE_*` values ship to the browser, so never put secrets in them. Document new ones in `.env.example` only.
- The token lives in `localStorage` under `welinc_token`. Keep that key, since the subsystem apps and the cross tab listener depend on it. Never work out the system from the token's roles: use the `system` the login answered, stored as `welinc_system`.

## Gotchas

- Only roles for systems `VRMS`, `VMMS` or `BMS` count. A user with none has storage cleared and is sent back to login.
- `.env.development` is committed with dev defaults. Personal overrides go in `.env.local`.
- Changing the redirect or the token handoff touches auth and every subsystem, so it needs a spec first.

## Agent skills

- [tailwind-4-docs](../.claude/skills/tailwind-4-docs/): `lombiq/tailwind-agent-skills`, for the v3 to v4 upgrade of this repo
- [vercel-react-best-practices](../.claude/skills/vercel-react-best-practices/), [vercel-composition-patterns](../.claude/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, React patterns
- [shadcn](../.claude/skills/shadcn/): `shadcn-ui/ui`, component usage

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
