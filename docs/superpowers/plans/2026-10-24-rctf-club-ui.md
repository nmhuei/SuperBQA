# rCTF Club UI Implementation Plan

> **For agentic workers:** Use executing-plans for integration and bounded parallel
> runtime/theme work. Track the steps below and verify the final application.

**Goal:** Run genuine rCTF v2 with an English, ZZZ-inspired club interface.

**Architecture:** Preserve the Svelte application and backend. Add a themed home
dashboard using existing real API queries and a shared CSS theme. Retain native
challenge details, authentication, admin permissions, and scoring.

**Tech Stack:** Upstream Bun, Svelte 5, SvelteKit, PostgreSQL, Redis.

**Spec:** `docs/superpowers/specs/2026-10-24-rctf-club-ui-design.md`

## Global Constraints

- All website content must be English.
- No fake API or browser-local scoring.
- Preserve real event boundaries and read-only archives.
- Keep upstream licenses; no publishing or upstream pushes.

## Review Focus

- Logged-out visitors must have working registration/login and no fabricated progress.
- Start/end boundary and archive state must not imply submissions are open when closed.
- Hidden, duplicate, or non-flag challenges must not inflate mission progress.
- Mobile navigation and native challenge dialogs must fit 360px screens.
- API failures and empty catalogs must display useful states rather than endless loading.

### Task 1: Genuine runtime and baseline

- [ ] Install upstream-appropriate Bun/dependencies without changing dependency versions.
- [ ] Start dedicated local PostgreSQL/Redis with private local config.
- [ ] Migrate and seed a dedicated development database; start real API and frontend.
- [ ] Run baseline frontend tests and record any existing failures.

### Task 2: English dashboard using rCTF data

Files: `apps/web/src/lib/club/dashboard.ts`, corresponding
`apps/web/tests/lib/club/dashboard.test.ts`, `apps/web/src/routes/+page.svelte`,
and `apps/web/static/club/relay-mascot.svg`.

- [ ] Write and run failing tests for event boundaries, countdowns, and progress.
- [ ] Implement pure `getEventPhase`, `getEventCountdown`, and `getMissionProgress`.
- [ ] Replace the plain home card with event hero, real challenge cards, leaderboard,
      team progress, configured Markdown, and sponsors.
- [ ] Link cards to `/challenges?challenge=<id>`; preserve native submission behavior.
- [ ] Run the new tests and upstream frontend suite.

### Task 3: Theme, integration, and verification

Files: `apps/web/src/styles/club.css`, `apps/web/src/routes/+layout.svelte`,
navigation components, self-hosted assets, local run documentation.

- [ ] Add charcoal/lime design tokens, accessible light/dark variants, display font,
      angular controls, and navigation styling without changing permissions.
- [ ] Run Svelte check, frontend tests, formatting for changed files, and production build.
- [ ] Browser-test real registration/login, challenge deep links, wrong/correct flag,
      persisted solve, scoreboard, authorized admin and anonymous access restrictions.
- [ ] Check desktop/mobile, error states, English copy, and capture screenshots.
- [ ] Independent code review; address material findings and document remaining scope.
- [ ] Open the actual rCTF URL in Firefox and provide exact local run commands.
