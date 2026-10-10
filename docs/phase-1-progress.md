# Phase 1 — secure reservation foundations

Branch: `refinement/phase-1-reservation-foundations`, based on Phase 0 commit `5658d20`.

## Implemented

- Signed, expiring, HttpOnly staff sessions backed by server-owned revocation records. Custom Firebase staff tokens are tied to session expiry and active status. Handler authorization protects staff APIs; origin checks protect mutations; transactional request limits cover staff login, bookings and OTP/recovery.
- Server-only Admin SDK boundary, staging project/credential checks, and isolated staging launcher with forced message capture and protection against dotenv fallback.
- Typed lifecycle and compatibility adapter: pending → confirmed → seated → completed; cancellation/no-show exits; unknown imported states require review. Cancelled history wins over contradictory attendance. Guest acknowledgement is separate from staff acceptance. Rescheduling returns to pending acceptance.
- Allowlisted booking fields, normalized US phones, valid calendar dates/times and party limits. Phone verification comes from a signed, phone-bound server proof, never the submitted boolean.
- Secure per-reservation management tokens (256 random bits), hashed authorization records, authenticated encryption for server delivery/retry material, expiry and recovery rotation. Tokens are in URL fragments and authorization headers, avoiding request URLs/referrers. Old ID-only URLs require phone verification; signed-in staff can issue a secure reminder to the stored guest contact.
- Public reservation pages/actions moved off direct browser database writes into one management component/server contract. Existing route names remain available. Staff confirm/seat/complete/cancel/no-show actions use the same transition contract. Client database rules prohibit state changes and event edits.
- Pure hours eligibility policy pulled forward from Phase 2 because writes must validate availability. Calendar dates, restaurant clock, closing cutoff, minimum lead time, slot alignment, custom ranges and multiple closures use one engine. Capacity is **hours eligibility only**, not table inventory. Overnight ranges fail closed until a policy is explicitly supported.
- Retry-safe creation with stable submission keys and payload conflict detection. Booking, event history, link authorization and independent guest/restaurant notification intents are committed together. Provider failures do not roll back creation, rescheduling or cancellation. Delivery is best effort immediately, with queued/failed jobs retained for the Phase 2 worker.
- Central reservation email/SMS copy uses current lifecycle wording and HTML escaping. SMS uses stored consent and server-verified recipient data. Test records and test deletion are staging-only. Analytics errors return an error rather than fabricated values.

## Validation

- Unit/component suite: 37 passing cases and 3 previously documented date-helper TODOs.
- Staging integration: passed concurrent duplicate submission, invalid field/verification claims, forged cookies, cross-origin mutation, private-document denials, bypass attempts, guest acknowledgement, invalid transitions, wrong-reservation tokens, unavailable and valid rescheduling, verified recovery/rotation, repeated cancellation, simulated notification failure, fail-closed configuration and immediate session revocation.
- Local browser: ID-only recovery and verification restored the synthetic reservation; guest acknowledgement remains pending restaurant acceptance.
- Typecheck and lint passed; 11 existing performance warnings remain within the Phase 0 lint budget.
- Optimized staging production build: passed with type/lint gates enabled. The production server rendered the verified guest flow; dark-mode contrast was repaired and visually checked. Preview image: `.staging/phase-1-guest.png` (local, ignored).

## Release limits

This phase is not deployed to production. Production rules were audited read-only and currently permit unauthenticated reservation/staff-data access; the old app depends on browser writes. Release needs coordinated code, server credentials, Auth and rules changes. No real guest data was copied or migrated. Legacy records are adapted during reads, preserving history.

Phase 2 must supply an active durable worker/retry path, deeper fault/concurrency coverage and delivery visibility. Exactly-once provider delivery is not guaranteed: a send succeeding before its completion record is persisted can be retried. SMTP/Twilio delivery, hosted preview, Storage uploads, mobile staff workflow and production rollout remain separate gates.
