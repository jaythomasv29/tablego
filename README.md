#### Past/Future Tabs
- Past: Shows reservations before today in PST
- Future: Shows reservations after today in PST
- Sorted by date and time

### Status Handling
- Prior: Shown for past time slots
- Confirmed: Active reservations
- Cancelled: Cancelled reservations
- Pending: New reservations awaiting confirmation

### Reminder System
- Tracks reminder status with `reminderSent` and `reminderSentAt`
- Prevents duplicate reminders within 24 hours
- Displays reminder status on reservation cards

## Important Notes
1. Always use the provided helper functions for date handling
2. All date comparisons must be done in PST
3. Keep date and time separate in Firebase
4. Use ISO format for storing dates
5. Display dates in user's local timezone where appropriate

## Common Pitfalls
1. Direct UTC comparisons without timezone conversion
2. Mixing date formats (Timestamp vs ISO string)
3. Not accounting for PST in date filtering
4. Comparing full datetime instead of just dates

## Future Considerations
1. Consider storing timezone information with reservations
2. Add timezone conversion utilities for international expansion
3. Implement date format validation before storage

### Important Timezone Note
- Dates stored as "2025-02-16T20:00:00.000Z" (UTC) need to be converted to PST
- Example: 8:00 PM UTC Feb 16 = 12:00 PM PST Feb 16
- Always convert to PST before date comparisons

## Quality checks and phased refinement

Use `America/Los_Angeles` for restaurant timezone calculations, including daylight saving time; PST is not a year-round fixed offset.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`, or `npm run check` for all four. The initial test suite covers timezone and date storage behavior. Build-time type and lint failures are no longer suppressed.

See [the refinement plan](docs/tablego-refinement-plan.md), [Phase 0 progress](docs/phase-0-progress.md), and [isolated staging setup](docs/staging-setup.md). Do not exercise booking or notification tests against the live database or real guest recipients.
