# Phase 2 — Booking reliability

Branch: `refinement/phase-2-booking-reliability`, based on Phase 1. No production deployment.

The shared hours engine is now read inside booking/rescheduling transactions, so a simultaneous configuration change forces revalidation. Repeated submissions return the original booking even if hours have since changed. Access rotation is respected on a repeated receipt.

Notification work runs after the response, with persistent intents and a secret-authenticated worker. Transactional leases, bounded attempts, backoff, exhaustion, current consent checks, token refresh and superseded updates protect retries. Staff delivery status and deliberate retry are available from reservation actions. Deterministic email Message-IDs support tracing; exactly-once delivery is not promised.

Calendar helpers reject invalid/missing dates. Date-only bookings retain their calendar day; timestamp displays use restaurant timezone. The calendar picker compares full dates including the year, uses restaurant Today and clears old time selections. Its selected day is never converted as an instant. Duplicate context date functions were consolidated.

Validation: 41 unit/component cases pass with no TODOs; typecheck and lint pass (11 existing performance warnings). Optimized staging build passes. Staging smoke tests passed worker authentication, concurrent lease delivery, provider outage/recovery, obsolete notification suppression, bounded exhaustion and audited manual retry, alongside the Phase 1 security/booking checks. The optimized staging server also showed delivery history in the staff browser; screenshot `.staging/phase-2-delivery.png` is retained locally. The notification composite index was deployed only to staging.

Vercel Hobby was confirmed by the user. A daily cron configuration is prepared; frequent unattended retries require an external scheduler or a plan supporting frequent cron. See `notification-worker.md`. No billing upgrade or deployment was performed. Hosted preview and real provider delivery remain release gates. International browser checks and the remaining staff date-formatting audit continue in Phases 3–4.
