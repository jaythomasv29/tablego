# TableGo milb: hosted test using the live database

October 13 update: the actual tablego site now runs the tested release, and reviewed Firestore rules have been published to the shared database. See [the production release and validation record](tablego-production-release.md). Statements below about retaining the original application and legacy rules describe the earlier milb-only rollout.

Authorized October 12, 2026: deploy the audited version to tablego-milb and use the real TableGo Firebase database.

## Target and scope

- Hosted URL: https://tablego-milb.vercel.app
- Vercel project: tablego-milb / prj_6uZ0zWNkY65eOT14odbkTklD7oO7
- Firebase project: tablego-1d712, shared with https://tablego.vercel.app
- Current branch: refinement/food-label-print-pagination, based on refinement/catering-bulk-close; deploy directly through the CLI to this project.
- The existing tablego project, its environment and application deployment are not changed. Both sites see the same live records, so reservation/settings/staff changes in the new site affect the real restaurant database.

This is a live-data test deployment. It does not use staging capture or mock OTP. Test actions can send real email and affect real reservations.

## Configuration completed

The milb Production environment uses its own canonical HTTPS URL, actual Firebase client configuration, an independent server service account with Firestore data access, strong staff credentials, a stable session/encryption secret and a worker secret. Session/encryption secret material must be retained for future deployments against the same management/outbox records.

Firebase Authentication was initialized as standard FIREBASE_AUTH, with no Identity Platform upgrade or billing change. Staff use server-issued custom tokens; no public sign-in provider was enabled.

Node is pinned to 22.x. Hosted API verification found the Firebase Admin 14 / jwks-rsa / jose module chain failing at startup under Vercel's default disabled require(ESM) mode. NODE_OPTIONS=--experimental-require-module applies the [documented Vercel runtime setting](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). The hosting preflight now checks it before deployment; dependencies and authentication validation remain intact.

The notificationOutbox state/nextAttemptAt composite index was added. Existing indexes and Firestore rules were retained.

Real Twilio Verify and SMTP authentication were checked without sending messages. Phone verification remains independent of optional reservation reminder consent.

## SMS sender issue found

The account's only owned SMS sender has an existing TWILIO_REJECTED toll-free verification record, last updated May 21, 2026. Recorded reason: code 30497, Use Case Summary is Incomplete. This predates this deployment.

