# TableGo milb: hosted test using the live database

Authorized October 12, 2026: deploy the audited version to tablego-milb and use the real TableGo Firebase database.

## Target and scope

- Hosted URL: https://tablego-milb.vercel.app
- Vercel project: tablego-milb / prj_6uZ0zWNkY65eOT14odbkTklD7oO7
- Firebase project: tablego-1d712, shared with https://tablego.vercel.app
- Branch: refinement/pre-deployment-audit; deploy directly through the CLI to this project.
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

Remote CI has not been run; local typecheck, zero-warning lint and 105 automated tests pass. Vercel performs the optimized build. Uploaded source excludes local credentials, captures, node_modules and build outputs through .vercelignore.

## Access and testing

Admin URL: https://tablego-milb.vercel.app/login

The new staff credentials are stored privately in /Users/james/Desktop/code/tablego/.staging/tablego-milb-admin-access.txt. The old 000/000 combination is not used for the hosted new application.

Use your own contact details for test bookings. Reservations are real records. Avoid editing or deleting another customer's reservation while testing. No broad test-cleanup endpoint is enabled outside staging.

Deployment validation must verify HTTPS staff auth, the real business-local availability/settings, notification-worker authentication/index availability, provider configuration, core guest pages and the unchanged original site's deployment.

## Deployed validation result — October 12

Initial hosted runtime fix: dad0fe0 / dpl_22oGetpGNkNSE3J4hH4KBQ4HTgCY. Current release code: a7e3a4d. Ready deployment: dpl_8yLgfxioWiyHVEaW9CPKi5Cx9xPE, Node 22.x, promoted to tablego-milb.vercel.app after verifying availability and the retired-challenge recovery response on its deployment URL.

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
