# Promotions and mailing list — testing branch

Status: implemented on `refinement/promotions-mailing-list`. The owner supplied the Thaiphoon Lunch Perk flyer and confirmed the current deal. The Monthly offers button and automatic popup show both the Local Lunch Perk and Happy Hour. Release verification is in progress; production promotion is recorded below when complete.

## Customer experience and copy

The closable popup and compact homepage banner form use the existing cream, sage, and black restaurant theme. The popup has keyboard focus management, Escape dismissal, and a seven-day browser frequency preference. It avoids interrupting an open reservation/menu dialog or a focused input. The banner always provides another way to subscribe. The homepage now scrolls on small screens so the expanded banner never makes the booking controls inaccessible.

Offers-view heading: **Good things, on the menu.**

Local Lunch Perk: **10% off lunch**, through December 12, 2026. **Work nearby? Enjoy 10% off dine-in lunch at Thaiphoon. Show your local employee badge or business card to redeem.** Eligibility, lunch/dine-in/food/non-alcoholic conditions, all exclusions, and non-combination terms follow the supplied flyer. The original two-page PDF and optimized cover image are included under `public/promotions/`.

Happy Hour: **Every day, 4–6 PM.** This schedule was verified by a read-only check of the live restaurant banner on October 14, 2026. No unverified menu prices or discounts were invented.

Optional signup heading: **Something delicious, every month.** Supporting text: **Get our latest promotions and special offers by email. Signup is optional and isn’t required to redeem these deals.**

Consent, unchecked by default: **I’d like to receive promotional emails from Thaiphoon Restaurant. Unsubscribe anytime.** A linked privacy notice appears at collection. Button: **Sign me up**. The form explains that email confirmation comes first and signup does not affect a reservation. Signing up is not a condition of redeeming either offer. Both deals remain browseable without submitting an email.

Promotion start/end dates use the restaurant's local calendar date. The Local Lunch Perk remains available through December 12 and expires at Palo Alto midnight beginning December 13; the daily Happy Hour remains listed. Tests cover this boundary for viewers in five international timezones. There are no invented discounts, incentives, deadlines, or terms.

## Contact and consent handling

- The admin Mailing list tab and sidebar badge count unique valid email addresses from reservation records, catering records, and promotional signups. Case and whitespace are normalized; Gmail dots and plus aliases are not collapsed.
- Historical service contacts have **No marketing consent**. They are visible to staff but cannot be exported as subscribers or manually opted in. Service-message/SMS consent is not treated as marketing consent.
- Explicit form consent creates a pending record and a durable confirmation-email job. Confirmation links expire after 48 hours. No address becomes subscribed just because someone submits the form.
- The recorded proof includes consent text/version, notice version, source, request timestamp, email confirmation timestamp, and append-only server-owned preference history. The signup forms collect no phone, payment data, date of birth, or name.
- A single unsubscribe button on the email preference page takes effect immediately, without login. Its opaque token does not expire and remains valid after fresh signup attempts. Confirmation cannot undo a later unsubscribe; re-subscription requires fresh consent and a fresh confirmed link. Opening a link does not mutate anything, preventing mail scanners from changing preferences.
- Staff can unsubscribe with conflict protection. They cannot subscribe someone. Current counts, filters, search, pagination, and dates in the restaurant timezone support review.
- Subscriber CSV exports include only confirmed opt-ins and an individual unsubscribe URL. Current consent is rechecked in bounded batches, so revocations since the initial list read are excluded. CSV cells guard against spreadsheet formula execution. Exports are private, no-store responses.

## Security and retention

`mailingContacts` and `mailingAccess` are excluded from the Firestore client catch-all, including authenticated staff client writes. Staff access is through authenticated, origin-checked server APIs. Anonymous requests cannot list or export contacts. Email-based document IDs use a purpose-scoped HMAC. Only hashes/encrypted link material are stored for confirmation/unsubscribe proofs, and fragment links keep tokens out of server URLs. Preference pages disable indexing/referrers and are excluded from site analytics. Analytics also honor Do Not Track and Global Privacy Control and strip URL fragments.

