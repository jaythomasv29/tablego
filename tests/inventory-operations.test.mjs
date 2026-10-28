import test from "node:test";
import assert from "node:assert/strict";
import {
  budgetOperationsBoard,
  budgetHistoryRecords,
  serializedBytes,
  reconcileInvoice,
  catalogGoods,
  supplierInput,
  goodInput,
  offerInput,
  orderInput,
  receiveInput,
  countInput,
  invoiceInput,
  identifier,
  amount,
} from "../src/lib/inventory/operations.ts";
const goods = catalogGoods(),
  supplier = supplierInput({ name: "Vendor" }, "vendor"),
  offer = offerInput(
    {
      itemId: "basil",
      supplierId: "vendor",
      supplierItemName: "Thai basil 5LB",
      sku: "B01",
      packSize: 5,
      packUnit: "lb",
      orderUnit: "case",
    },
    "offer",
    goods,
    [supplier],
  );
const at = "2026-10-28T20:00:00Z",
  previous = {
    version: 1,
    quantity: 4,
    unit: "lb",
    countedAt: "2026-10-27T20:00:00Z",
    checkedAt: "2026-10-27T20:00:00Z",
    checkedOn: "2026-10-27",
    checkedBy: "Team",
    decision: "sufficient",
    nextCheck: "2026-10-28",
    orderOpen: false,
    orderRequestedAt: null,
  };
const order = () =>
  orderInput(
    { supplierId: "vendor", lines: [{ offerId: "offer", quantity: 2 }] },
    "order",
    goods,
    [supplier],
    [offer],
    at,
    "Team",
  );
test("supplier mapping snapshots exact supplier name, code and conversion on order", () => {
  const o = order();
  offer.supplierItemName = "New label";
  assert.equal(o.lines[0].supplierItemName, "Thai basil 5LB");
  offer.supplierItemName = "Thai basil 5LB";
  assert.equal(o.lines[0].packSize, 5);
  assert.equal(o.status, "ordered");
});
test("partial receiving adds usable stock and retains physical count time", () => {
  const result = receiveInput(
    { lines: [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 0.2 }] },
    "receipt",
    order(),
    { basil: previous },
    at,
    "Manager",
  );
  assert.equal(result.stock.basil.quantity, 8);
  assert.equal(result.stock.basil.countedAt, previous.countedAt);
  assert.equal(result.stock.basil.version, 2);
  assert.equal(result.order.status, "partial");
  assert.equal(previous.quantity, 4);
  const complete = receiveInput(
    { lines: [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 0 }] },
    "receipt2",
    result.order,
    result.stock,
    at,
    "Team",
  );
  assert.equal(complete.order.status, "received");
  assert.equal(complete.stock.basil.quantity, 13);
});
test("receipt never invents a stock count or converts unspecified unit", () => {
  for (const stock of [
    {},
    { basil: { ...previous, quantity: null } },
    { basil: { ...previous, unit: "case" } },
  ]) {
    const result = receiveInput(
      { lines: [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 0 }] },
      "receipt",
      order(),
      stock,
      at,
      "Team",
    );
    assert.deepEqual(result.stock, stock);
    assert.match(result.receipt.lines[0].stockNote, /count needed/);
  }
});
test("receiving rejects overdelivery, duplicate lines, zero deliveries and invalid damage", () => {
  for (const lines of [
    [{ itemId: "basil", receivedQuantity: 3, damagedQuantity: 0 }],
    [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 2 }],
    [{ itemId: "basil", receivedQuantity: 0, damagedQuantity: 0 }],
    [
      { itemId: "basil", receivedQuantity: 1 },
      { itemId: "basil", receivedQuantity: 1 },
    ],
  ])
    assert.throws(() => receiveInput({ lines }, "r", order(), {}, at, "Team"));
});
test("counts use optimistic locking and preserve open request", () => {
  assert.throws(
    () =>
      countInput(
        { quantity: 1, unit: "lb", version: 0 },
        previous,
        "2026-10-28",
        at,
        "Team",
      ),
    /another device/,
  );
  const counted = countInput(
    { quantity: 1.5, unit: "lb", version: 1 },
    { ...previous, orderOpen: true },
    "2026-10-28",
    at,
    "Team",
  );
  assert.equal(counted.quantity, 1.5);
  assert.equal(counted.countedAt, at);
  assert.equal(counted.orderOpen, true);
});
test("invoices retain unmatched lines and require explicit review and supplier order consistency", () => {
  const input = {
    version: 0,
    supplierId: "vendor",
    number: "INV1",
    date: "2026-10-28",
    total: 24.19,
    status: "reviewed",
    lines: [
      {
        description: "Unknown supplier product",
        quantity: 1,
        unit: "case",
        unitPrice: 24.19,
        lineTotal: 24.19,
      },
    ],
  };
  const invoice = invoiceInput(
    input,
    "inv",
    undefined,
    [supplier],
    goods,
    [],
    at,
  );
  assert.equal(invoice.lines[0].itemId, undefined);
  assert.equal(invoice.total, 24.19);
  assert.throws(
    () =>
      invoiceInput(
        { ...input, orderId: "missing" },
        "inv",
        undefined,
        [supplier],
        goods,
        [],
        at,
      ),
    /supplier/,
  );
  assert.throws(
    () =>
      invoiceInput(
        { ...input, version: 2 },
        "inv",
        undefined,
        [supplier],
        goods,
        [],
        at,
      ),
    /another device/,
  );
});
test("validation rejects unsafe IDs and fractional precision, supports custom goods", () => {
  for (const id of ["__proto__", "a/b", "constructor", ""])
    assert.throws(() => identifier(id));
  for (const n of ["2", NaN, Infinity, -1, 0.001])
    assert.throws(() => amount(n));
  assert.equal(
    goodInput({ name: "New item", category: "Dry", baseUnit: "tub" }, "new")
      .baseUnit,
    "tub",
  );
});

