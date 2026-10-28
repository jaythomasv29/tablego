import test from "node:test";
import assert from "node:assert/strict";
import { parseInventoryLog } from "../src/lib/inventory/dictation.ts";
const goods = [
  { id: "basil", name: "Basil", baseUnit: "bunch", category: "Produce" },
  { id: "broccoli", name: "Broccoli", baseUnit: "case", category: "Produce" },
  {
    id: "chicken-fresh",
    name: "Fresh chicken breast",
    baseUnit: "lb",
    category: "Meat",
  },
  {
    id: "chicken-frozen",
    name: "Frozen chicken breast",
    baseUnit: "lb",
    category: "Meat",
  },
  { id: "mac", name: "Mac and cheese", baseUnit: "box", category: "Pantry" },
];
const parse = (text) => parseInventoryLog(text, goods, [], {});
test("phone dictated list accepts quantities before or after item and canonical units", () => {
  const rows = parse(
    "basil two bunches, one case broccoli; fresh chicken breast fifteen pounds.",
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.itemId, r.quantity, r.unit, r.issue]),
    [
      ["basil", 2, "bunch", ""],
      ["broccoli", 1, "case", ""],
      ["chicken-fresh", 15, "lb", ""],
    ],
  );
});
test("generic variant names stay ambiguous rather than choosing fresh or frozen", () => {
  const [row] = parse("chicken breast fifteen pounds");
  assert.equal(row.itemId, "");
  assert.match(row.issue, /Several items/);
  assert.equal(row.quantity, 15);
});
test("decimals, spoken hundreds, fractions and conjunctions retain separate rows", () => {
  assert.equal(
    parse("basil one hundred and twenty five bunches")[0].quantity,
    125,
  );
  assert.equal(parse("basil one point two five bunches")[0].quantity, 1.25);
  assert.equal(parse("basil one and a half bunches")[0].quantity, 1.5);
  assert.equal(parse("basil quarter bunch")[0].quantity, 0.25);
  assert.equal(
    parse("basil 2.5 bunches and broccoli half case")[1].quantity,
    0.5,
  );
  assert.equal(parse("basil 1/2 bunch")[0].quantity, 0.5);
});
test("known names preserve conjunctions and supplier alias matching stays exact", () => {
  assert.equal(
    parse("mac and cheese two boxes and basil zero bunches").length,
    2,
  );
  const rows = parseInventoryLog(
    "Thai holy basil two bunches",
    goods,
    [{ itemId: "basil", supplierItemName: "Thai holy basil" }],
    {},
  );
  assert.equal(rows[0].itemId, "basil");
  assert.equal(rows[0].quantity, 2);
});
test("unknown text, missing numbers and missing units are retained for review", () => {
  const rows = parse("lemons six bags\nbasil\nbroccoli three");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, "lemons six bags");
  assert.equal(rows[0].itemId, "");
  assert.equal(rows[1].quantity, null);
  assert.match(rows[2].issue, /Unit not stated/);
  assert.equal(rows[2].unit, "case");
});
test("duplicates, ranges, negative and multiple units never become silent valid counts", () => {
  assert.ok(
    parse("basil two bunches, basil three bunches").every((r) =>
      /more than once/.test(r.issue),
    ),
  );
  for (const line of [
    "basil five to six bunches",
    "basil -2 bunches",
    "basil about five bunches",
    "basil five bunches two cases",
    "basil one two bunches",
  ])
    assert.ok(parse(line)[0].issue, line);
});
test("explicit zero is retained and parser does not mutate previous stock", () => {
  const stock = { basil: { quantity: 20, unit: "lb" } },
    before = JSON.stringify(stock);
  const row = parseInventoryLog("basil zero bunches", goods, [], stock)[0];
  assert.equal(row.quantity, 0);
  assert.equal(row.unit, "bunch");
  assert.equal(JSON.stringify(stock), before);
});
test("large logs report truncation and never exceed 200 review rows", () => {
  const rows = parse(Array(201).fill("basil two bunches").join("\n"));
  assert.equal(rows.length, 200);
  assert.match(rows.at(-1).issue, /limit reached/);
  assert.match(
    parse("basil two bunches\n" + "x".repeat(20000)).at(-1).issue,
    /limit reached/,
  );
});
test("continuous phone speech segments leading and trailing quantities without punctuation", () => {
  const catalog = [
    ...goods,
    { id: "carrots", name: "Carrots", category: "Produce", baseUnit: "lb" },
  ];
  for (const text of [
    "two bunches of basil three cases of broccoli five pounds of carrots",
    "basil two bunches broccoli three cases carrots five pounds",
    "basil two bunches three cases of broccoli carrots five pounds",
  ]) {
    const rows = parseInventoryLog(text, catalog, [], {});
    assert.deepEqual(
      rows.map((r) => [r.itemId, r.quantity, r.unit, r.issue]),
      [
        ["basil", 2, "bunch", ""],
        ["broccoli", 3, "case", ""],
        ["carrots", 5, "lb", ""],
      ],
      text,
    );
    assert.ok(rows.every((r) => text.includes(r.source)));
  }
});
test("accent and singular variants match, conversational prefixes and unknown text remain reviewable", () => {
  const catalog = [
    ...goods,
    { id: "jalapenos", name: "Jalapeños", category: "Produce", baseUnit: "lb" },
    {
      id: "sprouts",
      name: "Bean sprouts",
      category: "Produce",
      baseUnit: "bag",
    },
  ];
  const rows = parseInventoryLog(
    "I see jalapenos two pounds, bean sprout three bags",
    catalog,
    [],
    {},
  );
  assert.equal(rows[0].itemId, "jalapenos");
  assert.equal(rows[1].itemId, "sprouts");
  const unknown = parse("basil two bunches mystery goods broccoli three cases");
  assert.ok(unknown.some((r) => r.source.includes("mystery goods") && r.issue));
});

test("explicit custom units from catalog, stock and supplier mappings support plurals and article counts", () => {
  const custom = [
      ...goods,
      { id: "carrots", name: "Carrots", category: "Produce", baseUnit: "tray" },
    ],
    offers = [
      {
        itemId: "broccoli",
        supplierItemName: "Broccoli",
        orderUnit: "flat",
        packUnit: "crate",
      },
    ],
    stock = { basil: { unit: "basket" } };
  const rows = parseInventoryLog(
    "a basket of basil an flat of broccoli carrots two trays",
    custom,
    offers,
    stock,
  );
  assert.deepEqual(
    rows.map((r) => [r.itemId, r.quantity, r.unit, r.issue]),
    [
      ["basil", 1, "basket", ""],
      ["broccoli", 1, "flat", ""],
      ["carrots", 2, "tray", ""],
    ],
  );
  assert.equal(
    parseInventoryLog("broccoli two crates", custom, offers, stock)[0].unit,
    "crate",
  );
  assert.equal(parse("basil a mystery")[0].quantity, null);
});
