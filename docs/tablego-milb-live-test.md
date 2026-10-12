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

Remote CI has not been run; local typecheck, zero-warning lint and 93 automated tests pass. Vercel performs the optimized build. Uploaded source excludes local credentials, captures, node_modules and build outputs through .vercelignore.

## Access and testing

Admin URL: https://tablego-milb.vercel.app/login

The new staff credentials are stored privately in /Users/james/Desktop/code/tablego/.staging/tablego-milb-admin-access.txt. The old 000/000 combination is not used for the hosted new application.

Use your own contact details for test bookings. Reservations are real records. Avoid editing or deleting another customer's reservation while testing. No broad test-cleanup endpoint is enabled outside staging.

Deployment validation must verify HTTPS staff auth, the real business-local availability/settings, notification-worker authentication/index availability, provider configuration, core guest pages and the unchanged original site's deployment.
