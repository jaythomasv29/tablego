# TableGo refinement review and phased delivery plan

Reviewed October 10, 2026. Branch: `review/tablego-phased-refinement`.

This is a source-code review and implementation plan. No application behavior has been changed or deployed. Findings about deployed Firestore permissions and external services require staging verification; their configuration is not established by this repository.

## Findings and priority corrections

The proposed 20 improvements are broadly supported by the current code. Start with booking correctness and access control, and bring tests forward rather than postponing them until after refactoring.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Pending records and confirmed email copy disagree | `src/app/api/send-confirmation/route.ts`: `status: 'pending'`, email heading “Your table is confirmed.” | Guests and staff see different booking states. |
| Notification failure becomes booking failure | Same route: `addDoc` precedes `transporter.verify()` and both emails; outer catch returns 500 | A guest retry can create another reservation. Guest and restaurant delivery can also partially succeed. |
| Booking does not enforce availability | Same route writes submitted form data without calling an availability engine | Browser validation cannot protect the actual write. |
| Availability fails open | `src/app/api/availability/check/route.ts`: missing hours and catch return `available: true` | Missing configuration and infrastructure failure are treated as permission to book. |
| Availability rules disagree | `src/App.tsx`, `src/components/ReservationForm.tsx`, `src/app/reschedule/[id]/page.tsx`, availability API, admin reservation page | Rescheduling uses a 30-minute lead time and excludes a whole time slot when another reservation occupies it; the check API defaults to 50-minute lead time and 60-minute cutoff. |
| Public pages modify records by ID | Reservation page, reschedule page, `CancelReservationClient.tsx`: browser `getDoc`/`updateDoc` | Application code has no token authorization for these actions. Exploitability depends on deployed Firestore rules, which must be audited. |
| Admin access is insufficient | Root middleware checks cookie presence; source middleware checks literal `true`; login issues unsigned `company-auth=true` | Neither implementation verifies a server-authenticated session. Both match admin pages rather than API routes. |
| Sensitive APIs lack handler authorization | `api/check-reservations`, `api/delete-test-reservations`, notification handlers | Record enumeration, test-record deletion and message sending lack application-level access checks; deployed database permissions may affect execution. |
| Phone verification is caller supplied | Creation accepts `phoneVerified === true` from JSON | Persisted verification must instead come from a server-verified proof associated with the phone number. |
| Quality checks currently fail | `npx tsc --noEmit --pretty false`: seven errors; `npm run lint`: invalid-option failure | A production build currently suppresses both checks and cannot establish correctness. |
| Large files and duplicated configuration exist | Dashboard 1,947 lines, form 1,235, App 1,097, reservation console 1,020; two middleware and Tailwind configurations | Refactor incrementally after behavior is covered. |

The seven TypeScript errors concern unsupported button variants in the reservation console, DayPicker class-name and locale types, and a possibly undefined holiday. Lint fails before checking source files because its current invocation/configuration is incompatible with the installed tooling.

Some cleanup claims need qualification: both React Query packages are declared, but the source search did not establish active usage of either. `server/index.js` duplicates a booking endpoint, but package scripts run Next.js; confirm hosting and external consumers before removing it. Multiple UI libraries do not by themselves establish a defect.

The README also contains an incorrect timezone example: 20:00 UTC on February 16 is noon PST on February 16, not February 17. Use `America/Los_Angeles`, including daylight saving changes, rather than treating PST as a year-round offset.

## Phase 0 — Establish an isolated, measurable baseline

Addresses items 14–15 and preparation for 13.

- Use a separate branch per phase, with small reviewable PRs. Begin subsequent phases from the latest accepted code; use a dedicated integration branch if combining phases for staging.
- Provision a separate staging Firebase project, staging credentials and test recipients. A Git branch or preview URL alone does not isolate production data or prevent real email/SMS delivery.
- Inventory deployed Firestore rules, indexes, hosting entrypoints, chatbot API consumers and background notification jobs. Do not assume absent repository files imply absent production protection.
- Repair the seven TypeScript errors and lint invocation/configuration, then remove build suppression once checks pass. Add CI type, lint, test and production-build gates.
- Add an initial focused suite for current reservation/date rules and reproduce known inconsistencies before correcting them. Expand to roughly 20–30 high-value cases during phases 1–2.

