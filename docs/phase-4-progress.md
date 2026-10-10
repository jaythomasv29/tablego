# Phase 4 — Staff service workflow

Branch: `refinement/phase-4-staff-workflow`, based on Phase 3. No production deployment.

Today and Reservations now share a small service console, replacing roughly 2,900 lines of duplicate page code. It prioritizes accepted covers, pending requests, arrivals, seated/completed visits, cancellations, requests, large parties and overdue arrivals. Remaining table capacity is not invented. Search, status/date filters, requests and party filters, call links, live state actions, message delivery, deliberate reminders and private notes are available on each booking.

All service clocks, date filters, creation timestamps and event timestamps use the configured business timezone. Calendar strings stay calendar strings; legacy timestamps convert once using the business timezone. Ambiguous timestamps without an offset require review instead of being interpreted in a viewer's timezone. Invalid imported details retain terminal cancellation/no-show/completion history and receive a review flag.

No-show requires an accepted booking and a passed restaurant-local arrival time, plus a deliberate staff confirmation. Guest requests that were never accepted cannot be penalized as no-shows. State changes and notes have append-only audit events. Staff notes have independent conflict versions, never appear in guest API responses, and cannot be changed directly by Firebase clients.

Guests summarizes exact normalized name/email/phone combinations. Shared contacts are flagged without merging different people. Completed visits count only completed service, not requests or legacy attendance marks. Source-booking totals reconcile with profile totals. Guest history, notes and an authorized timeline are extracted components. Navigation is grouped into Today, Guests & Reservations, Restaurant Operations, Guest Engagement and Settings. Website/menu/catering metrics remain available in Insights rather than occupying the service view.

Validation: 52 unit/component cases pass, including international runtime checks for the picker, service dates, Today covers and timestamps. Typecheck, lint and the optimized staging build pass (11 existing performance warnings). The staging smoke suite passed note authorization, privacy, concurrent-note conflicts, direct-write denials and future no-show rejection, alongside booking/security/retry checks.

Browser usability: confirmed a synthetic request, seated/completed it, saved a private note and recorded a past-arrival no-show. Live counts, history and audit timeline updated correctly. The directory showed 17 source bookings and 2 completed visits; the shared-contact group remained separate. Mobile Today passed at 390 × 844; `.staging/phase-4-mobile-today.png` is retained locally. Fixtures are synthetic and preserved for review; no live guest data was read or changed.

Production release still requires the coordinated security rollout, hosted preview, real provider tests and a frequent retry scheduler. UI/theme/configuration cleanup continues in Phase 5.
