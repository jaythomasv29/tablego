import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  inventoryCountedAt,
  validateInventoryUnit,
} from "../src/lib/inventory/model.ts";
const filename = new URL(
    "../src/components/inventory/InlineStockCheck.tsx",
    import.meta.url,
  ),
  normalRequire = createRequire(filename);
const good = {
  id: "basil",
  name: "Basil",
  category: "Produce",
  baseUnit: "lb",
};
const item = {
  version: 2,
  quantity: 4,
  unit: "lb",
  countedAt: "2026-10-31T18:00:00Z",
  checkedAt: "2026-10-31T18:00:00Z",
  checkedOn: "2026-10-31",
  orderOpen: false,
};
async function mount(
  t,
  {
    record = item,
    storage = new Map(),
    failFirst = false,
    conflict = false,
    defer = false,
  } = {},
) {
  const module = { exports: {} },
    calls = [],
    saved = [],
    drafts = [];
  let sequence = 0,
    finish;
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
      crypto: { randomUUID: () => `id-${++sequence}` },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
      },
      fetch: async (url, options = {}) => {
        calls.push({ url, ...options });
        const posts = calls.filter((c) => c.method === "POST");
        if (options.method === "POST" && failFirst && posts.length === 1)
          throw new Error("lost response");
        if (options.method === "POST" && defer)
          await new Promise((resolve) => (finish = resolve));
        if (options.method === "POST" && conflict)
          return {
            ok: false,
            status: 409,
            json: async () => ({
              error: "This item changed on another device.",
            }),
          };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            stock: {
              basil: {
                ...record,
                version: 3,
                updatedAt: "2026-11-01T18:00:00Z",
              },
            },
          }),
        };
      },
      require: (name) => {
        if (name === "@/lib/inventory/model")
          return { inventoryCountedAt, validateInventoryUnit };
        if (name.endsWith(".module.css"))
          return { __esModule: true, default: {} };
        return normalRequire(name);
      },
    },
  );
  let renderer;
  await act(
    async () =>
      (renderer = create(
        React.createElement(module.exports.default, {
          good,
          item: record,
          units: ["lb", "case", "bunch"],
          date: "2026-11-01",
          timezone: "America/Los_Angeles",
          onSaved: (value) => saved.push(value),
          onDraftChange: (id, dirty) => drafts.push({ id, dirty }),
        }),
      )),
  );
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls, saved, drafts, storage, finish: () => finish?.() };
}
const button = (r, label) =>
  r.root.findAllByType("button").find((b) => b.children.join("") === label);
const input = (r, label) =>
  r.root.findAllByType("input").find((i) => i.props["aria-label"] === label);
const fill = (r, label, value) =>
  act(async () => input(r, label).props.onChange({ target: { value } }));
