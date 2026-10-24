# Member events, archives and role profiles

The user delegated the member workflow design and subsequently confirmed both private active club contests and past member-only archives. Support multiple independent internal events while preserving the public rCTF event, Club/Event platform modes and saved HTML art variants. Website text is English.

## Event navigation and isolation

- `/archive` chooses a past event; `/challenges?archive=ID&challenge=ID` renders its snapshot in the familiar native workspace. `/archive/:id` remains a compatibility entry. `/scores/archive/:id` shows frozen standings.
- `/club/events` chooses a published internal event; `/challenges?event=ID&challenge=ID` renders its independent contest. `/scores/events/:id` shows only that event's standings. Upcoming events hide challenges from members; administrators can preview drafts. Submission windows are start-inclusive/end-exclusive.
- The global public event remains `/challenges` and `/scores`. URL context, cache keys, solve tables, rate limits and pending requests cannot cross contexts even when challenge IDs match.
- Search and hide-solved preserve explicit challenge selection. Refresh and history restore URL state; unknown IDs never silently substitute a different challenge. Desktop uses the native splitter, mobile list/detail navigation. Scrolling stays inside content blocks.

## Access and lifecycle

Effective Member access includes authorized administrators, while membership and native administrative permissions remain independent. Guests cannot read member events or archives. Membership revocation, bans, expired sessions and permission errors hide cached member content and retire pending submissions.

Settings administrators create private events using a frozen selection from the existing challenge bank or an existing archive. Only static supported challenges can be selected. Each event owns its schedule, publication state, challenges, solves and fixed-point standings. Metadata/schedule edits cannot change the start after it begins. Ended contests can be archived idempotently, freezing standings and opening independent practice progress. Practice never changes public or private contest results. No provisioning of dynamic challenge infrastructure is added.

## Administration and profiles

Reuse native settings parsing, account permissions, challenge sources and UI controls. Club management retains mode controls, current event schedule/actions and member approval. The user explicitly requested removing the Club events/Archive/Full settings shortcut row and redundant content; event management remains reachable through the Admin navigation menu. Merge archive action into its current event section and hide pagination when only one page exists.

The user also requested distinct profiles for Guest, Member and Admin. Preserve account/security editing. Show Guest event context, Member actual practice context and Admin actual granted permissions/actions, using one shared visual system and no fabricated statistics. Admin and membership badges remain separate.

## Visual and demo requirements

The user explicitly requested full-width Scoreboard; expand available width while preserving the native table/graph structure. Challenges remain unchanged for the public contest. Keep the preserved HTML/CSS demo and both art directions.

The user authorized multiple demo events. Seed three clearly marked fictional past archives idempotently without resetting data, plus published private demos with overlapping active windows and an upcoming event. Demo challenge IDs intentionally overlap to test isolation.

## Verification

Test permissions, schedule boundaries, multi-event isolation, duplicate submissions, idempotent archives, caller-specific progress, URL/filter/history and stale session responses. Capture and inspect dark/light desktop/mobile catalogues, workspaces, scoreboards, administration and profiles. Use independent browser QA, real local APIs, native web/server checks and production builds. Keep local credentials and database backups untracked.

## Navigation and API hardening follow-up

The user reported Guest losing basic navigation in Club mode. Both navigation implementations now share one capability model: Event/Home, Rules, Challenges and Scoreboard are always present; effective club access adds Club events and Archive; native permissions determine management items. Membership never implies admin permission.

The user explicitly requested Zero Trust API behavior. Audit authentication cache authority, direct private endpoint access, native permission revocation/bans, challenge-source permission checks and persistence after delayed authorization. Regression tests must demonstrate stale-cache bypasses fail after the fix. UI menus remain presentation only; database state and event scope authorize API operations. This local verification is not a claim of production load/security certification.
