# Today service view

The admin landing page stays at `/admin/home`. It now leads with the service rather than ten metric cards: a short booked-guest summary, then reservations grouped into Needs attention, Arriving in the next hour, Seated now, and Later today. Arrival time, party size, guest requests, dietary and seating preferences, staff notes, and the current booking action remain visible. Completed, cancelled, and no-show bookings are under Finished and cancelled.

Needs attention includes today's pending requests, imported details needing review, and confirmed parties whose arrival time has been reached. Undated records needing review are also surfaced so staff can resolve their missing date. Reaching an arrival time never automatically changes attendance or marks a no-show. The next-hour window includes confirmed arrivals strictly after the current business clock and up to 60 minutes ahead on the same restaurant calendar date. The view refreshes its clock every 30 seconds and listens to saved reservation changes.

Today always uses the configured restaurant IANA timezone, including when the viewer is abroad. Search, optional status/request/large-party filters, and Clear filters operate across all of today's service groups. Active filters show the matching count; the small overall booked-guest summary continues to describe the whole day. All reservations opens the existing console with calendar, range, and status filters. Insights remains available separately.

Reminder buttons, contact details, guest history, notes, and per-booking message delivery remain under Details and reminders. Message delivery tools are below the service groups. The change does not send messages, modify automatic confirmation settings, or change booking permissions.

## Validation

- 76 automated tests passed, including due/next-hour boundaries, midnight rollover, the international date line, undated review records, and non-overlapping service groups. The existing five viewer-timezone tests now also exercise Today grouping.
- Type checking, lint with zero warnings, and the optimized isolated staging build passed.
- Browser checks used four temporary synthetic records in `tablego-staging-1d712`: grouping, search and clearing filters, large-party filtering, opening booking details, disabled SMS without consent/proof, seating a due party into Seated now, opening finished bookings, and navigation to the full console. No reminder was sent.
- Desktop and 390 × 844 rendering were reviewed. The mobile viewport took effect after an initial delay; its final measured viewport and document width were both 390 pixels, with no horizontal page overflow. The viewport override was reset afterward.
- Temporary records created for these browser checks were removed after verification. Existing staging reservations were preserved.

This is a local testing-branch change. Production deployment remains a separate release step.
