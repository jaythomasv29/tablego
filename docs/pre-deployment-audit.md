# TableGo: deployment comparison and final audit

Historical audit completed October 11, 2026. Test branch: refinement/pre-deployment-audit. Isolated checkout: /Users/james/Desktop/code/tablego-release-audit. At that point nothing was pushed, merged into local main, or deployed.

October 12 update: the audited version is now hosted on tablego-milb with the real database. See [the live deployment and test report](tablego-milb-live-test.md) for current configuration, verified OTP/booking/email/cancellation, and remaining SMS sender and legacy database rules limits. The deployment gates below describe the October 11 findings; they are not the current deployment status.

## Confirmed production baseline

The authenticated Vercel **tablego** dashboard shows the current Production deployment as Ready, created August 7, 2026 at 22:47:14 UTC, source main at **2905408a995cd7b3e09171b1a00bfd6e77fc9ef8**, with tablego.vercel.app among its current domains.

[Recorded deployment](https://vercel.com/jaythomasv29s-projects/tablego/9vRS5KSwugfWZ2bze7cEwfJc3AxF) · [Deployed source](https://github.com/jaythomasv29/tablego/commit/2905408a995cd7b3e09171b1a00bfd6e77fc9ef8)

The earlier phase branches began at the older local 73c871c. Fetching remote main revealed four later commits adding follow-ups, guest feedback and date/UI refinements. The audit reconciles these features with the replacement architecture. Their absence from the earlier testing branch was a regression, not an intentional removal.

Audit fixes are committed as 386c532. Remote main is also an ancestor of the audit branch through a local reconciliation merge. The merge deliberately retains the tested replacement tree after reviewing all remotely added features; it does not reintroduce unauthenticated mail handlers or GET attendance mutations. Local main and the original preview branch remain unchanged.

## What changed, and why

| Area | Deployed behavior | Release candidate | Purpose |
| --- | --- | --- | --- |
| Reservation status | Pending booking with an email saying confirmed | Auto-confirm defaults on; optional manual acceptance; shared status rules and messages | Guests and staff agree on whether a table is confirmed |
| Availability | Independent calculations and a fail-open error path | One policy for slots, creation and rescheduling; errors fail closed; full and partial closures | Prevent bookings at unavailable times |
| Local dates | Conversions could depend on viewer location | Business calendar dates and IANA timezone for cutoffs, Today, arrivals, receipts and templates; international/DST tests | Prevent dates shifting when viewed internationally |
| Booking reliability | Email failure could make a saved booking look unsuccessful | Transactional idempotency, durable per-recipient jobs, leases, retries and obsolete-message suppression | Avoid duplicate bookings; preserve failed messages |
| Guest access | IDs authorized direct browser reads/writes | Scoped secret links, server APIs, verified phone recovery, private cache/referrer headers | Protect customer details and actions |
| Staff access | Simple credentials, forgeable cookie, incomplete API protection | Signed revocable sessions, authenticated APIs, Firebase custom tokens and restrictive rules | Enforce staff access beyond page navigation |
| Today | Metrics competed with the service workload | Today's arrivals, parties, requests and attention first; finished service collapsed; delivery tools below | Reduce work during service |
| Reservations | Actions and message details spread across screens | Search/filters, quick actions, private notes/preferences, timeline and delivery/retry details | Resolve a booking in one place |
| Guest/no-show history | Separate bookings and grouping by contact alone | Conservative identity groups, source history, shared-contact warnings, no-show history on bookings and its own page | Avoid attributing another person's history to shared contacts |
| Follow-ups | Unauthenticated direct sends; readiness based on arrival plus delay | Staff-only manual requests after completion, scheduled arrival and completion delay; one durable intent per visit | Preserve the feature with controlled eligibility and recovery |
| Guest feedback | GET links changed attendance; ID-only writes; selective review redirects | Explicit authorized POST, separate feedback-only token, idempotency, escaped staff notification; no attendance changes; public review link available to all sentiments | Email scanners and guests cannot silently change staff attendance |
| Feedback preferences | No stop mechanism | Guest can stop future visit feedback requests for the saved email, without submitting a review | Respect guests who do not want further requests |
| Booking sound | Original alerts lost during the phase rewrite | Restored after first server snapshot; modifications/reconnects do not alert; unavailable audio/storage fails safely | Preserve staff awareness without an opening-page burst |
| Guest design/sharing | Separate utility pages; no invitations | Unified branded management, finite place-setting animation with reduced-motion support, responsive read-only invitations | Make dinner plans easier to manage and share |
| Invitation privacy | No corresponding deployed flow | One email at a time, saved booking details only, owner authorization, limits/idempotency; no owner secret, staff notes or guest contacts | Share useful details without granting control |
| Branding/structure | Duplicated details/templates, large pages, obsolete infrastructure | Validated restaurant configuration, shared domain/components/templates, cleanup, disabled chatbot | Reduce drift and make changes easier to maintain |
| Quality/performance | TypeScript/ESLint failures suppressed, site-wide caching disabled, SMTP verification during booking | Required typecheck/lint/build, 92 tests, no per-booking SMTP verification, public caching and private staff/guest responses | Raise the release quality floor |

Remaining capacity, deposits, loyalty rewards, campaigns, inbound email/SMS reply parsing and a separate chatbot integration are not implemented in this immediate release. No table/capacity model is invented. Private preferences remain attached to their source booking; no marketing subscription is created.

## Additional fixes from this audit

- Restored newer follow-up, feedback and no-show routes securely. Preserved existing followUpSent, privateFeedback, privateFeedbackAt and feedbackRespondedAt data to prevent duplicate requests.
- Old feedback GET links redirect to the feedback page without writing attendance. A verified booking phone can recover a feedback-only link; that link cannot cancel/reschedule a booking.
- A completed booking cannot receive a request before its scheduled arrival in business-local time. Delay follows the completion timestamp; legacy completion without a timestamp requires staff review.
- Restored partial-closure explanations using the full calendar date, including year. Guest rescheduling retains a native date input with authoritative slots and server revalidation.
- Restored native light/dark control color schemes; guest pages retain the restaurant light palette.
- Added build/runtime guards for hosted previews: explicit staging, independent Firebase project/credentials, capture mode and no hosted provider-test exception. Production rejects staging/capture settings and weak/missing staff/session/worker setup.
- Added a secret-safe release preflight, implicit SMTP TLS on 465 and required STARTTLS on other configured ports, following [Nodemailer transport options](https://nodemailer.com/smtp). Live SMS reminder queuing refuses a missing sender number.
- Staging cleanup now removes related events, access, outbox and idempotency documents. Broad cleanup was not invoked; other retained fixtures were left intact.

## Validation

**92 tests pass**, zero failures. Typecheck, lint with zero warnings, and the optimized staging build pass.

Staging checks passed for staff/origin permissions, completed-visit delay, legacy GET non-mutation, old notification endpoint rejection, concurrent follow-up and feedback idempotency, captured delivery, separated owner/feedback access, unchanged attendance/status/version, email opt-out across visits and verified-phone token rotation.

Existing integration checks passed for direct-write denials, phone proof, concurrent creation, lifecycle conflicts, rescheduling/cancellation, notes/preferences, independent recipient failures, provider recovery, concurrent worker leases, exhaustion, deliberate retry, missing-policy failure, auto/manual confirmation, old staff form compatibility, invitation privacy/limits/idempotency and private/public caching.

Browser checks cover desktop and 390 × 844 mobile feedback, successful mobile submission, staff visibility of the response, restored navigation and delivery controls. Captured email HTML was reviewed in a browser; this does not establish rendering in every email client.

No live email, SMS or OTP was sent by this audit. Earlier explicitly approved real OTP and confirmation-email testing is documented separately; the recipient confirmed receipt. Audit communications use synthetic staging captures.

Runtime dependency audit: **zero findings**. Full audit: **16 development-tool findings (2 moderate, 14 high)**. A broad ESLint/Tailwind migration remains separate; suggested forced fixes change major tool versions. This is not an entirely clean dependency audit.

Current optimized home output is about 33 kB / 327 kB first-load JavaScript. This measures bundle size, not real user speed. No fresh production Lighthouse or production load test was performed.

## Verified hosting gaps

| Project variable | Observed state |
| --- | --- |
| ADMIN_USERNAME, ADMIN_PASSWORD | Present in all environments; values not revealed/changed |
| ADMIN_SESSION_SECRET | Absent from project list |
| FIREBASE_SERVICE_ACCOUNT_JSON | Absent; listed Firebase variables are public client configuration |
| CRON_SECRET | No matching project variable |
| Public Firebase variables and NEXT_PUBLIC_BASE_URL | Shared across all environments |
| Twilio/OTP provider variables, including sender number | Present for Production and Preview; values/provider validity not checked |

This is project-variable evidence; every shared/team integration was not inspected. The required configuration is not ready for the release.

Before release:

1. Set independent preview Firebase/capture configuration and canonical HTTPS URL. Keep production credentials/providers outside preview scope.
2. Supply the matching production Firebase server credential, strong staff credential, stable session/encryption secret and worker secret. Run the secret-safe preflight within the intended Vercel environment.
3. Coordinate the app with reviewed Firebase Authentication, rules/indexes and legacy reads. Restrictive rules published before an old public-write client would break it. Recheck public settings for historical secrets.
4. Run hosted HTTPS staff/guest tests, including recovery, email and retry. Remote CI has not run because this branch has not been pushed.
5. Activate and test frequent authenticated retries. Hobby permits one Vercel cron per day with timing uncertainty; the daily fallback is insufficient for timely backlog recovery. The worker handles five due jobs per invocation. See [Vercel limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Immediate delivery is best effort.
6. Verify uploads against the intended Storage bucket, production providers and rollback. Staging upload and production rollback rehearsal remain unverified.

No production credential/rules/index change, deployment, billing upgrade or campaign was performed. The candidate is locally validated; **production readiness depends on these gates**.

## Review locally

    cd /Users/james/Desktop/code/tablego-release-audit
    node scripts/staging.mjs build --audit
    node scripts/staging.mjs start --audit

Audit preview: http://127.0.0.1:3105. Separate build directory, captured notifications, existing staging staff access. Original previews remain available. Run the hosting-variable check with node scripts/release-preflight.mjs inside the intended environment.

Private test logs and synthetic feedback fixture are under .staging/. Do not commit its secrets, captures or links.
