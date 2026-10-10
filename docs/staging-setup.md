# Isolated staging for TableGo

The test project is `tablego-staging-1d712` (display name **TableGo Staging**). The live project remains `tablego-1d712`.

## Provisioned October 10, 2026

- Separate Firebase project, web app and standard Firestore database in `nam5`.
- Firebase Authentication initialized through the console, with custom staff-token sign-in verified.
- Staging-only service account with database/authentication roles; no access to the live project.
- Repository Firestore rules and six index definitions (including notification retry ordering) deployed **only to staging**. Guest browsers cannot read reservations or alter them by document ID. Staff state changes and private session/link/job records are server controlled.
- Synthetic hours/settings and reservations only. No real guest data copied.
- `.env.staging.local` and `.staging/server-credentials.json` are ignored by Git and have private filesystem permissions. Do not copy their values into tickets, Git or chat.
- Email, SMS and OTP are captured locally under `.staging/`, or privately in staging Firestore on Vercel; staging cannot activate real delivery. Missing staging variables are explicitly blanked so Next cannot reload live secrets from `.env.local`.
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

The smoke suite also verifies authenticated concurrent notification workers, outage recovery, bounded exhaustion, obsolete updates and staff retries. It checks forged and revoked staff sessions, database permission denials, verified phone proofs, wrong-reservation tokens, concurrent idempotent creation, transition restrictions, token rotation, rescheduling, notification outages and fail-closed availability. It temporarily alters **staging** hours/capture settings and restores them in `finally` blocks; run it only against an isolated local staging server, without simultaneous manual booking tests.

## Hosted staging capture preparation

Vercel staging automatically uses `stagingCaptures` and `stagingOtpChallenges` in the isolated database. Both are denied to public and staff Firebase clients; operators can inspect synthetic captures through the Firebase project console. OTP consumption is transactional and single use. A hosted preview needs `TABLEGO_ENVIRONMENT=staging`, `NEXT_PUBLIC_TABLEGO_ENVIRONMENT=staging`, `TABLEGO_NOTIFICATION_MODE=capture`, the staging SDK configuration and staging-only `FIREBASE_SERVICE_ACCOUNT_JSON`. Use independent ADMIN/CRON secrets and set NEXT_PUBLIC_BASE_URL to the actual preview origin. Never supply live credentials to previews. No hosted credentials have been uploaded.

To exercise persistent capture locally, start staging with `TABLEGO_NOTIFICATION_CAPTURE_STORAGE=firestore npm run dev:staging`, then run `node scripts/staging-capture-smoke.mjs`. Use the default filesystem backend for the outage smoke runner.

## Remaining release preparation

- A hosted preview is not yet configured. Local staging is isolated; a preview must receive the same staging credentials and capture safeguards before use.
- Firebase Storage has not been provisioned. Asset-upload tests require a staging bucket; no billing change has been made to create one.
- Production rollout needs reviewed server credentials, independent session secret, initialized Authentication, new database rules, and an active notification worker. Restricting live rules before deploying the migrated application would break the old guest flow.
- Notification provider delivery and deployed worker scheduling must be verified separately; capture tests do not verify SMTP/Twilio deliverability.

Firebase Console: https://console.firebase.google.com/project/tablego-staging-1d712/overview
