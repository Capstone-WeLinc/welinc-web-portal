# welinc-web-portal

## Overview

The SSO portal: a React 19 + Vite SPA on port 8000. It is the front door for the suite. A user logs in against `welinc-auth` (through the gateway), which sets its HttpOnly `welinc_sso` cookie and answers the picked system's address, and the portal sends them there, or back into a system's code flow with `/auth/authorize/resume` (spec 0003). It holds no token and stores nothing about the session. It also holds forgot password. This repo is shared, so keep changes small.

## Key files

| File | Owns |
|---|---|
| `src/App.tsx` | Routes: `/` and `/login` both render `Login`, so `<portal>/?error=...` from an app shows its message |
| `src/pages/auth/Login.tsx` | Login form. Opened with a live SSO session (`GET /auth/sso` answers 200) it skips the form, except with `reason=logout`, `reason=idle` or an `error`; it shows each error code's message with Sign in again |
| `src/pages/auth/ForgotPassword.tsx` | OTP and password reset flow |
| `src/lib/api.ts` | Axios client, base URL from `VITE_API_BASE_URL` or `VITE_API_URL`, `withCredentials` so the SSO cookie goes along; no token |
| `src/lib/auth.ts` | The pure login helpers: `noticeFor` (the message per error code and reason), `mayContinueSession`, `loginRequest`, `nextAddress` |
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
- Each system's address comes from welinc-auth's login answer (`url`), and the API from `VITE_API_URL`. `VITE_*` values ship to the browser, so never put secrets in them. Document new ones in `.env.example` only.
- Never keep a token, a user or a session flag in `localStorage` or a URL (spec 0003, AC-36). The session is welinc-auth's `welinc_sso` cookie, which no script can read.

## Gotchas

- Only roles for systems `VRMS`, `VMMS` or `BMS` count. A user with none gets 403 `NO_SYSTEM_ACCESS` from `/auth/login` and no session.
- `.env.development` is committed with dev defaults. Personal overrides go in `.env.local`.
- Changing the redirect or the token handoff touches auth and every subsystem, so it needs a spec first.

## Agent skills

- [tailwind-4-docs](../.claude/skills/tailwind-4-docs/): `lombiq/tailwind-agent-skills`, for the v3 to v4 upgrade of this repo
- [vercel-react-best-practices](../.claude/skills/vercel-react-best-practices/), [vercel-composition-patterns](../.claude/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, React patterns
- [shadcn](../.claude/skills/shadcn/): `shadcn-ui/ui`, component usage

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
