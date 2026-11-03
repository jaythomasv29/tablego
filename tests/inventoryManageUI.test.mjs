import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as progress from "../src/lib/inventory/progress.ts";
const filename = new URL(
    "../src/app/admin/inventory/manage/page.tsx",
    import.meta.url,
  ),
  normalRequire = createRequire(filename);
const board = {
  goods: [{ id: "basil", name: "Basil", category: "Produce", baseUnit: "lb" }],
  suppliers: [{ id: "supplier", name: "Supplier" }],
  offers: [],
  orders: [],
  receipts: [],
  invoices: [],
  events: [
    {
      id: "old",
      targetId: "basil",
      action: "count",
      at: "2026-10-27T12:00:00Z",
      by: "Team",
    },
  ],
  stock: {
    basil: {
      version: 2,
      quantity: 4,
      unit: "lb",
      countedAt: "2026-10-27T12:00:00Z",
    },
  },
  today: "2026-10-28",
  timezone: "America/Los_Angeles",
  customUnits: [],
};
async function mount(
  t,
  { failFirst = false, defer = false, history = false } = {},
) {
  const module = { exports: {} },
    calls = [];
  let finish;
  class Data {
    constructor(values) {
      this.values = values;
    }
    get(key) {
      return this.values[key] ?? null;
    }
    *[Symbol.iterator]() {
      yield* Object.entries(this.values);
    }
  }
  runInNewContext(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      Date,
      URL,
      FormData: Data,
      crypto: { randomUUID: () => `request-${calls.length}` },
      setTimeout,
      clearTimeout,
      window: { addEventListener() {}, removeEventListener() {} },
      fetch: async (url, options = {}) => {
        calls.push({ url, ...options });
        if (
          options.method === "POST" &&
          failFirst &&
          calls.filter((c) => c.method === "POST").length === 1
        )
          throw new Error("response lost");
        if (options.method === "POST" && defer)
          await new Promise((resolve) => {
            finish = resolve;
          });
        return {
          ok: true,
          status: 200,
          json: async () => {
            if (history && url.includes("history=orders"))
              return {
                records: [],
                nextCursor: url.includes("cursor=") ? null : "page-cursor",
              };
            return structuredClone({
              ...board,
              ...(history
                ? { historyRestart: true, historyHasMore: true }
                : {}),
            });
          },
        };
      },
      require: (name) => {
        if (name === "@/components/AdminLayout" || name === "next/link")
          return {
            __esModule: true,
            default: ({ children, ...props }) =>
              React.createElement("div", props, children),
          };
        if (name === "@/components/ui/dialog")
          return {
            Dialog: ({ open, children, ...props }) =>
              open ? React.createElement("dialog", props, children) : null,
            DialogContent: (p) => React.createElement("div", p),
            DialogTitle: (p) => React.createElement("h2", p),
            DialogDescription: (p) => React.createElement("p", p),
          };
        if (name === '@/components/inventory/InlineStockCheck') return { __esModule: true, default: props => React.createElement('inline-check', props) };
        if (name === '@/components/inventory/InventoryOrderList') return { __esModule: true, default: props => React.createElement('order-list', props, props.hasOlder && React.createElement('button', { onClick: props.onLoadOlder }, 'Load older orders')) };
        if (name === '@/lib/inventory/progress') return progress;
        if (name === "@/components/inventory/InventoryDailyStock") return { __esModule: true, default: () => React.createElement("button", {}, "Daily stock") };
        if (name === "@/components/inventory/InventoryTextLog") return { __esModule: true, default: () => null };
        if (name === "@/lib/inventory/invoiceCatalog") return { invoiceCatalogSuggestions: lines => lines.map((_, lineIndex) => ({ lineIndex, ambiguous: false })) };
        if (name === "@/components/inventory/InvoiceCapture")
          return {
            __esModule: true,
            default: (props) => React.createElement("capture", props),
          };
        if (name === "@/lib/inventory/operations")
          return { reconcileInvoice: () => [] };
        if (name === "@/lib/reservations/availability")
          return { restaurantClock: () => ({ date: "2026-10-28" }) };
        if (name === "@/lib/inventory/model")
          return { inventoryCountedAt: s => s?.countedAt, inventoryChecked: (s, day) => s?.checkedOn === day, inventoryUnitOptions: units => ['each','lb',...units] };
        if (name.endsWith(".module.css"))
          return { __esModule: true, default: {} };
        return normalRequire(name);
      },
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(module.exports.default));
  });
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls, finish: () => finish?.() };
}
const button = (r, text) =>
  r.root.findAllByType("button").find((b) => b.children.join("") === text);
