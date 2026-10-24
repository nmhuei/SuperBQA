# Member archive flow implementation plan

> **For agentic workers:** Use subagent-driven-development for independent components and verification-before-completion before commits.

**Goal:** Deliver a real choose-event → Challenges → saved practice workflow for club members.

**Architecture:** Keep archive APIs and permission gates. A small route wrapper selects either the untouched live Challenge page or an archive workspace. URL helpers, keyed components and guarded submission completion keep archive/challenge/session state separate.

**Tech Stack:** Existing Svelte 5, TypeScript, TanStack Query, Bun 1.4.4, rCTF typed API and PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-24-member-archive-flow.md`.

## Global constraints

English UI, Vietnamese conversation. Preserve saved HTML demo and live Challenge/Scoreboard layout. No new dependencies. No private flag/token output. Full available page width, internal scrolling, mobile list/detail navigation.

## Review focus

- Different archives containing identical challenge IDs must never share selection, flag or solve state.
- Pending results after navigation/logout/revocation must not mutate the wrong visible state or session cache.
- Search/hide-solved must not implicitly select a different challenge.
- Reference-only challenges must not prevent practice completion from reaching 100%.
- Guest/direct-link/unknown/empty/loading states must not reveal cached member content or mount live challenge APIs.

## Tasks

- [x] Root: add tested `lib/club/archive-model.ts` for typed URLs, navigation context, catalogue filtering and practice progress; tests in `tests/lib/club/archive-model.test.ts`.
- [x] Backend agent: add optional additive `practiceChallengeCount` and `solvedCount` list summary fields with bounded aggregate queries scoped to caller. Regression tests in server club integration suite; no schema migration.
- [x] Workspace agent: add `lib/components/archive-workspace.svelte`, using root helpers and detail component. Category art/list filters, responsive splitter/list/detail, correct access and loading states; deterministic selection and history.
- [x] Detail agent: add `lib/components/archive-challenge-detail.svelte` with props `archiveId`, `challenge`, `solved`, `allowed`, `onClose?`. Define challenge as `ResponseData<typeof GoodClubArchive>['challenges'][number]`. Guard request identity/user/access and cache updates; test pure request guard if extracted.
- [x] Root: implement event-card chooser, lift current Challenges page unchanged into `live-page.svelte`, add archive-aware route wrapper/compatibility redirect, update Home/Admin/archived-score links and navigation context.
- [x] Independent tester: verify Member real API workflow plus fixtures for boundary states, history, stale results and duplicate IDs; capture all changed views at desktop/mobile in both themes. Create one real local snapshot only if necessary and event already ended.
- [x] Root: reconcile reviews, run web tests, relevant server tests, typecheck/lint/format/build; document flow graph and limitations; commit application and captures separately.

## Shared interfaces

`archive-model.ts`: `ArchiveData`, `ArchivedChallenge`, `ArchiveSummary`; `parseArchiveLocation(url)` returns `{archiveId, challengeId, query, hideSolved, catalogQuery}`; `archiveChallengeHref(archiveId, options?)`, `archiveCatalogHref(query?)`, `archiveScoreboardHref(archiveId, options?)`; `practiceProgress(challenges, solvedIds)` returns `{solved,total,referenceOnly}`. URL options are `{challengeId?,query?,hideSolved?,catalogQuery?}`. Workspace owns archive fetching/access; detail may use current user/access queries to guard submissions. Root owns query/navigation files and all route integrations. Agents must not edit those files.

## Execution ledger

- Audited preserved demo and native implementation. Found flat categories, missing URL state, stale form/response risks, missing readiness counts and scoreboard dead-end. Existing API and permissions are suitable.
- Ruling: canonical archive practice uses `/challenges?archive=...`, with a dedicated data-safe workspace rather than the live API-bound Challenge component. User explicitly delegated this arrangement.

## Authorized scope updates

The user's explicit follow-ups supersede the initial exclusions above: add private ongoing club events as well as archives, several demo events, full-width live Scoreboard, reuse settings in Club management, remove redundant admin shortcuts/content, and design role-specific Profile views. See the updated spec for final scope.

- [x] Archive API progress, seeded three demo archives, native workspace/detail and canonical routing.
- [x] Private event schema/routes/permissions/snapshot scoring/archive lifecycle and integration tests.
- [x] Additive migration applied locally; private database backup saved in ignored runtime directory.
- [x] Seed two concurrent private demo events and one upcoming event through normal admin APIs.
- [x] Remove Club management shortcut row, repeated copy and separate archive section; preserve essential actions.
- [x] Private event admin editor using shared settings/components and existing challenge sources.
- [x] Guest/Member/Admin profile variants with actual permissions and practice data.
- [x] Resolve independent browser findings, inspect all new captures and verify real API isolation.
- [x] Run final checks/review, update flow documentation, commit native code and root capture docs separately.

Browser QA caught real teardown null access and URL filter reactivity bugs. These are regression cases, not cosmetic exceptions. Local backup was completed after migration (the first backup attempt failed module resolution); no claim of a pre-migration backup should be made.

- [x] Role-specific Profile views, preserved native editing/security and 19 browser cases.
- [x] Shared desktop/mobile navigation preserves public destinations for Guest in both modes; eight role/capability regression tests.
- [x] Fresh database authorization and delayed-revocation regressions; verify direct private endpoint gates and bank-source permissions.

## Final verification

- Web: 1,176 tests; Svelte check zero errors/warnings; production build passed.
- API/server: 670 tests; admin bot: 106 tests; API/DB/types typecheck passed.
- Independent browser: 58 main cases plus 19 role-profile cases, including both themes/narrow screens and direct Guest denial.
- Real local API: Guest denial, upcoming Member/admin preview, concurrent identical challenge IDs, incorrect cross-event flag, and practice/public/frozen scoreboard isolation passed.
- Source secret scan: gitleaks passed. Final lint/format and independent code review are recorded in the saved checkpoint documentation.

Preserve this feature branch and both repositories. Commit locally as previously requested; do not merge, push or deploy. Earlier HTML snapshots remain unchanged.
