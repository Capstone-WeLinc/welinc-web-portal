# welinc-web-portal

## Overview

The SSO portal: a React 19 + Vite SPA. Login goes to `welinc-auth` through the gateway, which sets the HttpOnly `welinc_sso` cookie; the portal holds no token and stores nothing about the session. It shows the launcher, sends the user straight into their one system, or returns them to a system's code flow with `/auth/authorize/resume` (specs 0003 and 0007). It also holds forgot password.

## Key files

| File | Owns |
|---|---|
| `src/App.tsx` | Routes; `/admin*` is lazy loaded (see `src/pages/admin/AGENTS.md`) |
| `src/pages/Portal.tsx` | Picks the screen (form, launcher, no access, straight in) from the address and the SSO session |
| `src/pages/launcher/` | The launcher: `SystemCard`, `AdminCard`, account menu and shell, Sign out dialog, the loading, error and no access states |
| `src/pages/auth/Login.tsx` | Login form; its messages come from `lib/auth.ts` (`loginFailure`, `noticeFor`). `Portal` decides when it shows |
| `src/pages/auth/EmailCodeStep.tsx` | Spec 0009 email verification step: `/auth/login` answers `EMAIL_VERIFICATION_REQUIRED`; a new login caller must check for it (`isEmailStep` in `lib/auth.ts`). The ticket lives in component state only |
| `src/pages/auth/ForgotPassword.tsx` | OTP and password reset flow |
| `src/lib/api.ts` | Axios client, base URL from `VITE_API_BASE_URL`, `withCredentials` so the SSO cookie goes along; no token |
| `src/lib/auth.ts` | Pure login helpers: notices and error messages, the screen choice, the resume address |
| `src/lib/session.ts`, `src/lib/launcher.ts` | `checkSso` and `signOutEverywhere`; the launcher's display rules (greeting, initials, picture) |
| `src/components/LogoMark.tsx`, `src/assets/` | The SVG logo mark (design.md: never the square `welinc-logo.jpg` at icon size) and the bundled login images |
| `src/components/ui/` | shadcn components, including the sonner `Toaster`; `src/lib/notify.ts` has `notifyError` |
| `src/index.css` | Tailwind v4 setup and the design tokens, the one place color values live; also the `brand-grid` and `pb-safe` utilities, since lint refuses bracketed values in components |

## Commands

```bash
npm run dev       # Vite on 8000
npm run lint
npm run build     # tsc -b && the production build, this is the typecheck too; needs a real https VITE_API_BASE_URL (CI, hosting)
npm run build:local  # same, with the committed .env.development (use this on your machine)
npm test          # Vitest, run once
```

Tests sit beside the source as `*.test.ts(x)`.

## Conventions

- Tailwind v4 and shadcn. Use the token utilities from `src/index.css` (`bg-primary`, `text-muted-foreground`), never raw hex or arbitrary values: lint fails on them. `design.md` at the workspace root governs the look.
- Routing rules are spec 0007, AC-10 to AC-14: an app initiated login never shows the launcher, and an `error` in the address never forwards (`from` only marks the current system's card, `currentSystem` in `lib/auth.ts`).
- Each system's address comes from welinc-auth's login answer (`url`), never from env; the API from `VITE_API_BASE_URL`.
- `VITE_API_BASE_URL` is checked by `env.schema.ts`, run from `vite.config.ts` before dev and every build (spec 0010): missing or malformed stops it, and a production build also refuses `http` and `localhost`. `src/` reads it with no `||` fallback (`no-localhost-fallback.test.ts` fails on a local address outside comments). A new `VITE_*` name goes in `env.schema.ts`, `.env.example`, `.env.development` and `src/vite-env.d.ts` (the drift test in `env.schema.test.ts` checks the first three), plus `env:` in `ci.yml` and an `ARG` in `Dockerfile.prod`.
- Never keep a token, a user or a session flag in `localStorage` or a URL (spec 0003, AC-36). The session is welinc-auth's `welinc_sso` cookie, which no script can read.
- Touch targets are 44px on phones: the default `Button` size adds `max-sm:h-11` and the dialog Close is `size-11` below `sm`. Keep new controls at that height.
- `Button` variants are `default`, `outline`, `ghost`, `destructive` (quiet red text, never a solid red fill), `commit` (gold, only on the navy save bar) and `link`. There is no `secondary`; use `outline`.

## Gotchas

- Type sizes (`text-body`, `text-caption` and the rest) and theme shadows are registered in `extendTailwindMerge` in `src/lib/utils.ts`. Add any new size or shadow token there too, or `cn()` reads it as a color and drops the color class beside it.
- Only roles for systems `VRMS`, `VMMS` or `BMS` count. A user with none gets 403 `NO_SYSTEM_ACCESS` from `/auth/login` and no session.
- Personal env overrides go in `.env.local`.
- On Windows, run Vitest from a path with an uppercase drive letter (`C:/Users/...`). From Git Bash's `/c/Users/...` every test file fails with "Vitest failed to find the current suite".

## Agent skills

- [tailwind-4-docs](../.claude/skills/tailwind-4-docs/): `lombiq/tailwind-agent-skills`, Tailwind v4 reference
- [vercel-react-best-practices](../.claude/skills/vercel-react-best-practices/), [vercel-composition-patterns](../.claude/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, React patterns
- [shadcn](../.claude/skills/shadcn/): `shadcn-ui/ui`, component usage

## Context files

- [src/pages/admin/AGENTS.md](src/pages/admin/AGENTS.md): the `/admin` section (suite spec 0013): people, permissions, temporary access, suite admins, and the step up and reauth wrappers every admin call uses

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
