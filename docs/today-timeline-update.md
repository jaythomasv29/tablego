# Today reservation timeline — October 14, 2026

Released source: `22cae66ed95c20b497406c25eb184e921c761992`. Tested on `refinement/today-chronological-list`, advanced to remote `main` without a force push, and promoted to https://tablego.vercel.app. Ready deployment: `dpl_AG13gwwed5cF8FSUarc13NKq35N5`.

The page heading is now **Today**. Arrivals, Later today, Seated now, and the separate finished/cancelled groups have been replaced with one chronological reservation list. All of today's statuses remain visible in time order. Incomplete or undated imported schedules remain accessible at the end. Existing search, filters, activity notifications, verified phone badges, details and staff actions are retained.

Bookings still awaiting arrival receive an amber border/background and a **Time passed** badge after their scheduled time. Seated, completed, cancelled and no-show bookings retain their status styling. This is a visual cue and never records an attendance/status change. It uses the configured restaurant timezone and refreshes with the existing 30-second clock; exact scheduled time is not yet considered passed.

Validation: typecheck, zero-warning lint, all 152 automated tests, [GitHub CI](https://github.com/jaythomasv29/tablego/actions/runs/38641596648) and the optimized Vercel build passed. Checks cover chronological ordering across statuses, incomplete dates/times, the clock transition, business midnight, the international date line, both repeated daylight-saving hours, and five viewer timezones. A component test advances the clock and checks that the cue appears without mutating attendance.

Isolated staging browser verification used three owned synthetic reservations: earlier, seated and later. The earlier reservation showed the amber cue; all three stayed ordered and search retained that ordering. The three fixtures were cancelled directly in the separate staging database after testing without queuing notifications. No real customer reservation was changed and no real message was sent.

After promotion, the canonical production admin page authenticated successfully, displayed Today and one reservation timeline, and contained no Arrivals or Later today section. Production availability continued returning America/Los_Angeles settings and valid slots; anonymous staff access remained rejected. No environment, database-rule, index or provider changes were required. The prior protected production deployment `dpl_H3CFaZE8M6FQLXEejJX3jAkkZiiK` remains the compatible application fallback.
