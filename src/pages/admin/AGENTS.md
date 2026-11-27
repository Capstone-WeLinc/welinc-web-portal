# Admin section (`/admin`)

## Overview

The portal's admin screens from suite spec 0013. They talk only to welinc-auth's cookie based `/auth/admin/*` routes, through `src/lib/admin.ts` (standing, step up) and `src/lib/adminApi.ts` (every call). Entry points: the launcher's Suite management tile (`SuiteTile`, built by `suiteTileFor` in `src/lib/launcher.ts` from the SSO answer) and the top bar `AdminEntry` (through `useAdminMe`).

## Key files

| File | Owns |
|---|---|
| `AdminPage.tsx` | The session gate (`fetchAdminMe`), the view switch, and the Code owed and Not an admin screens; `/admin/people/new` is Add person |
| `AdminShell.tsx` | The frame: sidebar, breadcrumb top bar, and on phones a bottom bar or a sheet menu (`BOTTOM_BAR_MAX` in `adminViews.ts`); the sidebar count bubble (`viewCount`) reads `pendingDeletionRequests` from `/auth/admin/me` |
| `SuiteSwitcher.tsx` | The top bar's system switcher popover |
| `AdminTable.tsx` | `DataTable`, `Row`, `Cell`, `PersonCell`, `Muted`: a table from md up that stacks into blocks on phones |
| `adminViews.ts` | `ADMIN_VIEWS` (with the `suiteOnly` flag), `landingView`, `viewHref`, `BOTTOM_BAR_MAX` |
| `useAdminSystem.ts` | `?system=` handling: `systemChoices` (the systems a viewer may pick), `useAdminScope` for views where a suite admin may pick `all` (people, activity, deletion). Writes the query with `replace` and drops `?cursor=` on a change |
| `AdminStates.tsx` | `ViewHeader`, `ViewError`, `ViewEmpty`, `Segmented`, `SystemSwitcher`, `Toolbar`, `NoSystemScope` |
| `StepUpDialog.tsx`, `ReauthDialog.tsx` | The "Confirm it's you" code dialog and the password dialog, each mounted once in `App.tsx` |
| `ConfirmFields.tsx`, `reason.ts` | `ReasonField`, `PasswordField`, and `reasonProblem` (10 to 500 trimmed characters) |
| `useAdminMe.ts` | The shared `/auth/admin/me` read behind the top bar `AdminEntry` |
| `useAsync.ts`, `useCatalogs.ts` | The key based loader, and the systems and activity catalogs fetched once per page load |
| `people/` | Suite spec 0017 (board `People8`): `PeoplePage` (the list beside the whole person; `/admin/people/new` opens `AddPersonDialog` over it), `PeopleListPane` (groups, sorts, search, filters), `PeopleFilter` (the Filter popover, suite spec 0019 AC-21) with its pure rules in `filterRules.ts` (tested), `PersonPane` and `PersonTabs` (header, facts, Overview, Access, Signed in devices, Activity), `AccessTab`, `PersonHeaderActions`, and the pure rules in `peopleRules.ts` (tested) |
| `permissions/` | `matrixDraft.ts` only: the draft rules (cells keyed `role|key`, tested) the Roles page uses |
| `roles/` | Suite spec 0018 child 0001 (board `Roles9`): `RolesPage` (route `/admin/roles/:system/:role`, data, the stored draft per system, save and conflicts), `RoleList`, `RoleDetail` (header, facts, tabs), `PermissionGroups` (folds, Find a permission), `RolePeople` and `AddPeopleDialog`, `RoleHistory`, `RoleReviewDialog` (RC), `CustomRoleDialogs` (New role, Duplicate, Rename, Edit description and Delete role for VRMS custom roles, child 0002), `downloadRolesCsv.ts`, and the pure rules in `rolesRules.ts` (tested). `/admin/permissions` redirects here |
| `temporary/` | `TemporaryAccessView`, `TemporaryAccessDialog`, and `TemporaryAccessBanner.tsx` (the band on Overview and Temporary access, plus `TemporaryAccessChip` for the other views) |
| `suite/SuiteAdminsView.tsx`, `overview/OverviewView.tsx`, `deletion/`, `activity/` | Suite admins add and remove, the suite report, deletion approve, reject and restore, the activity feed |

