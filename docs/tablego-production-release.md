# TableGo production release — October 13, 2026

October 14 update: [the Today timeline refinement](today-timeline-update.md) is now deployed as source `22cae66`, retaining the configuration and protected database rules recorded below.

The user authorized deploying the tested TableGo version to the actual `tablego` project. Production now runs at https://tablego.vercel.app using the existing live `tablego-1d712` Firebase database.

## Released version

- Functional release includes the full tested reservation, Today activity, verified phone, guest editing/cancellation, sharing, catering workflow/bulk closure and food-label pagination changes.
- Production source and remote `main`: `6cfa5fa74813733d0ce1d28c028fd583b8361a54`, based on `1f102e6` / label fix `a892e7e`.
- Vercel project: `tablego` / `prj_fPSdpiiYjFR2KZZW0fgToPtLMcCu`.
- Promoted Ready deployment: `dpl_H3CFaZE8M6FQLXEejJX3jAkkZiiK`, https://tablego-dgp748xy4-jaythomasv29s-projects.vercel.app.
- Previously active legacy deployment: `dpl_9vRS5KSwugfWZ2bze7cEwfJc3AxF` / `2905408`.
- Source was prepared in the separate `release/tablego-production-2026-10-13` worktree. The original local worktree and its development branch were preserved.

## Production configuration and database migration

Production uses the tested server Firebase identity, real Twilio Verify/SMTP settings, strong staff credentials, a stable session/token encryption secret and the notification-worker secret. The canonical URL is https://tablego.vercel.app. The tested encryption secret was retained because both sites share secure-link/outbox data. Node remains 22.x with `NODE_OPTIONS=--experimental-require-module`.

Variable changes were scoped to Production; existing Development/Preview scopes retained their original values. The unused public company-password variable was removed from future Production builds. Existing live provider email settings already matched the tested configuration. Credentials and configuration snapshots are private under `.staging/`, excluded from Git and Vercel uploads. Production login credentials are the same as tablego-milb and are saved privately in `/Users/james/Desktop/code/tablego/.staging/tablego-production-admin-access.txt`.

After the new application was promoted, the reviewed `firestore.rules` were compiled and published to the shared live database. Active ruleset: `projects/tablego-1d712/rulesets/736e605b-7eef-4995-803f-c65c8078472e`. Reservations and catering are no longer publicly readable or writable; guest actions use protected server APIs, and direct staff access requires an active signed staff session/custom Firebase token. No destructive record migration or customer-record change was performed by this rollout. Existing indexes were retained.

The previous live ruleset and project/environment configuration were saved privately before the migration. The old publicly permissive ruleset was `68b80785-0038-4313-9a2d-d5229636a2e7`.

## Build reliability correction

The first GitHub build passed typecheck, lint and all 150 tests, then failed in the Google font loader. The first Vercel build succeeded. To remove that external build dependency, the 20 WOFF2 font files already served by the tested site were copied byte-for-byte into `public/fonts/`, together with their SIL Open Font Licenses. All 46 font-face declarations, weights, styles, language subsets, fallback metrics and the single Inter preload were retained. The CSS variables and visible design remain the same. Bundled font assets use immutable caching.

After this correction, [release-branch CI](https://github.com/jaythomasv29/tablego/actions/runs/38480094072) and [main CI](https://github.com/jaythomasv29/tablego/actions/runs/38480357227) passed, including all 150 tests and optimized builds. Vercel also completed its optimized Production build. Remote `main` was advanced without a force push so future deployments retain this release.

## Verification on the actual host

- Production configuration passed the hosting preflight. The stored server credential was checked directly; the CLI dotenv export converts embedded private-key newline escapes, so its parsed JSON alone is not a reliable credential comparison.
- Server Firebase settings read, SMTP authentication and the real four-digit Twilio Verify service configuration succeeded without sending messages.
- HTTPS staff login returned Secure/HttpOnly cookies. Firebase accepted its custom staff token. Protected catering API reads returned the existing live inquiries. The separate API smoke session was signed out; the browser admin session was left open for the user.
- After rules publication, authenticated Firestore reads of reservations and label items returned 200. Public menu reads still returned 200. Unauthenticated reads of reservations, catering and notification outbox returned 403.
- The canonical availability API returned America/Los_Angeles and 14 valid slots for October 16. The browser selected that business-local date and a dinner time, then opened guest details successfully; no booking was submitted.
- Public menu and catering pages returned 200. Catering displayed phone verification and a disabled proposal submission before proof. Unauthenticated staff and notification-worker endpoints returned 401.
- The actual admin login opened Food Labels, Today and Catering successfully after the database migration. Today displayed its compact activity button and restaurant-local service time. Catering showed its existing records/stages and disabled bulk closure when there were no active inquiries.
- Eight selected labels rendered two page groups with four cards each. The print root's parent was BODY, outside the clipped dashboard layout. No custom item was created and no customer inquiry was closed during these checks. Actual native print-preview/PDF verification remains the separate limitation recorded in the label rollout; no new physical print job was sent.
- All 20 canonical font URLs returned bytes matching the bundled files. The browser confirmed that Playfair Display and Cormorant Garamond were ready and rendered the restaurant design. Desktop screenshots are retained privately.
- No error-level runtime log entries were returned for the final 15-minute verification window. This establishes the checked requests, not a guarantee against all future faults.

## Remaining operational limits

Twilio Verify OTP and live email are enabled. Optional reminder SMS remains disabled because the account's sending number has the pre-existing toll-free verification rejection described in [the milb deployment record](tablego-milb-live-test.md). No sending-number configuration or billing plan was changed. The Vercel Hobby daily cron remains the retry fallback; immediate email delivery still uses the durable outbox and post-response attempt. No new real email/OTP was sent by this promotion test; prior recipient-authorized delivery tests remain documented in the milb record.

Firebase Storage upload workflows were not newly exercised, and the chatbot remains disabled. Guests opening historical ID-only links use verified recovery. Staff with an old application tab should refresh and use the tested staff credentials.

## Rollback guidance

The first protected Production build of this rollout remains Ready: `dpl_CHGU7TfCzfx5FPmAWpUPn8xJUuiT`, https://tablego-667vqrcot-jaythomasv29s-projects.vercel.app, source `1f102e6`. It has the same protected reservation/catering flow and retained encryption secret, and is compatible with the newly published rules. It can serve as the application fallback while correcting a later issue.

Before a rollback, verify the linked project is `tablego` / `prj_fPSdpiiYjFR2KZZW0fgToPtLMcCu`. Promote the compatible protected deployment through Vercel and recheck availability, staff login and business-local displays. Retain the current server/encryption configuration and shared database records. Do not casually restore the legacy `2905408` application or public rules: that application predates the protected write flow. Application rollback does not undo messages or saved bookings.
