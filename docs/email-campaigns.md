# Email campaigns · first rollout

The admin's **Guest engagement → Email campaigns** page creates editable campaign drafts, previews each HTML email, schedules a sequence, and shows its progress. The recommended sequence is Day 0 (local lunch perk), Day 7 (Happy Hour), and Day 21 (catering). The first message sends on launch; later messages use the daily worker. Copy and intervals are editable before launch, with a minimum seven days between touchpoints. Offer expirations are checked both before launch and before delivery. Pause, resume, cancel, and explicit review/skip controls are available. Launched copy is immutable so the history remains meaningful.

## Scope of the first test

**The server permits only `thaiphoonpaloalto@gmail.com`.** Supplying another recipient in a request cannot change that. Only one test campaign can be active at a time. Creating or launching a test does not mark that address as a confirmed marketing subscriber. Historical reservation and catering contacts are never enrolled or sent these campaigns. This rollout deliberately does not enable a bulk audience; subscriber campaigns need a separate reviewed audience/provider rollout after this test succeeds.

## Provider configuration

Existing SMTP remains the default, and reservation/catering notifications are unchanged. SMTP reports acceptance by the email server, not inbox delivery. Ambiguous errors pause the campaign and never automatically retry.

To use Resend for this owner-only test, add these **private, server-only** variables to the Vercel **tablego** project's Production environment, then deploy:

- `TABLEGO_CAMPAIGN_PROVIDER=resend`
- `RESEND_API_KEY` — Resend sending API key restricted to the verified campaign sending domain.
- `CAMPAIGN_EMAIL_FROM` — plain email address on that verified domain, e.g. `hello@updates.thaiphoonpa.com` after the owner confirms the domain. Do not use a Gmail address here.
- `RESEND_WEBHOOK_SECRET` — the `whsec_…` signing secret for the webhook below.

No `NEXT_PUBLIC_` prefixes. Never put secrets in chat, source, screenshots, or a committed `.env` file. Existing SMTP credentials and the stable admin/management secret must stay unchanged.

In Resend, verify a dedicated sending subdomain through the owner's DNS provider. Add only the records Resend specifies for that subdomain; do not replace the main domain's MX records or create a second SPF record at an existing hostname. Keep receiving disabled unless separately needed. Disable open/click tracking for the initial deliverability test; these can later be enabled with the disclosed privacy practices. Replies go to the restaurant's existing Gmail address.

Register the HTTPS webhook:

`https://tablego.vercel.app/api/campaigns/webhook`

Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`; optionally `email.opened` and `email.clicked` if domain tracking is enabled.

Signatures are verified over the exact raw body using Svix's documented HMAC scheme and a five-minute timestamp tolerance. Events are deduplicated by event ID and matched to the campaign, touchpoint, recipient, and provider message ID. Delivery, bounce, complaint, and optional unique-message engagement metrics are recorded without storing full webhook payloads, recipient IP addresses, user agents, or click URLs. Opens/clicks are estimates, can include automated scans, and are not booking conversions. Delivered means the receiving mail server accepted the email, not that it landed in the inbox. Hard bounces, spam complaints, and suppression stop future sends.

Provider choice is frozen when a campaign launches. A partially configured Resend integration blocks launch; it does not silently fall back to SMTP. Captured staging never sends through Resend, even if inherited credentials exist. Broader marketing should use the provider's appropriate marketing product and consent/audience controls; this owner-only test does not implement bulk sending via the transactional API.

## Scheduling and reliability

Vercel Hobby runs the existing worker once daily, now at **18:00–19:00 UTC**, which is **10 AM–noon in Palo Alto** across standard/daylight time. Immediate booking emails still send through their existing request path. No precise minute scheduling is advertised. The business timezone is stored at launch; dates use civil days, not the viewer's timezone. Delayed sends shift remaining dates to retain the configured intervals. The worker recovers a queued initial send if the request callback did not run.

A transaction grants one send lease. SMTP has no provider idempotency guarantee, so uncertain sends and expired leases require staff review rather than automatic retries. Resend also receives a deterministic idempotency key, but its 24-hour deduplication window is not treated as permanent. An in-flight email may still arrive after a pause, cancellation, or unsubscribe. Neither provider failure nor an uncertain result triggers a resend.

Unsubscribe links never mutate on GET. The public preference page requires an explicit button; provider one-click unsubscribe uses a token-protected POST. Opt-out suppresses the test recipient, pauses its active campaign, and invalidates any pending mailing-list confirmation so an old confirmation cannot undo it. The suppression record is retained. Staff cannot override it or enroll the address through the campaign UI.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm test`. Campaign tests cover fixed recipients, concurrent claims, lifecycle/version conflicts, business dates/DST, expired offers, cadence after delays, pause/unsubscribe suppression, interrupted-send review, escaping, provider-event deduplication, and signature/timestamp checks.

For an isolated end-to-end test, run the app in capture mode against `tablego-staging-1d712` on `127.0.0.1:3108`, then `node scripts/staging-campaign-smoke.mjs`. It refuses production configuration, captures the email, exercises the protected API and opt-out, cancels its own QA campaign, restores named staging recipient fixtures, and logs out only its own CLI session. Never invoke the global production notification worker just to test a campaign, because it can send unrelated queued service messages.
