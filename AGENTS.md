# welinc-web-portal

## Overview

The SSO portal: a React 19 + Vite SPA on port 8000. It is the front door for the suite. A user logs in against `welinc-auth` (through the gateway), which sets its HttpOnly `welinc_sso` cookie and answers the systems the user holds. The portal then shows the launcher, sends them straight into their one system, or returns them to a system's code flow with `/auth/authorize/resume` (specs 0003 and 0007). It holds no token and stores nothing about the session. It also holds forgot password. This repo is shared, so keep changes small.

## Key files

| File | Owns |
|---|---|
| `src/App.tsx` | Routes: `/` and `/login` both render `Portal`; also `/forgot-password` |
| `src/pages/Portal.tsx` | Chooses the screen from the address and the SSO session: the form, the launcher, no access, or straight in. Re-checks when a tab comes back, at most every 10 seconds |
| `src/pages/launcher/` | The launcher: cards (`SystemCard`), account menu and shell, Sign out dialog, the loading, error and no access states |
| `src/pages/auth/Login.tsx` | Login form, with each error code's message and Sign in again. `Portal` decides when it shows |
| `src/pages/auth/ForgotPassword.tsx` | OTP and password reset flow |
| `src/lib/api.ts` | Axios client, base URL from `VITE_API_BASE_URL`, `withCredentials` so the SSO cookie goes along; no token |
| `src/lib/auth.ts` | The pure login helpers: `noticeFor` (the message per error code and reason), `loginRequest`, `startFor`, `screenForAnswer`, `screenForSso`, `resumeAddress`, `currentSystem` |
| `src/lib/session.ts`, `src/lib/launcher.ts` | `checkSso` and `signOutEverywhere`; the launcher's display rules (greeting, initials, picture) |
| `src/components/ui/` | shadcn components, including the sonner `Toaster`; `src/lib/notify.ts` has `notifyError` |
| `src/index.css` | Tailwind v4 setup and the design tokens, the one place color values live |

## Commands

```bash
npm run dev       # Vite on 8000
npm run lint
npm run build     # tsc -b && the production build, this is the typecheck too; needs a real https VITE_API_BASE_URL (CI, hosting)
npm run build:local  # same, with the committed .env.development (use this on your machine)
npm test          # Vitest, run once
```

There is no `typecheck` script. `npm test` runs Vitest (jsdom, Testing Library; `vitest.config.ts`, setup in `src/test/setup.ts`), with tests beside the source as `*.test.ts(x)`.

## Conventions

- Tailwind v4 and shadcn, like web-vrms. Use the token utilities from `src/index.css` (`bg-primary`, `text-muted-foreground`), never raw hex or arbitrary values: lint fails on them. `design.md` at the workspace root governs the look.
- Routing rules are spec 0007, AC-10 to AC-14: an app initiated login never shows the launcher, and an `error` in the address never forwards (`from` only marks the current system's card, `currentSystem` in `lib/auth.ts`).
- Each system's address comes from welinc-auth's login answer (`url`), and the API from `VITE_API_BASE_URL`. `VITE_*` values ship to the browser, so never put secrets in them. Document new ones in `.env.example` only.
- `VITE_API_BASE_URL` is checked by `env.schema.ts`, run from `vite.config.ts` before dev and every build (spec 0010): missing or malformed stops it, and a production build also refuses `http` and `localhost`. `src/` reads it with no `||` fallback (`no-localhost-fallback.test.ts` fails on a local address outside comments). A new `VITE_*` name goes in `env.schema.ts`, `.env.example`, `.env.development` and `src/vite-env.d.ts` (the drift test in `env.schema.test.ts` checks the first three), plus `env:` in `ci.yml` and an `ARG` in `Dockerfile.prod`.
- Never keep a token, a user or a session flag in `localStorage` or a URL (spec 0003, AC-36). The session is welinc-auth's `welinc_sso` cookie, which no script can read.

## Gotchas

- Only roles for systems `VRMS`, `VMMS` or `BMS` count. A user with none gets 403 `NO_SYSTEM_ACCESS` from `/auth/login` and no session.
- `.env.development` is committed with dev defaults. Personal overrides go in `.env.local`.
- Changing the redirect or the token handoff touches auth and every subsystem, so it needs a spec first.

## Agent skills

- [tailwind-4-docs](../.claude/skills/tailwind-4-docs/): `lombiq/tailwind-agent-skills`, Tailwind v4 reference
- [vercel-react-best-practices](../.claude/skills/vercel-react-best-practices/), [vercel-composition-patterns](../.claude/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, React patterns
- [shadcn](../.claude/skills/shadcn/): `shadcn-ui/ui`, component usage

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
