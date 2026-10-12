# TableGo release readiness

Updated October 10–11, 2026. Implementation is on sequential local test branches; `main` is unchanged. Controlled local staging OTP and SMTP tests are documented in [automatic confirmation and provider testing](auto-confirm-provider-testing.md). No production deployment, production record migration, live rule change, Vercel credential upload or billing upgrade has occurred.

The final October 11 audit compares against the verified active Vercel production commit 2905408, restores newer deployed follow-up/feedback features securely, and records concrete hosting gaps. See [deployment comparison and audit](pre-deployment-audit.md).

## Delivery coverage

| Requested improvement | Implementation |
| --- | --- |
| 1. Consistent lifecycle | Phase 1 domain/legacy adapter; automatic confirmation by default (manual opt-out), pending, confirmed, seated, completed, cancellation/no-show rules; shared UI and notification copy. Guest acknowledgement is separate from staff acceptance. |
| 2. One availability engine | Phase 2 pure policy, creation/rescheduling revalidation; shared public/menu policy subscriptions. The separate chatbot is excluded from this rollout by user decision and remains disabled. |
| 3. Reliable booking | Transactional record, idempotency and per-recipient outbox; provider failure does not undo a saved booking. |
| 4. Guest management | Phase 3 unified token-authorized flow behind all three legacy URLs, verified phone recovery, deliberate cancellation and rescheduling that honors the confirmation setting. |
| 5–7. Today, console, navigation | Phase 4 live service console, meaningful covers/status counts, filters/actions, delivery state and grouped navigation. No invented capacity. |
| 8–9. History/no-show | Conservative identity groups with shared-contact flags; completed visits, last visit/average party, private notes/preferences; prior no-shows and arrival-based deliberate no-show action. Deposits are a later policy decision. |
| 10. Communications | Shared renderers/events, consent/proof checks, durable worker, bounded retries, stale-event suppression and staff failure/retry view. |
| 11. Configuration | Validated public identity/contact/policy/promotions/links; secrets remain server-side. Live configuration updates. |
| 12. Domain extraction | Service components replace duplicate dashboards; inventory/team models/hooks, public policy, menu images and shared controls. No arbitrary file-size target. |
| 13. Infrastructure cleanup | One src middleware/Tailwind config; traced unused dependencies/components removed; Express entrypoint explicitly retired. |
| 14–15. Quality/testing | Enforced TypeScript/lint/build; 92 automated cases, staging API/rule/capture and browser usability checks; CI configuration. |
| 16–17. Access/semantics | Signed/revocable staff sessions, handler authorization/origin checks, server phone proofs, hashed scoped management tokens; missing/bad policy returns unable-to-verify. |
| 18. Observability | Append-only booking/action/notification events, per-recipient attempts/history, private staff timeline and deliberate retry. |
| 19. Performance | SMTP verification outside booking; post-response best effort delivery plus durable jobs; private/public cache split, local fonts, on-demand highlights and responsive images. |
| 20. Visual consistency | Shared status/action controls, accessible guest/closure dialogs, mobile service views, explicit empty/error/loading states and visible keyboard focus. Existing visual identity retained. |

## Local validation

- Clean lockfile installation; typecheck; lint with zero warnings; 72 unit/component tests with no skipped/TODO cases; optimized staging production build.
- International tests run real date/service helpers and the calendar component under five runtime timezones. They cover date-line and daylight-saving boundaries and reject ambiguous timestamp strings. Browser timezone was not emulated; browser checks use the configured business timezone.
- Staging API/database smoke covers forged/revoked credentials, direct-write denials, server phone proof, idempotent concurrent creation, lifecycle conflicts, token rotation, cancellation/rescheduling, private notes/preferences, provider outage/partial failure/recovery/concurrent leases/exhaustion/manual retry and missing-policy fail-closed behavior.
- Configuration smoke covers authenticated writes, unknown fields, invalid zones/links/hours/dates, save conflicts, rule bypass denials, closure freshness and idempotent catering with escaped captured messages.
- HTTP smoke covers staff redirects, forged cookie and middleware header, public asset caching and private management/API cache/referrer policies.
- Persistent staging capture smoke covers hosted-compatible Firestore email/SMS/OTP capture and single-use phone proof. It does not verify a deployed Vercel environment.
- Browser checks include a complete synthetic public OTP booking and pending receipt, unified guest rescheduling/cancellation safety, staff confirm/seat/complete/no-show/private notes and mobile Today. Phase 5 mobile (390 × 844) public OTP booking, frozen receipt through live timezone save/restore, staff settings save/restore, native calendar closure create/keep/delete, safe initial focus and Escape restoration passed. The public empty menu, on-demand menu dialog/focus restoration, live menu freshness and missing-image fallback were also checked. Disposable closure/menu fixtures were removed; synthetic reservations and captures remain for review.
- Local logs/captures/screenshots are ignored under `.staging/`. Synthetic records are retained for review. CI has not been executed remotely; no tests establish a guarantee against all crashes.

### Measured performance

Phase 4 optimized home bundle: route 64.8 kB, first load 337 kB. Phase 5 optimized home bundle: route 32.8 kB, first load 324 kB (13 kB lower first load). Menu first load is 277 kB versus 270 kB in Phase 4; catering is 271 kB versus 267 kB. These are Next build output sizes, not measured network timings or Lighthouse scores. Menu accessibility/live policy changes have a bundle cost; menu highlights are loaded on demand to control it.