test("inline count is blank initially and saves only an explicit count with version and date", async (t) => {
  const { renderer: r, calls, saved } = await mount(t);
  assert.equal(input(r, "On hand for Basil").props.value, "");
  assert.equal(button(r, "Save count").props.disabled, true);
  await fill(r, "On hand for Basil", "5");
  await act(async () => button(r, "Save count").props.onClick());
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.quantity, 5);
  assert.equal(payload.version, 2);
  assert.equal(payload.date, "2026-11-01");
  assert.equal(payload.decision, "count");
  assert.equal(saved.length, 1);
  assert.equal(input(r, "On hand for Basil").props.value, "");
});
test("ordering without an on-hand count preserves unsaved counts unless explicitly included", async (t) => {
  const { renderer: r, calls, drafts } = await mount(t);
  await fill(r, "On hand for Basil", "7");
  await act(async () => button(r, "Order").props.onClick());
  await fill(r, "Quantity to buy for Basil", "2");
  await fill(r, "Ordering unit for Basil", "case");
  await act(async () => button(r, "Save order request").props.onClick());
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.decision, "order");
  assert.equal(payload.orderQuantity, 2);
  assert.equal(payload.orderUnit, "case");
  assert.equal("quantity" in payload, false);
  assert.equal(input(r, "On hand for Basil").props.value, "7");
  assert.equal(drafts.at(-1).dirty, true);
});
test("recheck without a count does not synthesize zero; typed zero is an explicit count", async (t) => {
  const { renderer: r, calls } = await mount(t);
  await act(async () => button(r, "Recheck tomorrow").props.onClick());
  assert.equal("quantity" in JSON.parse(calls[0].body), false);
  await fill(r, "On hand for Basil", "0");
  await act(async () => button(r, "Recheck tomorrow").props.onClick());
  assert.equal(JSON.parse(calls[1].body).quantity, 0);
});
test("cancel order requires confirmation and never sends a typed on-hand draft", async (t) => {
  const { renderer: r, calls } = await mount(t, {
    record: { ...item, orderOpen: true, orderQuantity: 2, orderUnit: "case" },
  });
  await fill(r, "On hand for Basil", "8");
  await act(async () => button(r, "Cancel request").props.onClick());
  assert.equal(calls.length, 0);
  await act(async () => button(r, "Confirm cancellation").props.onClick());
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.decision, "cancelOrder");
  assert.equal("quantity" in payload, false);
  assert.equal(input(r, "On hand for Basil").props.value, "8");
});
test("uncertain save retries original payload and pending request survives remount", async (t) => {
  const storage = new Map();
  const first = await mount(t, { storage, failFirst: true });
  await fill(first.renderer, "On hand for Basil", "5");
  await act(async () => button(first.renderer, "Save count").props.onClick());
  assert.ok(storage.has("tablego-inline-stock:2026-11-01:basil:pending"));
  const second = await mount(t, { storage });
  await act(async () =>
    button(second.renderer, "Retry original save").props.onClick(),
  );
  assert.equal(first.calls[0].body, second.calls[0].body);
  assert.equal(
    storage.has("tablego-inline-stock:2026-11-01:basil:pending"),
    false,
  );
});
test("conflict offers refresh while retaining the count draft", async (t) => {
  const { renderer: r, calls, saved } = await mount(t, { conflict: true });
  await fill(r, "On hand for Basil", "6");
  await act(async () => button(r, "Save count").props.onClick());
  assert.ok(button(r, "Load latest stock · Keep draft"));
  await act(async () =>
    button(r, "Load latest stock · Keep draft").props.onClick(),
  );
  assert.equal(calls[1].method, undefined);
  assert.equal(saved.length, 1);
  assert.equal(input(r, "On hand for Basil").props.value, "6");
});
test("synchronous double taps are locked before the save finishes", async (t) => {
  const { renderer: r, calls, finish } = await mount(t, { defer: true });
  await fill(r, "On hand for Basil", "5");
  await act(async () => {
    button(r, "Save count").props.onClick();
    button(r, "Save count").props.onClick();
  });
  assert.equal(calls.length, 1);
  await act(async () => finish());
});

test("including an on-hand count in an order is explicit and clears only the count that was saved", async (t) => {
  const { renderer: r, calls, drafts } = await mount(t);
  await fill(r, "On hand for Basil", "3.5");
  await act(async () => button(r, "Order").props.onClick());
  await fill(r, "Quantity to buy for Basil", "2");
  const checkbox = r.root
    .findAllByType("input")
    .find((i) => i.props.type === "checkbox");
  assert.equal(checkbox.props.checked, false);
  await act(async () => checkbox.props.onChange({ target: { checked: true } }));
  await act(async () => button(r, "Save order request").props.onClick());
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.quantity, 3.5);
  assert.equal(payload.unit, "lb");
  assert.equal(input(r, "On hand for Basil").props.value, "");
  assert.equal(drafts.at(-1).dirty, false);
});
test("unsaved count and order fields restore when a filtered tile mounts again", async (t) => {
  const storage = new Map();
  const first = await mount(t, { storage });
  await fill(first.renderer, "On hand for Basil", "3");
  await act(async () => button(first.renderer, "Order").props.onClick());
  await fill(first.renderer, "Quantity to buy for Basil", "2");
  await fill(first.renderer, "Ordering unit for Basil", "case");
  const second = await mount(t, { storage });
  assert.equal(input(second.renderer, "On hand for Basil").props.value, "3");
  assert.equal(
    input(second.renderer, "Quantity to buy for Basil").props.value,
    "2",
  );
  assert.equal(
    input(second.renderer, "Ordering unit for Basil").props.value,
    "case",
  );
  assert.equal(second.drafts.at(-1).dirty, true);
});
