import { randomUUID } from "node:crypto";
import { getServerDatabase } from "../serverFirebase";
import { getInventory } from "./repository";
import { businessTimezone } from "../reservations/policy";
import { restaurantClock } from "../reservations/availability";
import { ReservationError } from "../reservations/http";
import {
  activitySummary,
  budgetOperationsBoard,
  budgetHistoryRecords,
  catalogGoods,
  object,
  identifier,
  textValue,
  supplierInput,
  goodInput,
  offerInput,
  orderInput,
  receiveInput,
  invoiceInput,
  countInput,
  type CatalogGood,
  type Supplier,
  type SupplierOffer,
  type PurchaseOrder,
  type Invoice,
  type Receipt,
  type Activity,
  type OperationsBoard,
} from "./operations";
import { registerInventoryUnit, type InventoryRecords } from "./model";
const kinds = [
  "goods",
  "suppliers",
  "offers",
  "orders",
  "invoices",
  "receipts",
  "events",
] as const;
const path = (kind: string) => `inventoryOperations/${kind}/records`;
export async function getOperations(): Promise<OperationsBoard> {
  const db = getServerDatabase();
  const [inventory, legacy, activeOrders, ...results] = await Promise.all([
    getInventory(),
    db.collection("inventoryVendors").limit(300).get(),
    db
      .collection(path("orders"))
      .where("status", "in", ["ordered", "partial"])
      .limit(1000)
      .get(),
    ...kinds.map((k) => {
      const collection = db.collection(path(k));
      if (k === "events")
        return collection.orderBy("at", "desc").limit(201).get();
      if (k === "orders")
        return collection.orderBy("orderedAt", "desc").limit(1000).get();
      if (k === "invoices")
        return collection.orderBy("date", "desc").limit(1000).get();
      if (k === "receipts")
        return collection.orderBy("at", "desc").limit(1000).get();
      return collection.limit(1000).get();
    }),
  ]);
  if (
    results.some(
      (r, i) =>
        ["goods", "suppliers", "offers"].includes(kinds[i]) && r.size >= 1000,
    ) ||
    legacy.size >= 300
  )
    throw new ReservationError(
      "Inventory record limit reached. Contact a manager to archive or export history before continuing.",
      409,
    );
  const records = Object.fromEntries(
    kinds.map((k, i) => [
      k,
      results[i].docs.map((d) => ({ ...d.data(), id: d.id })),
    ]),
  );
  const orderMap = new Map(
    (records.orders as PurchaseOrder[]).map((o) => [o.id, o]),
  );
  for (const doc of activeOrders.docs)
    orderMap.set(doc.id, { ...doc.data(), id: doc.id } as PurchaseOrder);
  records.orders = Array.from(orderMap.values());
  const goods = new Map(catalogGoods().map((g) => [g.id, g]));
  for (const g of records.goods as CatalogGood[]) goods.set(g.id, g);
  const suppliers = new Map<string, Supplier>(
    legacy.docs.map((d) => [
      d.id,
      {
        id: d.id,
        name: String(d.data().name || "Supplier"),
        phone: String(d.data().phone || ""),
      },
    ]),
  );
  for (const s of records.suppliers as Supplier[]) suppliers.set(s.id, s);
  return budgetOperationsBoard({
    activeOrdersTruncated: activeOrders.size >= 1000,
    activityHasMore: results[kinds.indexOf("events")].size > 200,
    historyHasMore: results.some(
      (r, i) =>
        ["orders", "invoices", "receipts"].includes(kinds[i]) && r.size >= 1000,
    ),
    goods: Array.from(goods.values()),
    suppliers: Array.from(suppliers.values()),
    offers: records.offers as SupplierOffer[],
    orders: (records.orders as PurchaseOrder[]).sort((a, b) =>
      b.orderedAt.localeCompare(a.orderedAt),
    ),
    invoices: (records.invoices as Invoice[]).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    receipts: (records.receipts as Receipt[]).sort((a, b) =>
      b.at.localeCompare(a.at),
    ),
    events: (records.events as Activity[])
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 200),
    stock: inventory.items,
    today: inventory.today,
    timezone: inventory.timezone,
    customUnits: inventory.customUnits,
  });
}
export async function mutateOperations(raw: unknown, actor: string) {
  try {
    const v = object(raw),
      action = String(v.action),
      db = getServerDatabase(),
      at = new Date().toISOString(),
      by = textValue(v.performedBy ?? v.staffName, 100, false) || "Team";
    const allowed = [
      "saveSupplier",
      "saveGood",
      "saveOffer",
      "createOrder",
      "receive",
      "saveInvoice",
      "count",
    ];
    if (!allowed.includes(action))
      throw new Error("Choose an inventory action");
    const board = await getOperations();
    const requestId = ["createOrder", "receive", "count"].includes(action)
      ? identifier(v.requestId)
      : randomUUID();
    const generatedId: string = randomUUID();
    await db.runTransaction(async (tx) => {
      const dedupeRef = db.doc(
          `inventoryOperations/requests/records/${requestId}`,
        ),
        dedupe = await tx.get(dedupeRef);
      if (dedupe.exists) {
        const saved = dedupe.data()!;
        if (
          saved.actor !== actor ||
          saved.action !== action ||
          saved.payload !== JSON.stringify(v)
        )
          throw new Error(
            "Request identifier was already used. Refresh and retry.",
          );
        return;
      }
      let kind = "",
        id = generatedId,
        before: unknown = null,
        after: unknown = null;
      const stockRef = db.doc("inventory/current");
      if (action === "saveSupplier") {
        const input = object(v.supplier);
        id = input.id ? identifier(input.id) : id;
        kind = "suppliers";
        before = (await tx.get(db.doc(`${path(kind)}/${id}`))).data() || null;
        after = supplierInput(input, id);
      }
      if (action === "saveGood") {
        const input = object(v.good);
        id = input.id ? identifier(input.id) : id;
        kind = "goods";
        before = (await tx.get(db.doc(`${path(kind)}/${id}`))).data() || null;
        after = goodInput(input, id);
      }
      if (action === "saveOffer") {
        const input = object(v.offer);
        id = input.id ? identifier(input.id) : id;
        kind = "offers";
        before = (await tx.get(db.doc(`${path(kind)}/${id}`))).data() || null;
        after = offerInput(input, id, board.goods, board.suppliers);
      }
      if (action === "createOrder") {
        kind = "orders";
        after = orderInput(
          v,
          id,
          board.goods,
          board.suppliers,
          board.offers,
          at,
          by,
        );
      }
      if (action === "saveInvoice") {
        const input = object(v.invoice);
        id = input.id ? identifier(input.id) : id;
        kind = "invoices";
        const previous = (
          await tx.get(db.doc(`${path(kind)}/${id}`))
        ).data() as Invoice | undefined;
        before = previous || null;
        if (input.attachmentId) {
          const attachment = await tx.get(
            db.doc(
              `inventoryOperations/attachments/records/${identifier(input.attachmentId)}`,
            ),
          );
          if (!attachment.exists)
            throw new Error("Upload the invoice attachment first");
        }
        const invoiceOrders = [...board.orders];
        if (
          input.orderId &&
          !invoiceOrders.some((o) => o.id === input.orderId)
        ) {
          const linked = await tx.get(
            db.doc(`${path("orders")}/${identifier(input.orderId)}`),
          );
          if (linked.exists) invoiceOrders.push(linked.data() as PurchaseOrder);
        }
        after = invoiceInput(
          input,
          id,
          previous,
          board.suppliers,
          board.goods,
          invoiceOrders,
          at,
        );
      }
      if (action === "receive") {
        const orderId = identifier(v.orderId),
          [orderDoc, saved] = await Promise.all([
            tx.get(db.doc(`${path("orders")}/${orderId}`)),
            tx.get(stockRef),
          ]);
        if (!orderDoc.exists) throw new Error("Choose an existing order");
        const previous = orderDoc.data() as PurchaseOrder,
          stock = (saved.data()?.items || {}) as InventoryRecords,
          result = receiveInput(v, id, previous, stock, at, by);
        kind = "receipts";
        before = previous;
        after = result.receipt;
        tx.set(db.doc(`${path("orders")}/${orderId}`), result.order);
        tx.set(stockRef, { ...saved.data(), items: result.stock });
        for (const line of result.receipt.lines) {
          if (result.stock[line.itemId] !== stock[line.itemId])
            tx.create(db.doc(`inventory/current/events/${randomUUID()}`), {
              action: "receipt",
              itemId: line.itemId,
              before: stock[line.itemId] || null,
              after: result.stock[line.itemId],
              actor,
              by,
              at,
              receiptId: id,
            });
        }
      }
      if (action === "count") {
        id = identifier(v.itemId);
        if (!board.goods.some((g) => g.id === id))
          throw new Error("Choose a current inventory item");
        const [saved, general] = await Promise.all([
            tx.get(stockRef),
            tx.get(db.doc("settings/general")),
          ]),
          stock = (saved.data()?.items || {}) as InventoryRecords,
          today = restaurantClock(businessTimezone(general.data())).date;
        before = stock[id] || null;
        const registration = registerInventoryUnit(v.unit, (saved.data()?.customUnits || []) as string[]);
        after = countInput({ ...v, unit: registration.unit }, stock[id], today, at, by);
        const customUnits = registration.customUnits;
        tx.set(stockRef, {
          ...saved.data(),
          customUnits,
          items: { ...stock, [id]: after },
        });
        tx.create(db.doc(`inventory/current/events/${randomUUID()}`), {
          action: "count",
          itemId: id,
          before,
          after,
          actor,
          by,
          at,
        });
      }
      if (kind)
        tx.set(db.doc(`${path(kind)}/${id}`), after as Record<string, unknown>);
      tx.create(db.doc(`${path("events")}/${randomUUID()}`), {
        action,
        actor,
        by,
        at,
        targetId: id,
        before,
        after,
      });
      tx.create(dedupeRef, {
        action,
        actor,
        payload: JSON.stringify(v),
        at,
        targetId: id,
      });
    });
    return await getOperations();
  } catch (error) {
    if (error instanceof ReservationError) throw error;
    if ("code" in Object(error))
      throw new ReservationError(
        "Inventory is temporarily unavailable. Please retry.",
        503,
      );
    const message = (error as Error).message;
    throw new ReservationError(
      message,
      /another device|already used/.test(message) ? 409 : 400,
    );
  }
}

export async function getOperationsHistory(kind: string, cursor?: string) {
  if (!["orders", "invoices", "receipts", "events"].includes(kind))
    throw new ReservationError("Choose a valid history category");
  const db = getServerDatabase(),
    field =
      kind === "orders" ? "orderedAt" : kind === "invoices" ? "date" : "at";
  let query = db
    .collection(path(kind))
    .orderBy(field, "desc")
    .orderBy("__name__", "desc")
    .limit(101);
  if (cursor) {
    const snapshot = await db.doc(`${path(kind)}/${identifier(cursor)}`).get();
    if (!snapshot.exists)
      throw new ReservationError("History page no longer exists");
    query = query.startAfter(snapshot);
  }
  const saved = await query.get(),
    docs = saved.docs.slice(0, 100);
  const records = docs.map((d) => ({ ...d.data(), id: d.id }));
  return budgetHistoryRecords(
    kind === "events"
      ? records.map((r) => activitySummary(r as Activity))
      : records,
    saved.size > 100,
  );
}