Exit gate: reproducible clean checks and build, isolated staging, documented existing data shapes, and working guest/staff smoke tests. Existing behavior tests should distinguish intended behavior from known bugs.

## Phase 1 — Secure reservation actions and establish the domain contract

Addresses items 1, 16–17 and the foundations of 2, 8–10 and 18.

- Define typed booking states and legal transitions. Suggested model: `pending → confirmed → seated → completed`, with cancellation and no-show exits restricted to appropriate states. Define who confirms: guest acknowledgement and restaurant acceptance should be separate fields if they mean different things. Do not let rescheduling implicitly grant restaurant acceptance.
- Preserve and map legacy `status` and `attendanceStatus` records through a compatibility adapter. Inventory contradictory records before any migration; preserve cancellation/no-show history.
- Replace unsigned cookies with authenticated, expiring server-verifiable sessions. Enforce authorization inside every privileged API handler, including diagnostics/test endpoints, with appropriate CSRF/origin protection and abuse controls.
- Introduce a server-only database access boundary with appropriate credentials and deployed Firestore rules. Moving browser writes into routes while leaving database permissions broad would be incomplete. Migrate direct admin access in manageable slices before tightening rules that it depends on.
- Issue high-entropy management tokens, store hashes, scope them to one reservation and permitted actions, and define expiry/rotation. Keep tokens out of logs. Old ID-only links must not remain an authorization bypass; provide a verified recovery path for legitimate old links.
- Derive phone verification from server-side verification evidence; validate and allowlist booking fields instead of spreading arbitrary JSON into stored records.
- Introduce explicit availability outcomes: available, unavailable and unable to verify. Missing configuration/infrastructure errors should return an error such as 503 with a guest-facing retry/call message.
- Add an append-only reservation event timeline as these new actions are introduced, with actor, event, timestamp and correlation ID; avoid logging token values or unnecessary guest data.

Exit gate: unauthorized staff requests, forged/expired sessions, wrong-reservation tokens, invalid transitions and unverified phone claims are rejected. Existing legitimate bookings remain accessible through the agreed recovery/migration path.

## Phase 2 — One booking engine and reliable notifications

Addresses items 2–3, 10, 15, 18 and the SMTP part of 19.

- Build a pure reservation/availability policy module plus server-side configuration/data adapters. All slot generation and validation use it; booking and rescheduling revalidate at write time. Public UI, admin and chatbot consume the same API contract.
- Normalize real calendar dates, valid time formats, restaurant timezone, multiple closures on a date, custom ranges, past dates, lead time, last seating, slot alignment and business-hour boundaries. Explicitly decide inclusive/exclusive cutoffs and overnight-hour support.
- Decide actual capacity policy before implementing remaining-capacity indicators. The current rescheduler's “one reservation per time” exclusion is not a restaurant capacity model. Establish covers/table constraints and dining duration with staff, or describe availability strictly as hours eligibility until capacity is implemented.
- Use transactions for concurrent capacity allocation, if capacity is enforced, and idempotency keys for retry-safe creation/actions. Duplicate request protection must not block legitimate separate bookings by the same guest.
- Persist the reservation and durable notification intent together. Return booking success independently of provider delivery. Track event, recipient, channel, attempt count and delivery state separately for guest and restaurant notifications.
- Add a reliable worker/queue, bounded retries and staff retry visibility. Deduplicate events and guard concurrent workers. Provider success followed by persistence failure can still produce duplicate messages; use provider idempotency where available and document the remaining delivery guarantees.
- Centralize event types and email/SMS rendering. Align wording with status and distinguish requested, accepted, acknowledged and changed bookings. Remove SMTP `verify()` from the booking path; keep diagnostic checks outside guest actions.

Exit gate: concurrent requests and repeated submissions produce the agreed allocation and one booking per idempotency key; SMTP outage leaves a successful booking with a recoverable notification failure; rescheduling cannot lose the old booking if the new allocation fails.

