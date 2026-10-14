# Notification delivery and scheduling

Booking changes and recipient-specific notification jobs commit atomically. Next.js `after()` attempts delivery after the booking response. The persistent worker recovers queued jobs, failed attempts and expired leases. A booking does not fail because its email or SMS failed.

`GET /api/notifications/process` requires `Authorization: Bearer <CRON_SECRET>`. Set an independent random secret of at least 32 characters in each environment. Vercel adds this header to cron requests when the project has `CRON_SECRET`. Never expose it as a NEXT_PUBLIC variable. POST accepts either the worker secret or an authenticated staff session with origin protection. Each invocation processes at most five due jobs concurrently; invoke again to drain a backlog.

Jobs receive a two-minute transaction lease. Retries back off from two minutes to one hour and stop after five attempts. Staff can inspect delivery state and deliberately retry an exhausted message. Retrying records previous attempts and an audit event. A newer reservation update supersedes older unsent messages. Delivery uses the current management token and checks current SMS consent and server verification.

SMTP has no provider-level idempotency guarantee. A deterministic Message-ID helps trace a message but cannot prevent a duplicate if the provider accepted it and the database acknowledgement failed. Leases prevent normal concurrent workers from sending the same job. They do not create exactly-once delivery across external systems.

## Vercel Hobby

The user confirmed the existing project uses Hobby. `vercel.json` prepares one daily safety-net invocation at 18:00 UTC. Campaigns share this worker, giving Palo Alto a late-morning delivery window (10 AM–noon across daylight saving time). Immediate service notifications still use the existing request-triggered delivery path. Hobby permits only one invocation per day, with an imprecise start time. Cron runs on production deployments, not ordinary previews. See [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

**Daily recovery is insufficient for time-sensitive failed booking messages or a large backlog.** Immediate delivery and staff retry work independently, but unattended recovery every few minutes requires an authenticated external scheduler or a plan that supports frequent cron. Before production rollout, configure and verify that scheduler, alert on failures/backlog, and check capacity against expected message volume. No plan upgrade, external scheduler account or production deployment has been performed.

Preview environments must use the staging Firebase project and independent secrets. Hosted staging automatically uses private Firestore captures and transactionally consumed OTP challenges on Vercel. Local runs use filesystem captures for outage simulation, or opt into the persistent backend with TABLEGO_NOTIFICATION_CAPTURE_STORAGE=firestore. Both backends have been smoke tested; a deployed preview must still pass its own guest journey.
