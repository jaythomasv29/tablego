# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (port 3000)
npm run build    # Production build (TS/ESLint errors are suppressed — see next.config.mjs)
npm run lint     # ESLint check
npm run start    # Serve production build
```

There are no automated tests. There is a one-off seed script:
```bash
node scripts/seed-employees.mjs   # Seed employee data into Firestore
```

## Architecture Overview

This is a **Next.js 15 App Router** restaurant reservation system for Thaiphoon Restaurant. All data lives in **Firebase/Firestore** (client SDK — not the Admin SDK). Email is sent via **Nodemailer** (Gmail SMTP) from API routes.

### Public-facing flow

`src/app/page.tsx` renders `src/App.tsx` — the landing page with a full-screen hero video and a reservation modal. The modal is a two-step form:
1. **DatePicker** (date + time slot + party size)
2. **GuestInfo + AdditionalInfo** (name, email, phone, comments)

On submit, `POST /api/send-confirmation` writes the reservation to Firestore and sends a confirmation email. Available time slots are generated client-side in `App.tsx#generateTimeSlots` from the `settings/businessHours` Firestore doc.

Other public routes: `/menu`, `/cater`, `/reservation` (deep-link to reserve), `/cancel-reservation`, `/reschedule`.

### Admin area (`/admin/*`)

Protected by `middleware.ts`, which checks for a `company-auth` cookie. Missing cookie → redirect to `/login`. There is **no NextAuth session** — auth is purely cookie-based with a shared company password.

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
| `POST /api/send-confirmation` | Create reservation in Firestore, send guest confirmation email |
| `POST /api/send-reminder` | Send reminder email, mark `reminderSent: true` on the doc |
| `POST /api/send-cancellation` | Cancel reservation, send guest email |
| `POST /api/send-reschedule` | Reschedule, send guest email |
| `GET /api/availability/check?date=&time=` | Check if a specific date+time is bookable |
| `GET /api/availability/slots?date=` | Return available time slots for a date |
| `GET /api/availability/settings?date=` | Return raw businessHours + cutoff (used by ai-chat-widget) |

### Firestore schema

| Collection / Doc | Contents |
|---|---|
| `reservations/{id}` | `date` (YYYY-MM-DD string), `time` (e.g. "7:00 PM"), `name`, `email`, `phone`, `guests`, `comments`, `status` ('pending'/'confirmed'/'cancelled'), `reminderSent`, `reminderSentAt`, `attendanceStatus` |
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

The public page embeds a standalone chat widget via a `<script>` tag in `src/app/layout.tsx`. The widget is a separate project (`ai-chat-widget`). It calls `/api/availability/settings` and `/api/availability/check` as open (unauthenticated) endpoints to answer guest questions about hours and slot availability.

### Key dependencies

- **shadcn/ui** (`src/components/ui/`) — component primitives (Button, Badge, Dialog, DropdownMenu…)
- **Framer Motion + GSAP** — animations (GSAP used in `App.tsx` for modal open)
- **Lucide React** — icons
- **react-hot-toast** — toast notifications in admin
- **@tanstack/react-query** — available but not widely used yet
- **Vercel Analytics** — included in root layout

### Build notes

`next.config.mjs` disables both TypeScript and ESLint errors during builds (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`). The build also forces aggressive cache-busting headers site-wide and a timestamp-based `generateBuildId`.