## Phase 3 — Unified guest management

Addresses item 4 and customer-facing consistency from 1 and 20.

- Build one token-authorized management page showing details, booking status, acknowledgement state and permitted confirm/reschedule/cancel actions.
- Route legacy URLs through this experience without bypassing token checks. Update every email/SMS link and test previously issued links through the recovery policy.
- Make repeated actions safe, prevent double submissions, and show clear expired-link, loading, unavailable-slot and notification-delay states. Keep cancellation valid when notification delivery is unavailable.
- Apply shared typography, buttons, status colors and accessible mobile dialogs to this flow before attempting a site-wide visual pass.

Exit gate: full guest journey on desktop/mobile and expired/invalid links passes in staging; guest and staff views agree after every action.

## Phase 4 — Staff service workflow and useful guest history

Addresses items 5–9, admin portions of 12 and 18.

- Reorder Today around covers, upcoming arrivals, pending requests, cancellations, special requests, large parties and actions needing attention. Only show remaining capacity if phase 2 established real allocation.
- Add service-console search, filters, party badges, delivery states and authorized quick actions. Call uses a phone link; messaging requires a deliberate staff action and respects recorded consent.
- Group navigation into Today, Guests & Reservations, Restaurant Operations, Guest Engagement and Settings.
- Derive guest summaries from normalized email/phone with cautious matching and merge review; shared phones or addresses should not silently merge distinct people. Count completed visits separately from booking requests and cancellations.
- Surface prior no-shows and internal notes on reservations. Treat confirmation/deposit requirements as a later policy decision with separate implementation, rather than automatically adding payment handling.
- Extract domain components such as TodaySummary, ReservationActions and GuestHistory as each workflow changes.

Exit gate: staff can process a service using the console; guest-history counts reconcile with source records; access permissions protect internal notes and messaging.

## Phase 5 — Configuration, cleanup, performance and visual consistency

Addresses items 11–13, remaining 19–20.

- Centralize restaurant identity, contact details, timezone, policies, promotions and links in validated configuration with defaults and a clear split between public data and secrets. This is preparation for tenancy, not complete tenant isolation.
- Remove duplicate middleware and unused server/dependency/configuration code only after tracing imports, deployment configuration and external consumers. Migrate active uses before removing libraries.
- Continue domain extraction for inventory, team, public App and reservation form. Keep unrelated feature changes out of cleanup PRs.
- Replace site-wide cache prevention with explicit policies for public pages/assets, dynamic settings, authenticated responses and token-bearing guest pages. Measure before/after public performance and confirm content updates invalidate correctly.
- Standardize shared shadcn/Tailwind UI patterns progressively, including accessibility, mobile behavior, empty/loading/error states and status colors.

Exit gate: clean build and regression suite, no missing endpoint consumers, fresh dynamic data, private responses uncached, and a visual/mobile accessibility smoke pass.

## Test and release policy for every phase

Required checks: typecheck, working lint, focused unit/integration tests, production build and staging guest/staff smoke tests. High-value cases include daylight saving transitions, restaurant/browser timezone differences, invalid/past dates, full/partial/overlapping closures, custom ranges, opening/closing/cutoff boundaries, idempotent retries, concurrent allocation, notification partial failure, authorized cancellation, atomic rescheduling, state transitions and token/session abuse.

Deploy only an explicitly accepted phase after staging passes. Record the deployed commit, environment changes, database rules/index changes and rollback procedure. Use additive schema changes and compatibility reads before migrations; rolling back code alone does not undo a schema/rules change or messages already sent. Avoid destructive migrations during this refinement.

Observe booking errors, duplicate records, notification backlog/failures and unauthorized action attempts after release. Pause rollout on guest-facing failures or data inconsistencies. Tests reduce crash risk; they cannot guarantee zero crashes.

## Review limits

Typecheck and lint were run locally and failed as recorded above. A production build, live database audit, provider delivery test and staging browser test were not performed. No test runner is declared in package scripts. No production action, message, data migration or deployment was performed.
