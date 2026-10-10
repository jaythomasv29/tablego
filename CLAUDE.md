# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (port 3000)
npm run build    # Production build with TypeScript and ESLint validation
npm run lint     # ESLint check
npm run typecheck # TypeScript check
npm test         # Date/timezone regression tests
npm run check    # All quality checks and build
npm run start    # Serve production build
```

Automated regression tests are in `tests/`. Use Node 22.14 or newer for the native TypeScript test runner. There is a one-off seed script:
```bash
node scripts/seed-employees.mjs   # Seed employee data into Firestore
```

## Architecture Overview

This is a **Next.js 15 App Router** restaurant reservation system for Thaiphoon Restaurant. Reservation mutations, private sessions and delivery jobs use the server Admin SDK. Other staff operations still use authenticated client Firestore access during incremental migration. Email/SMS use a central capture-safe transport.

### Public-facing flow

`src/app/page.tsx` renders `src/App.tsx` — the landing page with a full-screen hero video and a reservation modal. The modal is a two-step form:
1. **DatePicker** (date + time slot + party size)
2. **GuestInfo + AdditionalInfo** (name, email, phone, comments)

On submit, `POST /api/send-confirmation` validates allowlisted fields and a phone-bound server verification proof, then atomically stores a pending request, management-token authorization, event and durable notification intents. Guest acknowledgement does not grant restaurant acceptance. Stable Idempotency-Key headers protect retries. Public and server slot checks use `src/lib/reservations/availability.ts`; unavailable configuration returns 503.

Other public routes: `/menu`, `/cater`, `/reservation` (deep-link to reserve), `/cancel-reservation`, `/reschedule`.

### Admin area (`/admin/*`)

Root middleware verifies a signed, expiring HttpOnly cookie. Privileged API handlers also verify its server-owned revocation record and mutation origin. The admin layout authenticates Firebase with a scoped custom token before mounting data consumers; rules check session expiry/revocation. There is no NextAuth session.

Key admin pages:
- `/admin/home` — dashboard
- `/admin/reservation` — view/manage reservations (Past / Yesterday / Today / Tomorrow / Future tabs)
- `/admin/hours` — configure business hours (lunch + dinner per weekday, custom ranges supported)
- `/admin/special-dates` — add closures (`full`, `lunch`, or `dinner` closureType)
- `/admin/team` — drag-and-drop weekly staff schedule
- `/admin/settings` — timezone + reservation cutoff minutes
- `/admin/banner` — manage the announcement banner on the landing page

### API routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `POST /api/send-confirmation` | Create pending request with verified phone evidence, secure link and notification intents |
| `POST /api/send-reminder` | Staff only: queue reminder to stored guest contact; delivered state is tracked separately |
| `POST /api/send-cancellation` | Legacy token-authorized cancellation adapter |
| `POST /api/send-reschedule` | Legacy token-authorized reschedule adapter |
| `GET /api/availability/check?date=&time=` | Check if a specific date+time is bookable |
| `GET/POST /api/reservations/{id}` | Token-authorized details, acknowledgement, cancellation and rescheduling |
| `POST /api/reservations/{id}/recover` | Rotate access after verifying the booking phone |
| `POST /api/staff/reservations/{id}` | Staff lifecycle transitions |
| `GET /api/availability/settings?date=` | Return raw businessHours + cutoff (used by ai-chat-widget) |

### Firestore schema

| Collection / Doc | Contents |
|---|---|
| `reservations/{id}` | `date` (YYYY-MM-DD string), `time` (e.g. "7:00 PM"), `name`, `email`, `phone`, `guests`, `comments`, `status` (pending/confirmed/seated/completed/cancelled/no-show), `reminderSent`, `reminderSentAt`, `attendanceStatus` |
| `settings/businessHours` | Keyed by lowercase day name; each day has `lunch` and `dinner` objects with `isOpen`, `open`, `close`, and optional `customRanges[]` |
| `settings/general` | `timezone` (IANA string), `reservationCutoffMinutes` |
| `settings/banner` | `text`, `link`, `linkText` |
| `specialDates/{id}` | `date` (ISO string), `reason`, `closureType: 'full'|'lunch'|'dinner'` |
| `employees/{id}` | `name`, `role: 'front'|'kitchen'` |
| `schedules/{id}` | Recurring weekly staff shifts: `employeeId`, `dayOfWeek`, `period`, `startTime`, `endTime` |
| `scheduleOverrides/{id}` | Per-week overrides on `schedules`: `scheduleId`, `date`, `action: 'modify'|'cancel'` |

### Timezone handling

The restaurant's timezone is stored in `settings/general.timezone` (default `America/Los_Angeles`). It is loaded app-wide via `TimezoneContext` (`src/contexts/TimezoneContext.tsx`) and made available via the `useTimezone()` hook.

**Critical rules:**
- Reservation dates are stored as bare `YYYY-MM-DD` strings (not Timestamps, not ISO datetimes).
- To get today's `YYYY-MM-DD` in the restaurant's timezone: `new Date().toLocaleDateString('en-CA', { timeZone: timezone })`.
- To display a `YYYY-MM-DD` string without timezone shift, parse it as UTC noon: `new Date(Date.UTC(y, m-1, d, 12, 0, 0))` then format with `timeZone: 'UTC'`.
- Always convert times through the restaurant timezone before comparing, never raw UTC.

The `src/utils/dateUtils.ts` file exports the canonical helpers (`getLocalDateString`, `formatReadableDatePST`, `getTodayInTimezone`, etc.). Use these rather than inline conversions.

### AI Chat Widget

Chat-widget scripts in `src/app/layout.tsx` are currently commented out. The widget is a separate project (`ai-chat-widget`). It calls `/api/availability/settings` and `/api/availability/check` as open (unauthenticated) endpoints to answer guest questions about hours and slot availability.

### Key dependencies

- **shadcn/ui** (`src/components/ui/`) — component primitives (Button, Badge, Dialog, DropdownMenu…)
- **Framer Motion + GSAP** — animations (GSAP used in `App.tsx` for modal open)
- **Lucide React** — icons
- **react-hot-toast** — toast notifications in admin
- **@tanstack/react-query** — available but not widely used yet
- **Vercel Analytics** — included in root layout

### Build notes

`next.config.mjs` validates TypeScript and ESLint during builds. The build still forces aggressive cache-busting headers site-wide and a timestamp-based `generateBuildId`; caching changes are planned for a later phase. Standalone lint enforces zero errors and the documented existing performance-warning budget. See `docs/phase-0-progress.md` for staging gates and validation status.
