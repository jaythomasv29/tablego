# Inventory Check

The release adds the daily counting flow described below. The Work shift board has one **Inventory Check** task per BOH opening shift. **Open Inventory** opens `/admin/inventory/check` linked to that shift. Inventory is also available in the admin sidebar.

## Staff flow

1. Choose one of six sections: produce; meat and seafood; rice, noodles and frozen goods; sauces and pantry; drinks, eggs and dairy; packaging and supplies.
2. Optionally enter the quantity on hand and counting unit. The decimal keypad, direct entry, and +/− controls support quick iPad counts. No quantity is assumed for an unchecked item. Previous counts and their original count times remain visible; the new-count field starts blank each new restaurant day.
3. **Order** adds an internal order request without requiring a count. The order dialog offers an unchecked option to include a typed count. It does not buy stock or send supplier messages. **Recheck tomorrow** saves a sufficient-stock review with tomorrow as the next check date; a blank count preserves the previous count and count time. A sufficient check does not silently cancel an existing order request.
4. Review open requests under **Order list**. **Stock received · Close request** explicitly closes that request, optionally recording a new count. Repeated Order actions update the same open request rather than creating duplicate orders.
5. Once all 117 goods have a saved decision today, **Finish Inventory Check** saves the linked shift task. The optional crew dropdown defaults to BOH-Team. The task keeps the completion timestamp and uses the existing checkpoint email flow.

Check stock shows one section at a time; Needs check hides goods already checked today. Section progress and total progress count the full catalog even while search/filter controls narrow the view. Staff can leave and resume; quantities and decisions are server-persisted. Counts are shared across the restaurant day's shifts, so sufficient stock does not require an identical lunch/dinner recount. Each shift's Work task is still explicitly confirmed.

## Persistence and limits

Server-only `inventory/current` holds the latest per-good count, unit, decision, next check date, open order flag, saved team label, timestamp, and version. Its events subcollection keeps immutable before/after audits with the staff session ID. Concurrent updates to an item reject stale versions. Unknown goods, invalid units, negative/nonfinite/excess quantities, and more than two decimal places are rejected. Writes use the restaurant's current date and reject an expired page date. Historical Work links are read-only for inventory counting. The server independently checks all goods before allowing an Inventory Check task completion.

Supplier package references are descriptive, not automatic reorder thresholds. No automated purchasing, order quantity recommendations, supplier delivery integration, or stock consumption calculation is implemented. The first phase is daily counting, sufficient/recheck decisions, an internal order queue, and the Work checkpoint connection. Later phases can add supplier ownership, par levels, approvals, and purchase orders based on reviewed operational needs.

The old staging-only goods tasks were consolidated into the single shift task, with their prior contents preserved in private audit events. No production data or credentials were changed.

Existing supplier, location, item management, and supplier order history tools remain at `/admin/inventory`, linked from the new screen. They use the existing inventoryItems/inventoryOrders collections. The new daily count catalog and its internal requests are separate in this phase; no automatic reconciliation with those legacy records is claimed or performed.

## iPhone preparation — October 26, 2026

Mobile layouts use a compact section selector, 48px controls, decimal quantity inputs, and no horizontal scrolling at the checked 390px width. Needs check is the default view. Search spans the whole goods catalog; switching views clears the search so order requests are not accidentally hidden. The default counting unit is inferred only from explicit package descriptions and remains editable.

Order opens a quantity-to-buy dialog, separate from the amount on hand. Positive buy quantities and ordering units are validated server-side. The full open list can be copied or shared through the device's native share sheet; sharing does not place an order. Previous requests without buy quantities are shown as needing an order amount.

Unfinished counts are saved on the current device under the restaurant date and survive refresh and section changes. They remain marked Not saved until Order or Recheck tomorrow succeeds on the server. Offline counting is allowed, but decisions are never silently sent later; reconnect and explicitly save them. Browser storage failure displays a warning. Refresh preserves drafts, and outstanding drafts block finishing the shift task. Force Refresh in the admin shell clears browser storage, so ordinary Refresh should be used to reload inventory.

Checks: 263 automated tests, lint, typecheck, production-configuration optimized build; local browser count/draft restoration/order dialog/order queue/copy-list checks. Browser checks exercised phone-sized Chrome; physical iPhone Safari testing is the owner's first operational trial.

## Inventory cues — October 27, 2026

Counting and ordering both support **can**. Each tile explicitly shows its server-saved **Updated** timestamp in the restaurant timezone; unchecked items say Not checked yet. Saved zero quantities show red Out of stock; open order requests show amber Order flagged; older checks show amber Recheck due; sufficient checks recorded today show green Reviewed today. These cues do not infer reorder thresholds from supplier package references. Text labels and a legend accompany the colors.

The on-hand value briefly animates when edited, without remounting or interrupting the input; reduced-motion preferences disable the animation. An idle board refreshes saved data every 30 seconds and on window focus. Refresh pauses while a save or an unfinished count is present, preserving local drafts. Verification includes can counting/ordering validation and stock-state priority tests, plus a staging can-count save and phone-width layout check.

## Custom units — October 27, 2026

Both unit menus offer **+ Custom unit…**. Staff can register a name such as tray, tub, or bundle and immediately select it. Custom units are persisted in the private inventory document and reused across goods, ordering/counting menus, and devices. Existing built-in units and duplicate custom names are matched without case sensitivity; whitespace is normalized. Names support international letters and simple punctuation, up to 24 characters, with up to 50 custom units.

Registering a unit is a separate authenticated, audited transaction that preserves all item records. Creating a unit inside the order dialog does not submit an order. Count and order submissions only accept built-in or registered units. Existing quantity drafts restore with registered custom units after refresh. No unit conversions or stock changes occur merely from adding a unit.

## Faster reviews — October 28, 2026

Ordering and counting are independent. Unknown counts stay null rather than becoming zero. A no-count review updates the review time while preserving the last actual count and its timestamp. Tomorrow, Needs check includes the item again and the new-count field is blank, with the earlier amount and count time visible above it. Entering a new count saves a new event; Recheck tomorrow without a count keeps the earlier amount. Unsaved typed counts are retained if an order is saved without including them.

Copy/Share list includes only item names and requested buy quantities/units, retaining package details only to distinguish repeated names. It excludes on-hand counts. Each item has a History dialog showing the latest 30 saved count/review/order events; older audit events remain stored. Existing counts require no migration. The authenticated history query uses an additive Firestore composite index.

Verification: 270 automated tests, lint, typecheck, and production-configuration optimized build, plus staging order-without-count and history checks.