const submit = (r) =>
  r.root.findByType("form").props.onSubmit({
    preventDefault() {},
    currentTarget: { name: 'Fresh rice', category: 'Pantry', baseUnit: 'bag' },
  });
test("uncertain item creation retry preserves its original payload and request ID", async (t) => {
  const { renderer: r, calls } = await mount(t, { failFirst: true });
  await act(async () => button(r, "Add item").props.onClick());
  await act(async () => submit(r));
  assert.ok(button(r, "Retry original save"));
  await act(async () => button(r, "Retry original save").props.onClick());
  const posts = calls.filter((c) => c.method === "POST");
  assert.equal(posts.length, 2);
  assert.equal(posts[0].body, posts[1].body);
  const saved = JSON.parse(posts[0].body);
  assert.equal(saved.action, 'saveGood');
  assert.equal(saved.good.name, 'Fresh rice');
  assert.equal(saved.good.baseUnit, 'bag');
});
test("immediate repeated submit is locked while save is pending", async (t) => {
  const { renderer: r, calls, finish } = await mount(t, { defer: true });
  await act(async () => button(r, "Add item").props.onClick());
  await act(async () => {
    submit(r);
    submit(r);
  });
  assert.equal(calls.filter((c) => c.method === "POST").length, 1);
  await act(async () => finish());
});
test("catalog modal keeps entries until explicit discard and item name is required", async (t) => {
  const { renderer: r, calls } = await mount(t);
  await act(async () => button(r, "Add item").props.onClick());
  const name = r.root.findAllByType('input').find(i => i.props.name === 'name');
  assert.equal(name.props.required, true);
  await act(async () => button(r, "Cancel").props.onClick());
  assert.equal(r.root.findAllByType("form").length, 1);
  await act(async () => button(r, "Keep editing").props.onClick());
  assert.equal(r.root.findAllByType("form").length, 1);
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});
test("pending capture blocks invoice save and captured details require review without stock writes", async (t) => {
  const { renderer: r, calls } = await mount(t);
  await act(async () => button(r, "Invoices").props.onClick());
  await act(async () => button(r, "Upload or add invoice").props.onClick());
  let capture = r.root.findByType("capture");
  await act(async () => capture.props.onPendingChange(true));
  assert.equal(button(r, "Save").props.disabled, true);
  await act(async () => {
    capture.props.onCapture({
      attachmentId: "private-id",
      rawText: "Basil",
      header: { number: "INV-10", date: "2026-10-27", total: 12 },
      lines: [
        {
          description: "Basil",
          quantity: 2,
          unit: "lb",
          unitPrice: 6,
          lineTotal: 12,
        },
      ],
    });
    capture.props.onPendingChange(false);
  });
  assert.ok(JSON.stringify(r.toJSON()).includes("INV-10"));
  assert.ok(r.root.findAllByType("input").some((i) => i.props.value === 6));
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});
test("item history tolerates older events without an after snapshot", async (t) => {
  const { renderer: r } = await mount(t);
  await act(async () => button(r, "History & sources").props.onClick());
  assert.ok(JSON.stringify(r.toJSON()).includes("Recent activity"));
});

test("trimmed history restarts at first page and uses server cursors on subsequent loads", async (t) => {
  const { renderer: r, calls } = await mount(t, { history: true });
  await act(async () => button(r, "Orders").props.onClick());
  await act(async () => button(r, "Load older orders").props.onClick());
  await act(async () => button(r, "Load older orders").props.onClick());
  const pages = calls.filter((c) => c.url.includes("history=orders"));
  assert.equal(pages.length, 2);
  assert.equal(pages[0].url, "/api/staff/inventory/operations?history=orders");
  assert.equal(
    pages[1].url,
    "/api/staff/inventory/operations?history=orders&cursor=page-cursor",
  );
  assert.equal(button(r, "Load older orders"), undefined);
});
