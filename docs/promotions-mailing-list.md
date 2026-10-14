# Promotions and mailing list — testing branch

Status: implemented on `refinement/promotions-mailing-list`. The owner supplied the Thaiphoon Lunch Perk flyer and confirmed the current deal. The Monthly offers button and automatic popup show both the Local Lunch Perk and Happy Hour. Published to **https://tablego.vercel.app** on October 14, 2026, after the testing branch, isolated staging checks, and production-candidate verification.

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

Validation: 177 automated tests pass, TypeScript passes, ESLint reports zero warnings, and a local optimized build succeeds using the CI placeholder configuration. The staging smoke was repeated after the export batching change and passed. The completed offer commit passed GitHub Quality on both the testing branch and main. No credentials or notification captures are committed.

`scripts/staging-mailing-smoke.mjs` refuses any non-local URL or Firebase project other than `tablego-staging-1d712`. It verifies explicit consent, origin checks, honeypot handling, durable captured mail, subscriber-only export, immediate unsubscribe, and stale confirmation rejection. It creates its own synthetic `@example.invalid` record, leaves it unsubscribed as evidence, and revokes its own temporary staff session.

The new strict rules were first published to the isolated staging project, tested there, and then published to the live project after backing up and comparing the exact live baseline. Both anonymous and active staff Firebase client identities were tested: internal mailing reads/writes are denied, while the active staff identity retains reservation read access. Live verification created and revoked its own temporary staff authentication session, read protected contact totals, and verified public denials. No live reservations, catering inquiries, or marketing enrollments were created or changed. No real messages were sent by this feature's tests.

The release sequence completed: exact-commit checks, reviewed live mailing exclusions, a production candidate using unchanged real provider/database credentials and the stable secret, candidate checks, main fast-forward, and promotion to `tablego.vercel.app`. Rollback must account for pending mailing jobs: older workers do not understand `mailing-confirmation`. Reservation/catering records and their existing notification jobs retain their existing schemas.


## Published release record

- Source: `c9e42d85960a5c36fabee5f890a4fb5cc2954011` on main and `refinement/promotions-mailing-list`. The original TableGo worktree and branch were preserved.
- Ready production deployment: `dpl_99kNkdYuWxZPjrjDRbrUpUGHVx9t`, `https://tablego-id23msihr-jaythomasv29s-projects.vercel.app`; promoted to `https://tablego.vercel.app`.
- Previous deployment: `dpl_AG13gwwed5cF8FSUarc13NKq35N5` (Today timeline release); account for mailing jobs before rollback.
- Live ruleset: `projects/tablego-1d712/rulesets/59492daf-8a33-4cf2-bfec-811bca2e42c4`. The pre-change ruleset/content are backed up privately. The only rule change denies direct client access to the new mailing internals.
- Production environment metadata was compared with the last verified environment: all 31 production entries were unchanged. Canonical URL, real Firebase project, Node options, provider credentials, and shared secret were preserved.
- [Testing-branch Quality](https://github.com/jaythomasv29/tablego/actions/runs/38647587075) and [main Quality](https://github.com/jaythomasv29/tablego/actions/runs/38648252708) succeeded; 177 automated tests, type checking, lint, and optimized builds passed.
- Candidate and canonical availability returned HTTP 200 with America/Los_Angeles and 14 valid slots for October 15. Anonymous mailing access returned HTTP 401. Authenticated candidate contact access and the privacy page returned HTTP 200. The published flyer returned HTTP 200 with its original 1,434,362 bytes.
- Live contact inventory: 1,115 unique valid addresses, all with no recorded promotional opt-in at release. No existing address was enrolled. Confirmed/pending/unsubscribed marketing totals were zero.
- Live browser verification confirmed both offer cards open from Monthly offers, the banner signup exists, consent starts unchecked, and the admin badge/status totals match the protected API. Chrome restarted during verification; refreshed restored tabs showed the new release.
- A recent Vercel runtime-error query returned zero error records. Private proof images are stored locally; no customer email rows appear in shared screenshots.

The prior deployed source (`2905408`) was also reviewed after the owner's consent question. Its reservation checkbox explicitly referred to SMS verification and reservation reminders. No separate email-marketing opt-in was found in the reviewed reservation/catering forms. Submission supports service communications; it is not recorded promotional-email consent. For US audiences, CAN-SPAM generally does not require prior affirmative opt-in, which is distinct from this feature's deliberately stricter confirmed-opt-in policy. Do not relabel historic addresses as confirmed opt-ins without actual evidence.