Public signup has server-side validation, an unchecked consent requirement, current consent-version checks, a honeypot, shared transactional IP/email limits, bounded input, and uniform responses that do not reveal whether an address is subscribed. Provider errors do not expose guest details. The existing durable notification pipeline handles immediate confirmation delivery and retries; it checks current proof/version/expiry before sending. No promotional campaign sends are added by this change.

The daily notification worker removes expired, unconfirmed new signup records, their access proof, and their consent-event history after 30 days. Suppression and confirmed-consent records are retained for their stated purposes. Request-limit records already have expiry metadata. The site provides a restaurant email/phone channel for access, correction, deletion, and preference requests. Service records have separate purposes and are not deleted on marketing opt-out. Do not casually rotate `ADMIN_SESSION_SECRET`: it is already shared by compatible deployments and protects existing reservation links as well as mailing IDs and encrypted proofs.

## Business responsibilities before a campaign

This is a consent and list-management feature, not a campaign composer or a monthly auto-send scheduler. A CSV is a point-in-time export. Before each campaign, refresh it, synchronize suppression with the email provider, and embed each recipient's unsubscribe URL (or use the provider's correctly synchronized global unsubscribe). Old downloaded exports do not update themselves. Do not add reservation/catering contacts to campaigns without separate consent. Keep exports private and discard them when no longer needed.

Use truthful sender/subject details, clear promotional content, the restaurant's valid postal address, and a working opt-out in each marketing email. Current configured business contact: **Thaiphoon Restaurant, 543 Emerson St, Palo Alto, CA 94301; thaiphoonpaloalto@gmail.com**. The owner must ensure these are current and that the published privacy notice matches actual business/provider practices. Monitor the contact mailbox for opt-outs and privacy requests. Where an ESP sends bulk mail, configure its authentication and unsubscribe headers and maintain its suppression list as well.

The user identified a primarily US audience. The implementation follows an explicit opt-in policy even though CAN-SPAM itself generally does not require prior affirmative consent. FTC guidance requires accurate identity, a postal address, a functional opt-out for at least 30 days after a marketing send, and honoring opt-outs within 10 business days; this application applies authenticated-link opt-outs immediately. California's CalOPPA requires a conspicuous, accurate privacy policy. CCPA applicability depends on business thresholds and practices; this work does not certify the business's overall legal compliance or assert that it is subject to CCPA. Intentionally expanding to Canada/EU/UK requires a fresh jurisdiction review.

Primary references reviewed October 14, 2026:

- [FTC CAN-SPAM business guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [California AG: Making Your Privacy Practices Public](https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf)
- [California AG CCPA overview and applicability](https://oag.ca.gov/privacy/ccpa)

## Validation and remaining release work

Staging browser tests cover popup and banner signup, captured confirmation email, confirmation page, guest unsubscribe, staff unsubscribe, old-link rejection, and the admin count/status/search view. The popup/banner fit a 390 × 844 viewport without horizontal overflow; Escape dismisses the popup and returns focus to its opener. Original desktop sizing is restored after responsive checks.

Validation: 177 automated tests pass, TypeScript passes, ESLint reports zero warnings, and a local optimized build succeeds using the CI placeholder configuration. The staging smoke was repeated after the export batching change and passed. The initial mailing-list commit passed GitHub Quality; the completed offer commit is checked again before release. No credentials or notification captures are committed.

`scripts/staging-mailing-smoke.mjs` refuses any non-local URL or Firebase project other than `tablego-staging-1d712`. It verifies explicit consent, origin checks, honeypot handling, durable captured mail, subscriber-only export, immediate unsubscribe, and stale confirmation rejection. It creates its own synthetic `@example.invalid` record, leaves it unsubscribed as evidence, and revokes its own temporary staff session.

The new strict rules were published only to the isolated staging project. Both anonymous and active staff Firebase client identities were tested: internal mailing reads/writes are denied, while the active staff identity retains reservation read access. No live database records or live rules were changed. No real messages were sent by this feature's tests.

Before production: finish checks on the exact commit; publish the reviewed mailing exclusions to live rules; build a protected production candidate with the existing real providers/database and stable secret; verify it; then promote to `tablego.vercel.app`. Rollback must account for pending mailing jobs: older workers do not understand `mailing-confirmation`. Reservation/catering records and their existing notification jobs retain their existing schemas.
