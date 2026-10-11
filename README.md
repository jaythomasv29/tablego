# TableGo

Next.js restaurant reservations and staff service tools for Thaiphoon. Refinements are implemented on separate `refinement/phase-*` branches; production has not been deployed. This rollout is limited to TableGo; the separate chatbot is excluded and its embed remains disabled.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Use Node 22.14 or newer (CI uses Node 22.22.2). Builds enforce type and lint checks; standalone lint permits zero warnings. Run `npm run dev:staging` or `build:staging` / `start:staging` with the private staging environment. The launcher binds to http://127.0.0.1:3100, requires the isolated Firebase project, and captures all messages.

Bookings follow `pending → confirmed → seated → completed`. Cancellation and no-show have restricted transitions. Guest acknowledgement does not accept a request; rescheduling returns to pending. Only completed service counts as a completed guest visit. Legacy records are adapted during reads, preserving terminal history and flagging invalid details.

Dates and times always use the **business IANA timezone**, including international viewers and daylight saving changes. Store booking dates as validated `YYYY-MM-DD` calendar strings and times separately. Do not parse calendar strings as timestamps or convert user-selected calendar dates between timezones. Event timestamps are real instants with an offset, displayed in the business zone. Use `src/utils/dateUtils.ts` and `src/lib/reservations/availability.ts`; never use the viewer's local timezone for staff dates.

The pure availability engine controls slots, hours, closures, lead time and cutoff. Server writes revalidate it transactionally. Availability means hours eligibility; table capacity and overnight service are not implemented. Missing/invalid policy fails closed with a retry/call message.

Booking writes atomically save a request, secure management authorization, timeline event and notification jobs. Stable submission keys prevent duplicates on retries. Durable workers retry independent recipients; a provider failure does not undo the booking. SMTP does not guarantee exactly-once delivery if a send succeeds before its completion record is stored.

Staff use signed, expiring, revocable server sessions and scoped Firebase tokens. Lifecycle changes, settings, hours, closures and private notes use authenticated server APIs. Guest management uses high-entropy reservation tokens in URL fragments; ID-only legacy links require phone verification to recover access. Private notes and preferences never appear in guest responses. Internal database rules and code must roll out together.

Public identity, contacts, links and promotions live in `settings/general.restaurant`, with validated defaults. Booking policies remain in that document; hours and closures retain their existing documents. Credentials and provider recipients belong only in server environment variables. Live subscriptions refresh guest and staff screens when configuration changes. This prepares configuration reuse; it does not implement tenant isolation.

See [delivery plan](docs/tablego-refinement-plan.md), [isolated staging](docs/staging-setup.md) and [release review](docs/release-readiness.md) for progress, validation, environment requirements and coordinated rollback. Hosted preview, real provider delivery, Storage uploads and frequent worker scheduling require separate release verification. Vercel Hobby's daily cron is a recovery sweep, not a sufficient time-sensitive retry scheduler.
