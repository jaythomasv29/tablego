# Team View - Weekly Schedule Management

## Overview
The Team View page provides a drag-and-drop weekly calendar for managing recurring staff shifts. Employees are assigned to weekly slots (e.g. "Every Monday Lunch") and the schedule automatically repeats. Individual weeks can be modified or skipped.

## How It Works

### Core Concept: Recurring Schedules
When you drag an employee to a shift slot, it creates a **recurring weekly assignment**. That employee will appear on that same day/period every week automatically. This matches how restaurants typically operate — if Mike works Monday lunch, he works every Monday lunch unless something changes.

### Per-Week Overrides
For any specific week, you can:
- **Modify times** (e.g. Mike works 12-4 instead of 11-3 this week only)
- **Skip the week** (e.g. Mike is off this Monday)

The recurring schedule remains intact — overrides only affect the specific week.

## Using the Interface

### Adding Employees
1. Click **"Add Employee"** in the sidebar
2. Enter name and select role (Front of House or Kitchen)
3. Employee appears in the sidebar, ready to be dragged

### Assigning Shifts (Drag & Drop)
1. Find the employee in the left sidebar
2. **Drag them** onto a calendar cell (day + period)
3. Drop zones highlight when a compatible employee hovers over them
4. Front of House employees can only be dropped on FOH rows; Kitchen on Kitchen rows
5. The shift is created as a **recurring weekly** assignment with times from business hours

### Editing Shifts
1. **Click** on any shift chip in the calendar
2. The edit modal appears with options:
   - **Save for all weeks** — update the recurring start/end times
   - **Save for this week only** — create a one-time time change
   - **Skip this week only** — cancel just this occurrence
   - **Remove permanently** — delete the recurring assignment entirely

### Week Navigation
- Use the arrows to go forward/back by week
- Click **Today** to jump to the current week
- The same recurring shifts appear on every week (unless overridden)

## Calendar Layout

The grid is organized as:

| Section | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---------|-----|-----|-----|-----|-----|-----|-----|
| **FOH Lunch** | [employees] | ... | ... | ... | ... | ... | ... |
| **FOH Dinner** | [employees] | ... | ... | ... | ... | ... | ... |
| **Kitchen Lunch** | [employees] | ... | ... | ... | ... | ... | ... |
| **Kitchen Dinner** | [employees] | ... | ... | ... | ... | ... | ... |

- **Blue** = Front of House shifts
- **Orange** = Kitchen shifts
- **Red background** = Holiday (from `specialDates` collection)
- **Gray** = Closed (from business hours)
- **Amber ring** = Modified for this specific week

## Firebase Collections

### `employees`
```json
{
  "name": "Mike Sanders",
  "role": "front"  // or "kitchen"
}
```

### `schedules` (recurring weekly assignments)
```json
{
  "employeeId": "abc123",
  "employeeName": "Mike Sanders",
  "role": "front",
  "dayOfWeek": "monday",
  "period": "lunch",
  "startTime": "11:00",
  "endTime": "15:00"
}
```

### `scheduleOverrides` (per-week changes)
```json
{
  "scheduleId": "xyz789",
  "date": "2026-02-16",
  "action": "modify",      // or "cancel"
  "startTime": "12:00",    // only if action is "modify"
  "endTime": "16:00"       // only if action is "modify"
}
```

### `specialDates` (holidays — already exists)
```json
{
  "date": "2026-12-25T00:00:00.000Z",
  "reason": "Christmas"
}
```

### `settings/businessHours` (already exists)
Used to determine which days/periods are open and to set default shift times.
