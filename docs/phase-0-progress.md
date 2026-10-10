# Phase 0 implementation record

Branch: `refinement/phase-0-quality-baseline`.

## Changes

- Added explicit typecheck, lint, test and combined check commands and a GitHub Actions quality workflow.
- Removed production suppression of TypeScript and ESLint checks.
- Updated calendar integration to the installed DayPicker API, restored success/warning badge variants and made the closed-date message handle absent metadata safely.
- Resolved duplicated imports and hook dependency warnings using stable callbacks, including preventing OTP auto-verification from repeatedly submitting the same completed code.
- Added ten regression cases for restaurant timezone midnight boundaries, daylight saving transitions, Firestore timestamps and stable date-only email formatting. Three known date-helper defects remain tracked as TODOs, not passing coverage of those behaviors.
- Added three component tests for OTP submission, incomplete codes and retrying an invalid code. All HTTP calls are mocked; no SMS is sent.
- Documented staging requirements separately from local checks.

## Environment and remaining gates

Use Node 22.14 or newer for the native TypeScript test runner. CI uses Node 22.22.2 to meet current dependency engine requirements. Production font compilation needs network access to Google Fonts. Tests make no Firebase or notification requests.

The lint configuration now includes Next's Core Web Vitals rules using `eslint-config-next` pinned to the installed Next version, 15.5.9. Hook dependency warnings are errors. Fourteen existing JSX escaping errors were corrected without changing displayed text. Eleven existing font/image optimization warnings remain visible, with a warning budget of 11 so additional warnings fail the standalone lint gate. These performance warnings belong to Phase 5; no lint errors are ignored.

Separate staging Firebase/hosting configuration, deployed rules/index inventory and staging guest/staff smoke tests are still outstanding. Phase 0 is not ready for deployment until those gates pass.
The installed Firebase CLI currently has no authenticated account, so project inventory could not be completed.

## Local validation

- Typecheck: passed.
- Lint: zero errors; eleven documented performance warnings within the budget.
- Tests: thirteen passed; three explicit TODOs.
- Production build: passed with type and lint validation enabled. The first sandboxed attempt failed to fetch Google Fonts; the network-enabled rerun passed.
- Git whitespace check and package/lockfile dependency consistency: passed.

No deployment, real booking, database migration or provider message was performed. CI is defined but has not been pushed or run in GitHub. Dependency installation also reported existing vulnerabilities across the dependency graph; those need a targeted dependency audit before release, rather than an automatic breaking `npm audit fix --force`.
