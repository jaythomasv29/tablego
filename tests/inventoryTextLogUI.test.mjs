import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { parseInventoryLog } from "../src/lib/inventory/dictation.ts";
import {
  validateInventoryUnit,
  inventoryCountedAt,
} from "../src/lib/inventory/model.ts";
const filename = new URL(
    "../src/components/inventory/InventoryTextLog.tsx",
    import.meta.url,
  ),
  normalRequire = createRequire(filename);
const board = {
  goods: [
    { id: "basil", name: "Basil", category: "Produce", baseUnit: "lb" },
    { id: "rice", name: "White rice", category: "Pantry", baseUnit: "bag" },
  ],
  offers: [],
  customUnits: [],
  stock: {
    basil: {
      quantity: 4,
      unit: "lb",
      version: 2,
      countedAt: "2026-10-27T12:00:00Z",
    },
  },
  today: "2026-10-28",
  timezone: "America/Los_Angeles",
};
async function mount(
  t,
  {
    failFirst = false,
    storage = new Map(),
    defer = false,
    snapshot = board,
  } = {},
) {
  const module = { exports: {} },
    calls = [],
    saved = [];
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
      window: { addEventListener() {}, removeEventListener() {} },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
      },
      fetch: async (url, options) => {
        calls.push({ url, ...options });
        if (failFirst && calls.length === 1) throw new Error("lost response");
        if (defer) await new Promise((resolve) => (finish = resolve));
        return { ok: true, status: 200, json: async () => board };
      },
      require: (name) => {
        if (name === "@/components/ui/dialog")
          return {
            Dialog: ({ open, children, ...props }) =>
              open ? React.createElement("dialog", props, children) : null,
            DialogContent: (p) => React.createElement("div", p),
            DialogTitle: (p) => React.createElement("h2", p),
            DialogDescription: (p) => React.createElement("p", p),
          };
        if (name === "@/lib/inventory/dictation") return { parseInventoryLog };
        if (name === "@/lib/inventory/model")
          return { validateInventoryUnit, inventoryCountedAt };
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
          board: snapshot,
          onSaved: (value) => saved.push(value),
        }),
      )),
  );
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls, saved, storage, finish: () => finish?.() };
}
const button = (r, label) =>
  r.root.findAllByType("button").find((b) => b.children.join("") === label);
async function enter(r, text) {
  await act(async () => button(r, "Speak or type stock log").props.onClick());
  await act(async () =>
    r.root.findByType("textarea").props.onChange({ target: { value: text } }),
  );
  await act(async () => button(r, "Review log").props.onClick());
}
const reviewCheck = (r) =>
  r.root
    .findAllByType("input")
    .filter((i) => i.props.type === "checkbox")
    .at(-1);
