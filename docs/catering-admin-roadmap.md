# Catering admin improvements and future features

Updated October 12, 2026. Current work is on refinement/catering-admin-workflow for tablego-milb. Future items below are a backlog, not implemented features or activated services.

## Immediate improvements

The old page provided a one-time list, missing budgets/locations/event types, placeholder times, silently failed loads and a single irreversible-looking Mark Complete action. The new inbox prioritizes upcoming active inquiries, with compact stage counts, search by contact/event/menu, due-follow-up filtering, automatic refresh while visible and explicit loading/error/retry states.

Review inquiry opens a mobile-friendly staff workspace with the full event details, menu and requests, verified contact links, a draft-email action, private notes, an optional next-follow-up calendar date and recent history. Stages are New inquiry, In conversation, Confirmed event, Completed and Not proceeding. Closed records can be reopened. Closing clears the follow-up date. Staff changes do not send emails or collect payment; Confirmed event is staff tracking after agreement with the guest.

Updates use authenticated server APIs, a transaction, version checks and a check of the previously loaded stage. A stale draft is retained for review instead of overwriting a colleague's changes. Closing a dirty editor offers Keep editing or Discard and close. Original guest input remains separate from staff notes.

The new cateringStaff collection stores workflowStage, private notes, follow-up dates and versions separately. Clients cannot read/write it under the existing live rules (unmatched paths deny access); staff use the authenticated server APIs. Legacy pending/completed status stays on the original inquiry for old-app compatibility. Older records remain readable without migration, including string dish names, guests/message fields, missing timestamps and invalid details needing review. Business-local event dates and follow-up dates never use the viewer's timezone. Existing live rules still expose legacy inquiry/contact records; protecting the new notes does not resolve that separate coordinated migration. The proposed restrictive rules also exclude cateringStaff client access; no live rules deployment is required for this patch.

## Future feature additions, in suggested order

| Priority | Feature | Benefit and scope |
| --- | --- | --- |
| Next | Quote builder | Turn selected dishes into quantities, package choices, item prices, delivery/setup fees and a branded quote. Keep the customer's stated budget separate from the quoted price; preview before sending. |
| Next | Branded catering email templates and conversation history | Send a tailored first response, questions, quotes and agreed-event summaries from TableGo. Record actual delivery/replies and keep one conversation per inquiry. Current Draft email opens the staff member's mail app and does not log a send. |
| Next | Guest review and acceptance page | Give the guest a secure link to review the proposal, choose options and accept the agreed details. Record the accepted version and business-approved terms; handle changes without silently replacing an agreement. |
| Next | Staff owner and follow-up reminders | Assign an inquiry to a person, show the next task, and offer optional staff reminders. Keep the default workflow light; the current date is an inbox reminder, not an automatic notification. |
| Later | Catering event calendar and capacity planning | Show confirmed events alongside restaurant service. Add explicit kitchen/staff/delivery limits and flag conflicts before promising availability. |
| Later | Deposits, invoices and balance tracking | Add an approved payment provider, clear deposit/balance states, receipts and cancellation/refund policies. Do not equate marking Confirmed with payment received. |
| Later | Event-day run sheet | Produce a printable/mobile brief for menu quantities, allergens, preparation, packing, staff, pickup/delivery times and contact details. Add kitchen handoff checklists. |
| Later | Pickup/delivery and venue details | Collect service type, event start/setup times, address, access instructions and equipment needs. Retain restaurant-local time display and label another venue timezone explicitly where needed. |
| Later | Repeat catering customer profiles | Group prior events carefully, save explicitly shared preferences and offer rebooking from an earlier event. Make marketing consent separate from operational contact and OTP. |
| Later | Outcome and quote reporting | Track quoted/agreed values, response time, conversion, reasons for not proceeding and repeat events. Use actual recorded amounts rather than treating inquiry budgets as revenue. |
| As volume grows | Pagination, server search and archive controls | Replace loading the whole collection with paginated queries; preserve old active inquiries and unknown dates. Add a reviewable archive process, without automatically closing historical live inquiries. |
| As the rollout expands | Fine-grained catering roles and coordinated database rules | Separate inquiry review, pricing and payment permissions. Migrate old clients before tightening shared live rules; record access and changes consistently. |

## Acceptance checks for the immediate release

- Authenticated list/details/update APIs; unauthenticated and cross-origin writes rejected.
- Current and incomplete legacy records load without crashes; full guest fields remain unchanged after staff updates.
- Stage changes, closure/reopening, private notes, follow-up dates, history and no-op retries save correctly.
- Stale versions and older-client completions reject overwrites; errors retain the draft.
- Follow-ups and event dates remain correct at business midnight when viewed internationally.
- Desktop and 390 × 844 layouts, dialog scrolling, sticky save controls and unsaved-close recovery work.
- Only owned isolated staging fixtures are mutated during validation; no live customer messages sent.

Deployment evidence is recorded in [the live test report](tablego-milb-live-test.md).