### Dependency audit

`npm audit --omit=dev` reports zero findings. Full audit reports 16 development-tool findings (2 moderate, 14 high) in the ESLint/TypeScript plugin/Tailwind toolchain. Review and migrate that tooling separately before claiming an entirely clean audit. Security release references: [Next September release](https://nextjs.org/blog/september-2026-security-release), [gRPC advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j), [Nodemailer 10.1.0](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.0), [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).

## Production release gates

1. Configure and test a Vercel preview with **only** the isolated staging project and capture mode. Verify HTTPS cookie/origin behavior, custom staff-token authentication, env scope and capture persistence on the actual host. Local staging is not a hosted preview.
2. Provision staging Firebase Storage if asset upload workflows must be verified. Upload paths were not tested against a bucket; existing read/fallback image behavior was tested separately. No billing upgrade has been approved or performed.
3. Review production server credentials, Authentication setup, environment, policy and legacy records. Check public `settings/general` for historical secrets before release; new APIs cannot save secret fields there. Do not export real guest records into staging. Business timezone must be an IANA name, not a fixed PST offset.
4. Coordinate application and Firestore rules/index deployment. The live rules audited at baseline allow unauthenticated staff/booking access; switching rules without the migrated app breaks old public/staff writes. Existing ID-only links must use verified recovery. Secure current production promptly through the reviewed rollout.
5. Local staging real Twilio verification and SMTP provider acceptance passed with the approved recipient. The recipient confirmed receiving the email. Verify the hosted production SMTP/Twilio configuration, including authenticated sender, SMS consent, provider errors and retries. Captures and SMTP serialization cannot establish deliverability.
6. Activate and test a frequent notification retry scheduler. The checked-in daily 09:00 UTC Vercel cron is compatible with Hobby but does not provide timely retry service by itself. Supply an authenticated external scheduler or decide on Pro before depending on prompt retries. Immediate post-response attempts are best effort; durable jobs and the scheduled worker are the recovery mechanism.
7. Keep the chatbot embed disabled in preview and production for this TableGo-only rollout. Chatbot integration work is excluded and is not a prerequisite for releasing TableGo with the embed disabled.
8. Review the local branch chain and run remote CI, preview guest/staff tests and upload tests before merge/release. Accept the remaining development-tool audit findings or remediate them in a controlled upgrade. Production deployment requires an explicitly accepted release.

## Excluded chatbot scope

On October 11, 2026, the user explicitly limited this rollout to TableGo and directed that the chatbot remain disabled. No changes or testing branch are planned in the separate `ai-chat-widget` repository for this rollout. Source inspection found no chatbot script/embed references in TableGo's active `src`, `public` or Next configuration.

For a future separately authorized integration: the widget currently calculates its own slots, writes its own booking and reports success before TableGo accepts it, and lacks TableGo's server phone proof. It must consume authoritative slots and use a verified secure handoff/integration before being enabled. Do not restore the old fire-and-forget webhook or trust a client verification boolean.

## Environment manifest (names only)

Staging: `TABLEGO_ENVIRONMENT=staging`, `NEXT_PUBLIC_TABLEGO_ENVIRONMENT=staging`, `TABLEGO_NOTIFICATION_MODE=capture`, staging `NEXT_PUBLIC_FIREBASE_*`, staging `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel (local `GOOGLE_APPLICATION_CREDENTIALS`), independent `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL` matching the preview origin, `NEXT_PUBLIC_OTP_ENABLED=true`. Vercel uses persistent private Firestore captures automatically; local persistent testing uses `TABLEGO_NOTIFICATION_CAPTURE_STORAGE=firestore`. Never supply live provider or database secrets to a preview.

Production: project-matched server credentials and Firebase SDK config; server session/cron secrets; actual base URL; reviewed `SMTP_HOST`, `SMTP_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_FROM_NUMBER` provider settings. Use the module names as the authoritative env list. Never rotate the session/encryption secret casually: queued secure-link material and sessions depend on it.

## Release and rollback

Record the accepted Git SHA, environment changes, rules/index versions and scheduler before deployment. Prefer additive schemas and compatibility reads; no destructive record migration is part of these phases. Snapshot reviewed configuration/rules securely and establish monitoring for booking/API errors, duplicate keys/records, failed/exhausted notification jobs and unauthorized actions.

Roll back application and compatible rules together. Do not reopen the old unauthenticated rules simply to make an old client work. Preserve outbox/management/session data and the required encryption secret; application rollback does not undo sent messages, recover deleted records or cancel scheduled jobs. If faults appear, stop new rollout, keep secure guest cancellation/recovery available and inspect the event/outbox timeline before changing data. Database backups and a production rollback rehearsal are release preparation, not completed local tests.

## Branch chain

- `refinement/phase-0-quality-baseline` — `5658d20`
- `refinement/phase-1-reservation-foundations` — `ceb90d7`
- `refinement/phase-2-booking-reliability` — `4f217cd`
- `refinement/phase-3-guest-management` — `6cb757b`
- `refinement/phase-4-staff-workflow` — `fa887f1`
- `refinement/phase-5-cleanup` — final integration branch containing all earlier phases.

- `refinement/auto-confirm-provider-testing` — automatic confirmation, customer response visibility, optional reminder consent and restricted local real-provider checks; based on Phase 5.
