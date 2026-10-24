# UCS native UI checkpoint

This checkpoint moves the UCS skin and reviewed flows into the real Svelte application. The HTML/CSS comparison remains preserved in the parent workspace repository; it is not the production API client.

The application retains real authentication, timing gates, flag verification, scoreboard queries, membership permissions, immutable archive snapshots and separate practice solves. Club/Event is separate from event lifecycle. Rules has its own route using the existing administrator Markdown setting, labeled Rules content in Settings. Ranking content is concentrated in live and archived Scoreboard routes.

Challenge lists scroll internally, details have an independently scrollable content area and fixed submit area, and long metadata remains accessible on narrow screens. Successful API responses drive the solve celebration; wrong and duplicate responses do not. The form closes when Club mode is configured or the exact end-time cutoff is reached.

Validation for the checkpoint:

- 1,113 frontend tests, 647 server tests, 106 admin-bot tests passed.
- Svelte check: zero errors and warnings; lint and production web build passed.
- Independent browser checks covered native challenge actions, long metadata, mobile history, login continuation, mode refetch, real wrong-flag handling, and responsive scores.
- Browser-only fixtures cover accepted-result animation, membership revocation, large metadata, and archive views; the live local archive is empty.
- Staged secret scan passed. Development credentials and database/runtime files are excluded from Git.

The deployment runbooks and security checks are included, but this is a development checkpoint. Container publication remains blocked by the documented root-bootstrap finding; real Docker deployment, backup restoration and load testing have not been completed here. The previously documented in-flight event-closure transaction gap remains open.

The next visual revision requested by the user restores the original rCTF Scoreboard and challenge arrangement more closely, while applying HTML-demo artwork and category skins. This checkpoint is retained for comparison.

## Current baseline and skin revision

Following direct comparison, the user chose the original rCTF full-viewport Challenges and Scoreboard arrangement. The Scoreboard page, graph, leaderboard and toolbar match upstream `364dc3b`. Challenge controls, tabs, stats and footer dimensions also use the original arrangement; the newer compact layout remains available at tag `ucs-integrated-checkpoint`.

The current skin adds yellow-lime accents, stronger light-theme foregrounds, character artwork across challenge rows, and an original SVG city mural spanning category headers. Collapse all categories on `/challenges` without a selected-challenge URL to see the continuous city; a deep link intentionally keeps its category open. The artwork is decorative and does not change category controls or header dimensions. Header height is the native 72px and the added divider is removed. Native submit geometry retains the verified Club/end guard, safe login continuation, duplicate protection and accepted-response celebration.

The archived-result route, membership checks and two view modes remain in place. UI state and data permissions are still enforced independently. Later layout changes require user feedback on this baseline.

## Multi-event member workflow

The subsequent member-event revision replaces the flat archive detail with a native-style challenge workspace and canonical URL context. Private club events now have independent schedules, snapshots and standings; the public event remains separate. See `club-backend.md` for routes, lifecycle and data limitations. The live Scoreboard now fills the available width following explicit user feedback.

Club management no longer contains the redundant Club events/Archive/Full settings shortcut row. Profile variants expose Guest participation, Member practice or actual administrative capabilities using the shared UCS visual system. Role is independent of native admin permissions. The local archive is now populated with three explicit fictional demo events; private event demos are seeded through normal APIs.
