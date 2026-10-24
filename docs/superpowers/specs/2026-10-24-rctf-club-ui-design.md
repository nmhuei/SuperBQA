# UCS platform interface and delivery requirements

The club is named UCS. rCTF supplies the application architecture and existing
competition services; UCS needs its own coherent interface. All website content
must be English. ZZZ informs the palette and optional character backgrounds, not
the website structure.

## Selected approach

Customize the upstream Svelte frontend in place, retaining its API, authentication,
permissions, submissions, scoring, admin controls, and challenge instancing UI.
A standalone replacement was rejected by the user. Later, the user explicitly
requested isolated visual prototypes before choosing the character art direction.
The current prototype at `../../../../prototypes/zzz-art-comparison/` is a design
review artifact, not a replacement backend. Port approved layouts into the real
Svelte app with native queries and permissions.

## Design

Use charcoal surfaces, muted lime highlights, restrained geometry, and condensed
display headings. Keep ordinary CTF navigation, forms, and tables. Do not imitate
the game website layout or add decorative labels without a user-facing purpose.
Retain readable body text, light-theme support, keyboard focus, native navigation,
mobile challenge dialogs, and functional admin controls.

Club mode prioritizes member practice and archived events. Event mode prioritizes
the current event, challenges, rules, and standings. Guests compete in public
events but cannot access member archive data. Administrators grant membership and
manage the explicit mode; administration and club membership are separate grants.

Every production statistic comes from native queries. Missing or failed data gets
an honest loading/error/empty state. Archived event results are immutable and
practice solves are separate from the original competition. Closing an event
leaves an ended event view; it must not silently become Club mode.

Challenge detail uses an approved, simple geometric background with readable text
and a clear flag form. Both proposed card art directions remain in the prototype:
one character/category split across SVG viewports, or one character/challenge.
These viewports embed original PNG artwork; they are not traced vector characters.

Correct-solve feedback is a brief diagonal “MISSION COMPLETE” ribbon with restrained
particles. In production, only a new accepted API solve triggers it; failures,
duplicate solves, and retries do not. The animation does not steal focus or block
input. Reduced motion uses static feedback. Prototype replay controls must not
ship as competition functionality.

Use pagination and tabs to keep primary actions within one viewport where
practical. Each visible element must support orientation, current state, or a
specific action. Remove duplicated handles/logos/counts and repeated helper text.
Detailed visibility rationale is recorded in the prototype README. Capture and
inspect desktop, laptop, and mobile screens after layout changes.

## Constraints and scope

- All website content must be English.
- Do not replace authentication or flag validation with browser-local simulations.
- Preserve upstream LICENSE/NOTICE files; remove prominent “powered by rCTF” UI branding.
- Sample content may be seeded into a dedicated development database, clearly
  identified as development data; it must use the actual API and scoring system.
- Preserve server authority over event start/end and archived/read-only behavior.
- Club membership, immutable archive snapshots, and separate practice persistence
  are implemented in the actual API. Unsupported dynamic/instancer-backed archive
  challenges must disclose that replay is unavailable.
- Local runtime is sufficient; do not publish to the internet or push upstream.

## Builder decisions

Use an isolated clone under `rctf/`, a feature branch, and upstream Bun tooling.
Reuse the upstream query cache and components rather than adding another framework.
Use a dedicated local PostgreSQL/Redis runtime to verify full-stack behavior.

## Delivery and operational requirements

The UI is one workstream. The actual application needs repeatable builds, tests,
CI, dependency and secret scanning, least-privilege operation, configuration and
secret management, backup/restore verification, rollback instructions, and event
load testing. The existing operations package builds this source checkout rather
than an unchanged upstream image.

Keep the platform control plane separate from untrusted challenge workloads. Do
not expose database ports or give challenge containers the platform's credentials.
Record unverified work explicitly: this local machine currently has no Docker
daemon, so actual container rollout/recovery and target-environment capacity have
not been validated. Local UI captures and static configuration checks are not a
production-readiness claim.