test("dictating and parsing never writes stock; explicit confirmation sends exact physical counts and versions", async (t) => {
  const { renderer: r, calls, saved, storage } = await mount(t);
  await enter(r, "Basil 5 lb. White rice 2 bags.");
  assert.equal(calls.length, 0);
  assert.equal(button(r, "Confirm 2 stock counts").props.disabled, true);
  assert.ok(JSON.stringify(r.toJSON()).includes("Change from last count:"));
  await act(async () =>
    reviewCheck(r).props.onChange({ target: { checked: true } }),
  );
  await act(async () => button(r, "Confirm 2 stock counts").props.onClick());
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].body);
  assert.equal(payload.action, "confirmTextLog");
  assert.equal(payload.date, "2026-10-28");
  assert.deepEqual(payload.lines, [
    { itemId: "basil", quantity: 5, unit: "lb", version: 2 },
    { itemId: "rice", quantity: 2, unit: "bag", version: 0 },
  ]);
  assert.equal(saved.length, 1);
  assert.equal(storage.has("tablego-stock-log:2026-10-28"), false);
});
test("unknown items and blank quantities stay visible and cannot become zero counts", async (t) => {
  const { renderer: r, calls } = await mount(t);
  await enter(r, "Mystery sauce 4 cans. Basil.");
  assert.equal(r.root.findAllByType("section").length, 2);
  assert.equal(button(r, "Confirm 2 stock counts").props.disabled, true);
  const quantities = r.root
    .findAllByType("input")
    .filter((i) => i.props.type === "number");
  assert.ok(quantities.some((i) => i.props.value === ""));
  assert.equal(calls.length, 0);
});
test("duplicate entries require correction and differing units need explicit acknowledgement", async (t) => {
  const { renderer: r } = await mount(t);
  await enter(r, "Basil 2 lb. Basil 3 cans.");
  assert.ok(JSON.stringify(r.toJSON()).includes("appears more than once"));
  await act(async () =>
    r.root
      .findAllByType("button")
      .find((b) => b.children.join("") === "Remove")
      .props.onClick(),
  );
  assert.equal(reviewCheck(r).props.disabled, true);
  const unitCheck = r.root
    .findAllByType("input")
    .filter((i) => i.props.type === "checkbox")[0];
  await act(async () =>
    unitCheck.props.onChange({ target: { checked: true } }),
  );
  assert.equal(reviewCheck(r).props.disabled, false);
});
test("interrupted saves preserve their payload and ID across close/reopen; successful retry clears pending draft", async (t) => {
  const { renderer: r, calls, storage } = await mount(t, { failFirst: true });
  await enter(r, "Basil 5 lb.");
  await act(async () =>
    reviewCheck(r).props.onChange({ target: { checked: true } }),
  );
  await act(async () => button(r, "Confirm 1 stock counts").props.onClick());
  assert.ok(storage.has("tablego-stock-log:2026-10-28:pending"));
  await act(async () => button(r, "Keep draft & close").props.onClick());
  await act(async () => button(r, "Speak or type stock log").props.onClick());
  await act(async () => button(r, "Retry original log").props.onClick());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(storage.size, 0);
});
test("draft text survives closing without saving or sending any counts", async (t) => {
  const { renderer: r, calls, storage } = await mount(t);
  await act(async () => button(r, "Speak or type stock log").props.onClick());
  await act(async () =>
    r.root
      .findByType("textarea")
      .props.onChange({ target: { value: "Basil four pounds" } }),
  );
  await act(async () => button(r, "Keep draft & close").props.onClick());
  await act(async () => button(r, "Speak or type stock log").props.onClick());
  assert.equal(r.root.findByType("textarea").props.value, "Basil four pounds");
  assert.equal(
    storage.get("tablego-stock-log:2026-10-28"),
    "Basil four pounds",
  );
  assert.equal(calls.length, 0);
});

test("manually matching an unknown item preserves its dictated unit and requires acknowledgement instead of silently converting", async (t) => {
  const { renderer: r } = await mount(t);
  await enter(r, "Mystery herbs 2 bunches.");
  const select = r.root.findByType("select");
  await act(async () => select.props.onChange({ target: { value: "basil" } }));
  const unit = r.root
    .findAllByType("input")
    .find((i) => i.props.list === "stock-log-units");
  assert.equal(unit.props.value, "bunch");
  assert.equal(reviewCheck(r).props.disabled, true);
  assert.ok(JSON.stringify(r.toJSON()).includes("instead of"));
});

test("unit case alone does not require conversion acknowledgement", async (t) => {
  const { renderer: r } = await mount(t);
  await enter(r, "Basil 5 lb.");
  await act(async () => button(r, "Edit").props.onClick());
  const unit = r.root
    .findAllByType("input")
    .find((i) => i.props.list === "stock-log-units");
  await act(async () => unit.props.onChange({ target: { value: "LB" } }));
  assert.equal(reviewCheck(r).props.disabled, false);
  assert.equal(
    r.root.findAllByType("input").filter((i) => i.props.type === "checkbox")
      .length,
    1,
  );
});
test("legacy receipt estimates never replace the last physical count in the comparison", async (t) => {
  const snapshot = structuredClone(board);
  snapshot.stock.basil = {
    ...snapshot.stock.basil,
    quantity: 99,
    stockSource: "receipt",
    lastCountQuantity: 4,
    lastCountUnit: "lb",
  };
  const { renderer: r } = await mount(t, { snapshot });
  await enter(r, "Basil 5 lb.");
  const text = JSON.stringify(r.toJSON());
  assert.ok(text.includes("4 lb"));
  assert.equal(text.includes("99 lb"), false);
});

test("matched valid log rows start compact and expand only when editing", async (t) => {
  const { renderer: r } = await mount(t);
  await enter(r, "Basil 5 lb. White rice 2 bags.");
  assert.equal(r.root.findAllByType("select").length, 0);
  assert.equal(
    r.root.findAllByType("input").filter((i) => i.props.type === "number")
      .length,
    0,
  );
  await act(async () => button(r, "Edit").props.onClick());
  assert.equal(r.root.findAllByType("select").length, 1);
  await act(async () => button(r, "Done editing").props.onClick());
  assert.equal(r.root.findAllByType("select").length, 0);
});