## Conventions

- Every admin call goes through `withStepUp` (`lib/admin.ts`): on 403 `ADMIN_CODE_REQUIRED` it opens the one `StepUpDialog` (a shared promise, so parallel calls ask once) and retries once. A new call in `adminApi.ts` must be wrapped too.
- Writes the server may want a password for use `withReauth` (`adminApi.ts`): on `REAUTH_REQUIRED` it opens `ReauthDialog` and retries once with the token. Dialogs that always ask for the password (suite admin add and remove, temporary access) call `verifyPassword` themselves and send `reauthToken` in the body.
- Reason rules match the server: `reasonProblem` (10 to 500) for suite admin and temporary access reasons; the deletion reject reason and the matrix note are 5 to 500, and the matrix note is required only when a cell is taken away (`matrixDraft.ts`).
- `useAsync` reloads only on a key change and never sets state in an effect: put every input plus a retry counter in the key.
- Confirms are `AlertDialog`s whose action calls `preventDefault`, stays open and blocks close while busy; destructive actions use the destructive variant. Results go to sonner toasts with `errorMessage(error, fallback)`.
- Every view filter is a `Segmented` control inside a `Toolbar` (hidden when empty). The system filter is always `SystemSwitcher`: "All systems" first only with `allowAll`, and nothing at all when there is one system to pick. A second filter that isn't a system (People's status) is a select, so it never looks like another switcher.
- List views sit on the canvas as table cards (`AdminTable`: `bg-card`, `shadow-card`, suite spec 0016); People fills the content area edge to edge (`flush` on `AdminShell`). Never put a table card inside a card.
- The person page never depends on a picked system: every system is a row on the Access tab (read only for a system the viewer doesn't admin), and an action sends the system from `actionSystem` in `peopleRules.ts`.
- Suite admin versus system admin changes what shows (suite only views, the `All` switcher, matrix editing); the server still enforces every rule, so hiding is never the only check.
- The roles draft holds only flipped cells, one per system, stored through `useDraft`; a save sends `version`, and every read after a save or a `MATRIX_STALE` answer runs `checkDraft`, which keeps only the entries whose `from` still matches the server.
- Password check codes (`WRONG_PASSWORD`, `ACCOUNT_LOCKED`, `RATE_LIMITED`) get their messages in `reauthFailure` (`lib/adminErrors.ts`); view specific codes (`MATRIX_STALE`, `GRANT_ACTIVE`, `ACCOUNT_EXISTS`, the suite admin 409s) are handled in their view. `ACCOUNT_LOCKED` clears the password field.

## Gotchas

- Passwords, reauth tokens and the step up ticket live in component state only, never in `localStorage` or `sessionStorage` (spec 0003, AC-36). The stored things are a view preference, the sidebar collapse, `welinc:sidebar:<user id>` (`useSidebarCollapsed.ts`, suite spec 0016), and unsaved drafts through `useDraft` (the Roles page's `welinc:draft:<user id>:roles:<system>`, cleared on sign out).
- The sidebar links and the landing redirect go through `viewHref` (`adminViews.ts`), which keeps `?system=` and drops every other query; a new link between views should use it too.
- `?system=all` means suite wide only for a suite admin; the overview's links use it.
- The step up and reauth hosts are module singletons registered by the two dialogs' effects; without the dialogs mounted, `askForCode` resolves false and the call fails.
- Admin logic tests live in `src/lib/admin.test.ts` and `src/lib/adminApi.test.ts`, not beside the views.
- A bodiless `DELETE` needs `data: {}` in `adminApi.ts`: axios drops the JSON content type without a body, and welinc-auth's CSRF guard then answers 403 `CSRF_REJECTED` (see `deletePerson`).

## Related specs

- [Suite spec 0013, suite admin model](../../../../docs/specs/_root/0013-suite-admin-model/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
