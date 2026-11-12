# Admin section (`/admin`)

## Overview

The portal's admin screens from suite spec 0013: people, deletion requests, activity, temporary access, suite admins, the permission matrix and the suite overview. It talks only to welinc-auth's cookie based `/auth/admin/*` routes, through `src/lib/admin.ts` (standing, step up) and `src/lib/adminApi.ts` (every call). `AdminPage` is lazy loaded from `App.tsx`; the launcher links in through `AdminEntry`.

## Key files

| File | Owns |
|---|---|
| `AdminPage.tsx` | The session gate (`fetchAdminMe`), shell, sidebar and view switch, plus the Code owed and Not an admin screens. Routes: `/admin`, `/admin/:view`, `/admin/people/:id` (`new` is Add person) |
| `adminViews.ts` | The view list (`overview`, `people`, `deletion-requests`, `activity`, `temporary-access`, `suite-admins`, `permissions`), which are suite only, and the landing view (overview for suite admins, people otherwise) |
| `useAdminSystem.ts` | `?system=` handling: `useAdminSystem` for one system views (person pages, permissions), `useAdminScope` for views where a suite admin may pick `all` (people, activity, deletion). Writes the query with `replace` and drops `?cursor=` on a change |
| `AdminStates.tsx` | `ViewHeader`, `ViewError`, `ViewEmpty`, `SystemSwitcher`, `NoSystemScope` |
| `StepUpDialog.tsx`, `ReauthDialog.tsx` | The "Confirm it's you" code dialog and the password dialog, each mounted once in `App.tsx` |
| `ConfirmFields.tsx`, `reason.ts` | `ReasonField`, `PasswordField`, and `reasonProblem` (10 to 500 trimmed characters) |
| `useAsync.ts`, `useCatalogs.ts` | The key based loader, and the systems and activity catalogs fetched once per page load |
| `people/` | `PeopleView` (list, `?q=` and `?status=`), `PersonPage` (every action on one person), `AddPersonPage`, `PersonForm`, `personStatus`, `personValues`, `Badges` |
| `permissions/` | `PermissionsView` (matrix editor, read only for system admins), `matrixDraft.ts` (the draft rules, tested), `MatrixReviewDialog`, `MatrixHistory` |
| `temporary/` | `TemporaryAccessView`, `TemporaryAccessDialog` (start a grant), `TemporaryAccessBanner` (the live grant band with End now) |
| `suite/SuiteAdminsView.tsx`, `overview/OverviewView.tsx`, `deletion/`, `activity/` | Suite admins add and remove, the suite report, deletion approve, reject and restore, the activity feed |

## Conventions

- Every admin call goes through `withStepUp` (`lib/admin.ts`): on 403 `ADMIN_CODE_REQUIRED` it opens the one `StepUpDialog` (a shared promise, so parallel calls ask once) and retries once. A new call in `adminApi.ts` must be wrapped too.
- Writes the server may want a password for use `withReauth` (`adminApi.ts`): on `REAUTH_REQUIRED` it opens `ReauthDialog` and retries once with the token. Dialogs that always ask for the password (suite admin add and remove, temporary access) call `verifyPassword` themselves and send `reauthToken` in the body.
- Reason rules match the server: `reasonProblem` (10 to 500) for suite admin and temporary access reasons; the deletion reject reason and the matrix note are 5 to 500, and the matrix note is required only when a cell is taken away (`matrixDraft.ts`).
- `useAsync` derives loading from a key mismatch and never sets state in an effect; include a retry counter in the key to reload. `replace` only writes for the current key.
- Confirms are `AlertDialog`s whose action calls `preventDefault`, stays open and blocks close while busy; destructive actions use the destructive variant. Results go to sonner toasts with `errorMessage(error, fallback)`.
- Suite admin versus system admin changes what shows (suite only views, the `All` switcher, matrix editing); the server still enforces every rule, so hiding is never the only check.
- The matrix draft holds only flipped cells; the editor remounts on `system|version`, and a save sends `version`, so a `MATRIX_STALE` answer reloads it.
- Error codes handled by name: `ADMIN_CODE_REQUIRED`, `REAUTH_REQUIRED`, `WRONG_PASSWORD`, `ACCOUNT_LOCKED` (clears the password field), `RATE_LIMITED`, `MATRIX_STALE`, `ACCOUNT_EXISTS`, `GRANT_ACTIVE`, and the suite admin 409s (`SUITE_ADMIN_LIMIT`, `ALREADY_SUITE_ADMIN`, `HOLDS_SYSTEM_ROLES`, `NOT_ELIGIBLE`, `LAST_SUITE_ADMIN`). A new code gets its message where the others live.

## Gotchas

- Nothing here touches `localStorage` or `sessionStorage`: passwords, reauth tokens and the step up ticket live in component state only (spec 0003, AC-36).
- The sidebar links and the landing redirect go through `viewHref` (`adminViews.ts`), which keeps `?system=` and drops every other query; a new link between views should use it too.
- `?system=all` means suite wide only for a suite admin; the overview's links use it.
- The step up and reauth hosts are module singletons registered by the two dialogs' effects; without the dialogs mounted, `askForCode` resolves false and the call fails.
- Ending your own temporary grant signs you out (`/login?reason=logout`).
- Tests here: `permissions/matrixDraft.test.ts` and `people/PersonForm.test.tsx` (the locked email on your own page); `lib/admin.test.ts` covers standing, the landing view and `withStepUp`, and `lib/adminApi.test.ts` covers `deletePerson`.
- A bodiless `DELETE` needs `data: {}` in `adminApi.ts`: axios drops the JSON content type without a body, and welinc-auth's CSRF guard then answers 403 `CSRF_REJECTED` (see `deletePerson`).

## Related specs

- [Suite spec 0013, suite admin model](../../../../docs/specs/_root/0013-suite-admin-model/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
