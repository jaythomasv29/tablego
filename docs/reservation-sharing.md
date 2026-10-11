# Reservation invitations and guest page

Confirmed reservations for today or a future restaurant calendar date now have a Share by email action on their secure management page. The owner enters one email address and sends a restaurant-styled invitation with the saved host name, date, time, party size, restaurant address, directions, and menu link. Sharing does not create another booking or increase the reserved party size.

Invitations are snapshots. Friends do not receive the owner's management link, reservation ID, phone or email, guest requests, staff notes, or any ability to reschedule or cancel. The email asks recipients to check with their host if plans change. Recipients are not enrolled in marketing and there is no recipient RSVP or automatic invitation update in this feature.

The guest page retains the restaurant's cream, sage, beige, and charcoal palette, with an editorial heading, clearer day/time/party details, directions, and an animated place setting. The short entrance and line drawing settle within four seconds. Reduced-motion preferences disable the animation. Pending and cancelled reservations keep accurate status language and do not show a confirmed checkmark or sharing action.

## Sending and access

- `POST /api/reservations/[id]/share` requires the current unexpired owner bearer token and a valid mutation origin. Only `{ email }` is accepted; custom message content and extra booking fields are rejected.
- A request must include an `Idempotency-Key`. Concurrent requests and retries with the same recipient/key create one durable invitation. Changing the recipient while reusing that key is rejected.
- A transaction enforces 20 invitations per reservation in a rolling 24-hour window and a 15-minute cooldown for the same normalized recipient. Invitation submission records live under the existing server-only `managementAccess` tree; no rules deployment or new client-accessible collection is needed.
- Invitations use the existing notification outbox, transactional send leases, immediate best-effort delivery, scheduled retries, and staff retry controls. Queued jobs whose booking revision changed are superseded. Delivery also rechecks confirmed status and the restaurant calendar date.
- Sharing leaves the booking's status, party size, version, and notification revision unchanged. Staff can find invitation recipients and delivery results in the booking's existing Message delivery panel.

## Staging and validation

All invitations are captured in ordinary staging and in the restricted real-provider test profile. The invitation form and success message explicitly explain this. The provider-test exception remains limited to previously authorized confirmation messages and OTP checks; sharing does not expand its live recipient permissions.

Run the focused staging smoke check against the built QA server:

```sh
node scripts/staging.mjs build --qa
node scripts/staging.mjs start --qa
# In another terminal:
node --experimental-strip-types scripts/staging-sharing-smoke.mjs
```

The smoke check verifies access/origin validation, strict recipient validation, concurrent idempotency, one captured message per request, exclusion of private data and owner access, recipient cooldown, concurrent quota enforcement, invalid/expired/terminal/past booking refusal, unchanged booking state, and stale retry suppression. It creates only synthetic records in `tablego-staging-1d712` and removes its own fixtures. `--keep-ui` retains one clearly marked synthetic booking and writes its secure URL to the ignored, private `.staging/sharing-ui-booking.json` for browser review.

Validation completed:

- 87 automated tests passed; invitation dates were additionally checked in all five existing viewer-timezone test processes.
- Type checking, lint with zero warnings, and the optimized isolated staging build passed.
- The real sharing form successfully queued a captured invitation. Its busy state disabled recipient editing, then closed with an accurate queue notice.
- Desktop and 390 × 844 guest-page and sharing-dialog layouts were reviewed without horizontal page overflow. Temporary viewport overrides were reset.
- The captured invitation HTML was rendered in a browser for visual review. A live inbox/email-client invitation test was not performed.

One synthetic review booking is retained for local preview. Other smoke fixtures were removed. Production hosting, credentials, rules, and restaurant reservations were not changed.
