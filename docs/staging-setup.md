# Isolated staging for TableGo

The test project is `tablego-staging-1d712` (display name **TableGo Staging**). The live project remains `tablego-1d712`.

## Provisioned October 10, 2026

- Separate Firebase project, web app and standard Firestore database in `nam5`.
- Firebase Authentication initialized through the console, with custom staff-token sign-in verified.
- Staging-only service account with database/authentication roles; no access to the live project.
- Repository Firestore rules and five existing index definitions deployed **only to staging**. Guest browsers cannot read reservations or alter them by document ID. Staff state changes and private session/link/job records are server controlled.
- Synthetic hours/settings and reservations only. No real guest data copied.
- `.env.staging.local` and `.staging/server-credentials.json` are ignored by Git and have private filesystem permissions. Do not copy their values into tickets, Git or chat.
- Email, SMS and OTP are captured locally under `.staging/`; staging cannot activate real delivery. Missing staging variables are explicitly blanked so Next cannot reload live secrets from `.env.local`.
- Live database records, live rules and live credentials remain unchanged. No public hosting deployment or billing upgrade was performed.

## Run and verify

```sh
npm run dev:staging
# In another terminal, with the staging server running:
node scripts/staging-smoke.mjs
npm run build:staging
npm run start:staging
```

Open http://127.0.0.1:3100. Staff credentials are in the private local staging environment file. Use the **staging-admin** account for local staff testing. Staging OTP codes are captured locally instead of sent to phones. The smoke runner uses synthetic example.invalid email addresses, verifies that both configuration and credentials point at staging, and retains its test reservations for review.

The smoke suite checks forged and revoked staff sessions, database permission denials, verified phone proofs, wrong-reservation tokens, concurrent idempotent creation, transition restrictions, token rotation, rescheduling, notification outages and fail-closed availability. It temporarily alters **staging** hours/capture settings and restores them in `finally` blocks; run it only against an isolated local staging server, without simultaneous manual booking tests.

## Remaining release preparation

- A hosted preview is not yet configured. Local staging is isolated; a preview must receive the same staging credentials and capture safeguards before use.
- Firebase Storage has not been provisioned. Asset-upload tests require a staging bucket; no billing change has been made to create one.
- Production rollout needs reviewed server credentials, independent session secret, initialized Authentication, new database rules, and an active notification worker. Restricting live rules before deploying the migrated application would break the old guest flow.
- Notification provider delivery and deployed worker scheduling must be verified separately; capture tests do not verify SMTP/Twilio deliverability.

Firebase Console: https://console.firebase.google.com/project/tablego-staging-1d712/overview