test("multiple receipts retain original physical-count snapshot", () => {
  const first = receiveInput(
    { lines: [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 0 }] },
    "first",
    order(),
    { basil: previous },
    at,
    "Team",
  );
  const second = receiveInput(
    { lines: [{ itemId: "basil", receivedQuantity: 1, damagedQuantity: 0 }] },
    "second",
    first.order,
    first.stock,
    at,
    "Team",
  );
  assert.equal(second.stock.basil.quantity, 14);
  assert.equal(second.stock.basil.lastCountQuantity, 4);
  assert.equal(second.stock.basil.lastCountUnit, "lb");
  assert.equal(second.stock.basil.stockSource, "receipt");
});

test("invoice reconciliation aggregates split lines and flags missing or damaged goods", () => {
  const o = order();
  o.lines[0].receivedQuantity = 2;
  const invoice = {
    lines: [
      {
        itemId: "basil",
        description: "Basil",
        quantity: 1,
        unit: "case",
        unitPrice: 10,
        lineTotal: 10,
      },
      {
        itemId: "basil",
        description: "Basil",
        quantity: 1,
        unit: "case",
        unitPrice: 10,
        lineTotal: 10,
      },
    ],
    total: 20,
  };
  assert.deepEqual(reconcileInvoice(invoice, o), []);
  assert.match(
    reconcileInvoice({ ...invoice, lines: [] }, o).join(" "),
    /missing/,
  );
  assert.match(
    reconcileInvoice(invoice, o, [
      { orderId: o.id, lines: [{ itemId: "basil", damagedQuantity: 1 }] },
    ]).join(" "),
    /credit/,
  );
  assert.match(
    reconcileInvoice({ ...invoice, total: 22.21 }, o).join(" "),
    /taxes/,
  );
});

test("response budgets retain stock/catalog, prioritize active orders, preserve stored sources and paginate bounded history", () => {
  const huge = "x".repeat(2000),
    base = {
      goods: [],
      suppliers: [],
      offers: [],
      stock: { basil: previous },
      today: "2026-10-28",
      timezone: "America/Los_Angeles",
      customUnits: [],
      events: [
        {
          id: "event",
          action: "saveInvoice",
          at,
          actor: "session",
          by: "Team",
          targetId: "i",
          after: { rawText: huge },
        },
      ],
      orders: [
        { ...order(), id: "active" },
        { ...order(), id: "closed", status: "received" },
      ],
      invoices: [
        { id: "newest", rawText: huge },
        { id: "oldest", rawText: huge },
      ],
      receipts: [],
    };
  const result = budgetOperationsBoard(base, 2500);
  assert.ok(serializedBytes(result) < 2500);
  assert.equal(result.orders[0].id, "active");
  assert.equal(result.historyHasMore, true);
  assert.equal(result.stock.basil.quantity, 4);
  assert.equal(base.invoices.length, 2);
  assert.equal(base.events[0].after.rawText, huge);
  const page = budgetHistoryRecords(
    [
      { id: "one", data: huge },
      { id: "two", data: huge },
    ],
    false,
    2500,
  );
  assert.equal(page.records.length, 1);
  assert.equal(page.nextCursor, "one");
});

test('receipt units match case-insensitively without inventing conversions', () => {
  const result = receiveInput({ lines: [{ itemId: 'basil', receivedQuantity: 1, damagedQuantity: 0 }] }, 'case-match', order(), { basil: { ...previous, unit: 'LB' } }, at, 'Team');
  assert.equal(result.stock.basil.quantity, 9);
  assert.equal(result.stock.basil.unit, 'LB');
});