[Twilio error 30497](https://www.twilio.com/docs/api/errors/30497) explains that the submission must specifically describe how and why messages are sent to opted-in recipients.

TABLEGO_SMS_REMINDERS_ENABLED=false applies only to milb until the sender is approved. Staff see the unavailable state; the reminder API refuses to queue sends. Twilio Verify OTP and real email stay enabled. No Twilio number, verification submission or existing tablego environment was changed.

After approval, set TABLEGO_SMS_REMINDERS_ENABLED=true for milb Production and redeploy; verify sender delivery with an explicitly consenting test guest.

## Compatibility limits

Live Firestore rules currently allow public access to several legacy collections, including reservations. Replacing these rules while the old tablego application still writes directly would break it. This deployment does not weaken or replace those rules, but its protected API/session model cannot prevent legacy direct database access. Complete the coordinated application/rules migration before treating the live database as fully hardened.

The daily Vercel Hobby cron is the retry fallback. Initial sends happen after the saved transaction; staff can inspect and retry failed deliveries. Frequent unattended retries still need the separate scheduler decision recorded in release-readiness.md.

Local typecheck, zero-warning lint and 150 automated tests pass. GitHub CI was subsequently run and passed for the October 13 production release. Vercel performs the optimized build. Uploaded source excludes local credentials, captures, node_modules and build outputs through .vercelignore.

## Access and testing

Admin URL: https://tablego-milb.vercel.app/login

The new staff credentials are stored privately in /Users/james/Desktop/code/tablego/.staging/tablego-milb-admin-access.txt. The old 000/000 combination is not used for the hosted new application.

Use your own contact details for test bookings. Reservations are real records. Avoid editing or deleting another customer's reservation while testing. No broad test-cleanup endpoint is enabled outside staging.

Deployment validation must verify HTTPS staff auth, the real business-local availability/settings, notification-worker authentication/index availability, provider configuration, core guest pages and the unchanged original site's deployment.

## Food label print pagination — October 13

Release code: a892e7e. Deployment dpl_6vvoMths3nPUhcMEyR6gPS2vr6XG passed the optimized Vercel build and was promoted to tablego-milb.vercel.app. The original tablego deployment remains dpl_9vRS5KSwugfWZ2bze7cEwfJc3AxF.

The label pages previously lived inside the dashboard's fixed-height, overflow-hidden scrolling layout, with an absolutely positioned print root. That could clip later label sheets during printing. The print root now mounts directly under document.body through a React portal, uses normal document flow, hides the dashboard only while printing, and keeps explicit sheet breaks with no forced break after the last sheet. Letter portrait paper, half-inch margins, four 3.5 × 4-inch flat tent cards per sheet, all seven styles and existing label editing remain unchanged.

Validation: typecheck, zero-warning lint and all 150 automated tests pass. Regression checks cover 1, 4, 5, 8, 9 and 12 labels, full and partial page groups, duplicated label instances, edited names and protein choices. The promoted canonical page loaded the real menu and displayed eight cards across two page groups. Read-only DOM inspection verified that the print root's parent is BODY and both groups contain four cards. These checks created no menu items, changed no live database records and sent no messages. Live availability still returns America/Los_Angeles policy and slots.

Native Google Chrome control was rejected by automatic approval review even after the user's access confirmation. Actual browser print-preview/PDF pagination has therefore not yet been independently verified; the user was asked to check Letter paper, All pages, eight labels and two sheets on the corrected hosted page. On-screen page groups are not a substitute for that final print-preview check.

## Deployed validation result — October 12

Initial hosted runtime fix: dad0fe0 / dpl_22oGetpGNkNSE3J4hH4KBQ4HTgCY. OTP recovery release: a7e3a4d / dpl_8yLgfxioWiyHVEaW9CPKi5Cx9xPE. Today activity release: 684b2a8 / dpl_HLSeykZzMrkiLPiefb5EsyQ86fxb. Verified-phone release: 247aefe / dpl_2WJNQ4cbbdqDQZEPCz9E5xjiB12t. Guest-edit release: 5db8759 / dpl_BR1YmzWA5iEj6kGNYQzWUFPMVeMY. Catering-workflow release: 26bfc5a / dpl_Dw6ZngsdGBfe9ftnEGw47Bo8ZNPs. Current release code: c7eeba3. Ready deployment: dpl_2NfJMsZbA2PyCosdcT9JxMo7GnRj, Node 22.x, promoted to tablego-milb.vercel.app after the optimized build, hosted bulk review/access checks and existing reservation availability checks passed.

- Canonical HTTPS staff login succeeds with Secure/HttpOnly cookies. Firebase accepts the hosted custom staff token; Today loads existing live reservations.
- Availability returns real America/Los_Angeles policy and slots. Public menu, catering, login and guest route shells respond successfully. Desktop and 390 × 844 mobile booking controls were reviewed.
- Authenticated notification-worker invocation succeeds against the ready index; unauthenticated staff and worker requests are rejected.
- A single clearly labeled owned-contact fixture was created for staff confirmation testing. The hosted confirmation API saved Confirmed; both guest and restaurant emails were accepted by the real SMTP provider on the first attempt. Inbox receipt of this new test has not been independently confirmed.
- Secure guest access rejected ID-only access and returned the correct business-local booking details without contact fields. Browser cancellation succeeded; the fixture is Cancelled and its cancellation emails were also accepted. No other customer reservation was modified.
- The hosted Twilio OTP send and verification succeeded with a fresh code supplied by the test recipient. The public customer submission created a real phone-verified booking, automatically Confirmed with confirmedBy=automatic. Guest and restaurant confirmation emails were accepted by SMTP on the first attempt.
- The public test booking was immediately cancelled through its authorized guest link. Its saved status is Cancelled; both cancellation emails were accepted by SMTP on the first attempt. Test contacts were the user's expressly approved contacts; other customer records were not changed. Inbox receipt of these new test messages has not been independently confirmed.
- The first code had expired during the hosted checks. Twilio's documented 404/20404 response now returns a recoverable 400 with instructions to request a new code, shown by the booking form. Regression tests also verify that provider outages remain server errors and only approved verification can issue proof. See [Twilio Verification Check](https://www.twilio.com/docs/verify/api/verification-check).
- The current runtime error log was empty after successful API checks. This is evidence for these requests, not a guarantee against all future failures.
- The original tablego deployment remains dpl_9vRS5KSwugfWZ2bze7cEwfJc3AxF; its home and availability endpoint still respond successfully.

The test fixture, its private links and provider logs are retained locally for review; the fixture remains cancelled. Credential material and local logs are excluded from Git and Vercel source uploads.

## Today activity update — October 12

The Needs attention section is replaced with a compact bell next to All reservations. It notifies staff about new creations across reservation dates; opening the popup reads those notifications automatically. Closing it clears the read list, so reopening shows an up-to-date state. No booking confirmation, attendance action or separate dismissal is required. Booking data does not change when reading activity.

Read state persists on the device through normal refreshes and navigation and synchronizes between tabs. The first authoritative snapshot establishes a quiet baseline; historical bookings and status edits do not become new alerts. Cached snapshots cannot clear unread activity. Notifications use creation timestamps, while displayed dates and times retain the restaurant timezone.

Earlier and pending bookings remain in the ordinary Arrivals / Later today lists. Incomplete imported bookings remain accessible under Other bookings. Removing the attention queue does not hide those reservations or automatically change their statuses.

Isolated staging browser checks verified a new future-dated booking produced one badge, opening cleared it, closing/reopening showed an empty up-to-date popup, refresh retained read state, Escape dismissed the popup, and the layout fit 390 × 844. Two owned synthetic fixtures were cancelled without queuing messages; no live customer records were modified. Automated checks cover timestamp ties, status edits, reconnects, cached snapshots, read persistence, cross-tab synchronization and Today grouping in international timezones.

After promotion, the canonical hosted Today page loaded its real service records, displayed the bell, and opened the empty up-to-date popup. Needs attention is absent. Existing future arrivals remain visible. The hosted availability endpoint still returned America/Los_Angeles and valid slots. The separate staff smoke-test session was logged out.

## Verified customer phone update — October 12

Today shows the customer phone and a compact Verified badge directly in each booking card. Reservations, expanded contact details, guest profiles and catering leads use the same badge. The stored number must be valid and have phoneVerified=true with phoneVerificationSource=server; legacy caller flags do not supply that proof. This verifies the number rather than the guest's identity or consent to marketing messages.

Catering uses the existing OTP send/check endpoints and phone-proof cookie. The request button stays disabled until verification succeeds, editing the number resets verification, and stale asynchronous code responses cannot verify a changed number. The submission endpoint always requires a valid unexpired signed proof matching the normalized US phone number; caller-supplied verification flags are ignored. Verified metadata is saved on the lead. The hosting preflight now requires Twilio Verify credentials for catering even when optional reservation OTP is disabled. Production uses real Twilio Verify; isolated staging captures its codes.

Tests verify absent, forged, expired, wrong-kind and mismatched-phone proofs are rejected without saving leads or queuing messages, and successful retries retain one normalized verified lead and two recipient jobs. Staging browser checks cover disabled/enabled submission, an actual saved inquiry, badges on Today/Reservations/catering leads, and 390 × 844 layouts without horizontal overflow. The native event date was entered and checked in the restaurant calendar. New inquiry emails were captured successfully. The owned reservation was cancelled and both owned catering leads were completed after review; no live customer records were changed or messages sent by these checks.

The catering lead view also reads current partySize and specialRequests fields while retaining support for legacy guests/message fields, so the verified inquiry's party size and request remain visible to staff.

Hosted verification: an unverified request with caller-supplied true/server fields returned 403 without creating a lead. The business availability endpoint returned America/Los_Angeles and valid slots. The canonical Today page showed the badge next to an existing legitimately verified number, and the public catering page showed the required verification step with submission disabled. No new live OTP or email was sent for this patch; its send/check endpoints were previously tested with the user's real Twilio code, and the new catering end-to-end submission was tested using captured staging codes.

## Guest reservation editing and cancellation reasons — October 12

The guest management page now offers Edit reservation with date, time, party size (1–20) and optional special requests (up to 2,000 characters). Requests can be cleared. Existing date/time stays selected when changing only party size or requests, even when that booked slot is no longer offered for new bookings or availability temporarily fails. New date/time selections still require the restaurant's availability check. Dates and times remain in the restaurant timezone.

Timing and party changes follow the existing automatic/manual confirmation setting and reset guest acknowledgement. Requests-only changes retain status and acknowledgement. Updates validate the current booking version, preserve omitted fields for older clients, save a before/after timeline and queue durable emails containing the saved details. Repeating an already saved change creates no duplicate update or notification.

Cancellation offers Plans changed, The time no longer works, My party can’t attend, Booked somewhere else and Other. The selection is optional; Other requires a typed reason of up to 500 characters. The reason is visible on the guest receipt, staff booking card/timeline and cancellation email. Repeated cancellation preserves the original reason. Staff cancellations and older clients without a reason remain compatible.

Validation: 121 automated tests, typecheck and zero-warning lint pass. Isolated staging API checks cover partial and combined edits, request clearing, stale versions, invalid inputs, unavailable times, automatic/manual acceptance, idempotent edits/cancellations, both reason formats, staff history and captured guest/restaurant emails. The 390 × 844 browser flow saved six guests and a multiline request, then cancelled with Other; no horizontal overflow was observed. All three owned synthetic reservations are cancelled. These checks sent no real messages and changed no live customer records.

Source commit: 5db8759. Ready Vercel deployment: dpl_BR1YmzWA5iEj6kGNYQzWUFPMVeMY, https://tablego-milb-frj6360ja-jaythomasv29s-projects.vercel.app. Vercel's optimized build, lint and type checks passed. The protected deployment returned 200 for business-local availability and authorized read-only access to the previously cancelled owned live fixture, including the new cancellationReason field without exposing phone/email fields. After promotion, the canonical URL passed the same checks. No live guest updates or new provider sends were performed for this patch.

## Catering admin workflow — October 12

The redesigned Catering inquiries inbox defaults to active inquiries sorted by upcoming event, with compact stages, search, due-follow-up filtering, refresh/retry and visible loading/failure states. The review dialog displays the full budget, event type/location, menu, requests and verified contact details. Staff can draft an email in their own mail app, record private notes and a follow-up date, and move between New inquiry, In conversation, Confirmed event, Completed and Not proceeding. Closed records can be reopened. Stage changes are internal tracking and send no customer notification or payment request.

Authenticated APIs read/write the new cateringStaff collection for workflow, notes, follow-ups and versions; the public legacy record retains compatible pending/completed status. Caller-supplied fields in legacy records cannot populate private staff work. Existing live rules deny client access to the unmatched cateringStaff path: anonymous REST checks returned 403 there and 200 for the public settings control. No live rule publication was needed. Legacy contact/inquiry exposure remains a separate migration issue.

Validation: 135 automated tests, typecheck and zero-warning lint pass. Staging API tests verified authorized/unauthorized/origin checks, malformed and legacy records, preserving guest details, protected note storage, status/follow-up/history updates, no-op retries, stale versions and old-client completions, closure/reopening and no admin-generated outbox jobs. Browser checks verified desktop and 390 × 844 inbox/details, persistent date selection entered through the native keyboard control, saving multiline notes, visible save results, sticky actions and unsaved-close recovery. No horizontal overflow was observed. Six owned synthetic inquiries across the two test runs were closed; old synthetic public staff fields were removed. No live customer records were edited and no real messages were sent for these checks.

The [future catering feature list](catering-admin-roadmap.md) records the immediate changes and a prioritized backlog including quotes, branded conversations, guest acceptance, assignments, calendars, payments and event-day operations.

Source commit: 26bfc5a. Ready deployment: dpl_Dw6ZngsdGBfe9ftnEGw47Bo8ZNPs, https://tablego-milb-jalk40uff-jaythomasv29s-projects.vercel.app. Vercel optimized build, lint and type checks passed. Hosted verification returned 401 for an unauthenticated catering list, 200 for staff login/list/detail/history, and 403 for a cross-origin PATCH against a nonexistent check ID. All 84 existing live inquiries normalized successfully. Reservation availability still returned valid slots in America/Los_Angeles. The separate verification session was logged out; no live inquiry updates or customer sends were performed.

After promotion, the canonical browser loaded the new page with Active 28, New 28, Closed 56 and All 84, sorted by Upcoming event. The anonymous canonical API still returned 401. The original tablego project remains on dpl_9vRS5KSwugfWZ2bze7cEwfJc3AxF. Source stays on its own catering testing branch; the original source worktree is unchanged.

## Catering bulk inbox reset — October 12

Close all active inquiries opens a review listing the current active set across all search/stage filters, including any confirmed events. Mark N completed moves that exact set to Closed, preserving notes and guest input while clearing follow-up dates and adding a bulk-action timeline entry. Cancel leaves inquiry records unchanged. New arrivals after review remain active. Reviews expire after 15 minutes and belong to the staff session that created them. Changes to any reviewed public or private document reject the entire transaction before writes. Completed-operation retries are idempotent, including after inquiries are reopened. The oldest 100 are reviewed per operation for large inboxes; the remaining count is disclosed, and staff repeat the action as needed. No records are deleted and no customer messages are queued.

Review receipts use the new server-only cateringBulkClosures collection, denied by unmatched live rules and excluded in the proposed restrictive rules. No live rule publication is needed. A cleared Active view shows Your active inbox is clear and links to Closed.

Validation: 148 automated tests, typecheck and zero-warning lint pass, including authorization/origin checks, preview scope, concurrent/legacy updates, deletions, expiry/session mismatch, retry safety, preserving original details, empty views and a bounded 100-record transaction. Isolated staging exercised real atomic closure of three owned fixtures, stale-document rejection without partial closure, a new arrival remaining active, protected receipts, retained notes, timeline and zero outbox jobs. The private staging receipt was narrowed through the staging service account so unrelated staging inquiries were not touched; production has no client subset override. Four API fixtures and one separate confirmed-event UI fixture were closed after review.

Desktop/mobile browser checks reviewed five inquiries while the search matched zero, flagged the confirmed event, displayed the scrollable list and kept cancellation/confirmation controls visible at 390 × 844. Keep inquiries closed the dialog while all five statuses remained unchanged. The confirmed UI fixture was then closed individually for cleanup. Live staff make the final reset decision; this rollout does not execute bulk closure of live customer inquiries.

Source commit: c7eeba3. Ready deployment: dpl_2NfJMsZbA2PyCosdcT9JxMo7GnRj, https://tablego-milb-i44erepi6-jaythomasv29s-projects.vercel.app. Vercel optimized build, lint and type checks passed. The hosted bulk endpoint returned 401 without staff access, 200 for an authenticated review of the 27 current active inquiries, 403 for a foreign-origin preview, and 409 for confirmation of a nonexistent review. Inquiry statuses/versions were identical before and after the hosted checks. Existing restaurant-local availability passed. The separate verification session was logged out.

After promotion, the canonical browser loaded the new button, opened the review listing all 27 active inquiries and dismissed it with Keep inquiries. Counts remained Active 27, Closed 57 and All 84. The canonical anonymous preview endpoint returned 401; anonymous REST access to the receipt collection returned 403. No live bulk confirmation was performed. The original tablego deployment remains dpl_9vRS5KSwugfWZ2bze7cEwfJc3AxF.
