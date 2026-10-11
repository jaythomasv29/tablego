# Automatic confirmation and controlled provider testing

October 11, 2026. Branch: `refinement/auto-confirm-provider-testing`. TableGo only; chatbot stays disabled. No production deployment or production data/rules changes.

## Staff and customer behavior

Admin **Settings → Reservation confirmation → Automatically confirm new reservations** is on by default, including when older configuration has no field. Eligible customer submissions commit directly as `confirmed`. Turning it off makes future submissions `pending` until staff accepts. Existing records retain their status. Valid reschedules honor the current setting and clear the previous customer acknowledgement; an unavailable change preserves the old booking. An idempotent retry returns the saved booking's current details and status.

Receipts, emails and guest management match the server's status. Auto-confirmed submissions create one notification per recipient, without an extra duplicate confirmation email. A notification failure does not reverse confirmation. Calendar dates remain literal restaurant dates; arrival times and timestamp displays use the configured IANA business timezone.

Staff can send **Email reminder** or **SMS reminder** from an active booking. These are manual messages with date, time, current status and the secure management link. SMS reminders require server-verified phone ownership and explicit optional reminder consent. Phone verification works independently of reminder consent. The notification worker retries already queued messages; it does not schedule automatic pre-arrival reminders.

The guest uses the link to select **I’m coming**, reschedule, or cancel. “I’m coming” records an acknowledgement, leaves the booking status unchanged, and appears as **Customer response: Coming** in the staff console and in the event timeline. Guests who have not responded remain confirmed when automatic confirmation is on. Incoming email/SMS replies are not parsed or tracked. A booking's delivery panel distinguishes **Captured in staging** from **Accepted by provider**; provider acceptance does not establish inbox arrival or guest acknowledgement.

## Local test modes

- `npm run dev:staging`: http://127.0.0.1:3100; isolated staging Firebase; email, SMS and OTP captured.
- `npm run dev:provider-test`: http://127.0.0.1:3101; same staging Firebase, separate build directory; explicit server-only `.env.provider-test.local` required.
- `node scripts/staging.mjs build --qa` then `node scripts/staging.mjs start --qa`: separate optimized build on port 3102. Regression scripts accept `TABLEGO_STAGING_TEST_BASE_URL=http://127.0.0.1:3102`.

The ignored private provider-test file contains SMTP and Twilio Verify credentials, `TABLEGO_PROVIDER_TEST_EMAIL`, `TABLEGO_PROVIDER_TEST_PHONE` (US E.164), and a UUID `TABLEGO_PROVIDER_TEST_RUN_ID`. It contains no production Firebase credentials. Only the approved phone uses live Verify. Only current-run, confirmed guest creation/confirmation emails to the exact approved address use SMTP. Staff copies, reminders, reschedules, cancellations, catering and other recipients are captured. SMS reminder transport remains captured. Ordinary staging strips inherited opt-in settings and forces capture.

Keep this opt-in profile local. The email management link uses the local port 3101 and works on the computer running that server. Do not upload these credentials to a hosted preview. Live SMS reminders require a reviewed sender number; no live SMS reminder test was performed.

## Verified evidence

- Real Twilio Verify service access and SMTP authentication passed. The approved phone received a real four-digit OTP, the user supplied the PIN, and `/api/otp/verify` returned a valid signed phone proof after provider verification.
- A synthetic reservation created through `/api/send-confirmation` with that proof committed as `confirmed`, with server phone verification and optional SMS consent off.
- Its guest email job was accepted by real SMTP on attempt 1, with a recorded message ID and no rejection; its restaurant copy was captured on attempt 1. The recipient confirmed receiving the email. The initial simplified template was then replaced with the earlier restaurant palette, editorial type, dark hero, beige detail panel, menu/catering sections and rounded actions, based on their feedback. Updated styling was reviewed in a local browser preview; the already-delivered email cannot change.
- Browser guest management showed the literal restaurant date, local time and confirmed status. “I’m coming” saved successfully and appeared as **Coming — acknowledged through the secure link** in the staff console. The SMS reminder button correctly stayed disabled without reminder consent.
- 72 automated tests cover confirmation copy, configuration defaults/type validation, provider restrictions, dynamic OTP length, optional consent, policy recovery after repair, acknowledgement and existing timezone/identity/security regressions. Typecheck, lint and the updated optimized staging build passed.
- Automatic-confirmation API smoke covers concurrent creation, per-recipient job count, append-only automatic-confirmation event, manual opt-out, old-form compatibility, no retroactive status changes, current retry receipts, both reschedule modes, acknowledgement separation and malformed-policy fail-closed behavior. Existing security/outage/worker, settings/catering and private HTTP smoke checks also passed.

Evidence and the secure test link are private under `.staging/`; no PIN or credentials belong in committed files. Synthetic test records remain in staging for review. Hosted preview, hosted provider/cookie behavior, Storage uploads, prompt retry scheduling and production release gates remain in [release readiness](release-readiness.md).

The email and secure guest page preserve the homepage’s cream, sage, beige and charcoal theme. Email layout uses inline styles and presentation tables for client compatibility. Promotions and contact/menu/catering links come from validated restaurant configuration; all guest text remains escaped, and the management link remains token-protected.

The current theme review used the desktop browser. The updated email was previewed locally rather than sent a second time; rendering of that revised template in individual email clients remains a separate check.
