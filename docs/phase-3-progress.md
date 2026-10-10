# Phase 3 — Guest management

Branch: `refinement/phase-3-guest-management`, based on Phase 2. No production deployment.

The shared secure guest page now includes the authoritative business timezone, labelled restaurant-local dates/times, a keyboard-accessible cancellation dialog with safe initial focus, explicit loading/retry/recovery states, selection reset when the date changes, a keep-current-booking action and a reload option for stale updates. Legacy URLs use this same authorized experience. Saving remains independent of message delivery; the page explains possible delivery delays. Recovery remains bound to the booking's verified phone.

Server reads and legacy timestamp conversion use business configuration rather than a fixed timezone. New records retain the configured timezone for audit. Notification content labels restaurant time. Caller-supplied timezone cannot override the business configuration. OTP input handling is bounded and provider errors are no longer dumped into logs.

Hosted staging capture is prepared for Vercel's ephemeral instances. Synthetic messages and single-use OTP challenges use private staging Firestore, protected by server-only rules. Filesystem capture remains available locally for fault simulation. No secrets were uploaded to Vercel and no hosted preview was deployed.

Validation: 46 unit/component tests pass, including real calendar-picker behavior in runtimes configured for Los Angeles, Tokyo, London, Honolulu and Kiritimati. These exercise international browser Date behavior without changing the user's browser timezone. Typecheck/lint and the optimized staging build pass (11 existing performance warnings). The complete security/booking/worker smoke suite passed; a separate persistent capture test passed transactional single-use OTP, independent guest/restaurant capture and authoritative timezone. New rules were deployed only to staging.

The mobile browser at 390 × 844 passed verified recovery, date/time rescheduling across the daylight saving boundary, pending acceptance copy, cancellation confirmation and Escape/focus restoration. The saved fixture displayed November 11 at 7 PM, exactly as selected. Local screenshot: `.staging/phase-3-mobile-guest.png`. Native keyboard date selection was used because browser automation's date fill changed the DOM value without committing React state.

The older staff date-formatting paths found during the audit are intentionally replaced in Phase 4. Hosted preview, real delivery, Storage uploads and production rollout remain release gates.
