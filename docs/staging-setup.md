# Isolated staging for TableGo

Staging is a test version of the restaurant site, backed by its own Firebase project and notification accounts. A branch or hosting preview that uses production environment variables is still connected to production data.

## Required setup

1. Identify the live Firebase project in Firebase Console → Project settings. Record its project ID without sharing credentials.
2. Create a second Firebase project, such as `tablego-staging`, with Firestore and Storage. Enable the same required services and deploy reviewed rules and indexes. Do not copy real guest data into it; create synthetic reservations instead.
3. Register a web app in the staging project. Configure the hosting preview with that app's `NEXT_PUBLIC_FIREBASE_*` values. These values are public configuration, but they must point to staging rather than the live project.
4. Configure a staging `NEXT_PUBLIC_BASE_URL`, separate admin credentials, and independent SMTP/Twilio test credentials. Use a mail capture service or dedicated test inboxes and provider test recipients. Current notification handlers send to the supplied guest address; a preview environment is not yet protected by a central recipient override.
5. When server-side database access is introduced, add credentials belonging only to staging. Keep service-account keys and SMTP/Twilio credentials in the hosting environment's secret store, never in Git or chat.
6. Check that preview deployments cannot inherit production credentials. Review the hosting provider's environment scopes and confirm the project ID in the compiled public configuration before interacting with the preview.
7. Run guest/staff smoke tests with synthetic guests: create, acknowledge/confirm, reschedule, cancel, attendance, reminder and delivery failure. Verify records appear only in staging and messages go only to test destinations.

## Current status

The repository has no deployed Firestore rules/index definitions or hosting project configuration establishing an isolated staging environment. The existing `.env.local` is not proof of isolation and has not been used to exercise live bookings during this work.

Creating or changing cloud resources and testing messages requires the correct project/account context. No cloud project, database record, message or hosting deployment has been changed by Phase 0.

The Firebase CLI is installed, but `firebase projects:list --json --non-interactive` reports that it is not authenticated, including when retried with normal network access. Sign in from a local terminal using `firebase login`, then identify the live project and prepare a separate staging project. Do not paste authentication tokens into chat.

Local type checks, lint, pure date tests and build compilation can proceed while staging is prepared. Database/provider integration checks and rollout gates remain pending until isolation is verified.
