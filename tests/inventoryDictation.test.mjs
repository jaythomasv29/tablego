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

test('abbreviated, attached and additional counting units work in typed and spoken logs', () => {
 for (const [phrase, quantity, unit] of [['basil 2kg', 2, 'kg'], ['basil 500 g', 500, 'g'], ['basil 2 lbs.', 2, 'lb'], ['basil three qts', 3, 'quart'], ['basil 250ml', 250, 'ml'], ['basil 1 1/2 jars', 1.5, 'jar']]) {
  const row = parse(phrase)[0];
  assert.deepEqual([row.itemId, row.quantity, row.unit, row.issue], ['basil', quantity, unit, ''], phrase);
 }
});
test('saved multiword custom units and unknown item names survive review parsing', () => {
 const rows = parseInventoryLog('basil two small baskets; dragon fruit three sleeves', goods, [], {}, ['small basket']);
 assert.equal(rows[0].unit, 'small basket');
 assert.equal(rows[0].itemId, 'basil');
 assert.equal(rows[0].issue, '');
 assert.equal(rows[1].suggestedName, 'dragon fruit');
 assert.equal(rows[1].quantity, 3);
 assert.equal(rows[1].unit, 'sleeve');
 assert.equal(rows[1].itemId, '');
});

test('attached quantities in continuous speech and half a container keep their counts', () => {
 const rows = parse('2kg basil 3kg broccoli');
 assert.deepEqual(rows.map(r => [r.itemId, r.quantity, r.unit]), [['basil', 2, 'kg'], ['broccoli', 3, 'kg']]);
 assert.equal(parse('basil half a tub')[0].quantity, 0.5);
 assert.equal(parse('basil 1½ jars')[0].quantity, 1.5);
});

test('unit abbreviation punctuation preserves the boundary before a new unknown item', () => {
 const rows = parse('basil 2 lbs. Dragon fruit 3 cans.');
 assert.equal(rows.length, 2);
 assert.equal(rows[0].itemId, 'basil');
 assert.equal(rows[1].suggestedName, 'dragon fruit');
 assert.equal(rows[1].quantity, 3);
 assert.equal(parse('2 lbs. basil')[0].itemId, 'basil');
});

import { dictationRowReady } from "../src/lib/inventory/dictation.ts";
import { aliasInput, goodInput } from "../src/lib/inventory/operations.ts";
const shop = [
  { id: "basil", name: "Basil", baseUnit: "lb", category: "Produce" },
  { id: "cilantro", name: "Cilantro", baseUnit: "bunch", category: "Produce" },
  { id: "limes", name: "Limes", baseUnit: "each", category: "Produce" },
  { id: "green-onions", name: "Green onions", baseUnit: "case", category: "Produce", aliases: ["scallions"] },
  { id: "oyster-panda", name: "Oyster Sauce — Panda", baseUnit: "bottle", category: "Sauces" },
  { id: "oyster-kum", name: "Oyster Sauce — Kum Chun", baseUnit: "bottle", category: "Sauces" },
  { id: "rice", name: "Long Grain Rice (White)", baseUnit: "bag", category: "Rice" },
];
const say = (text, stock = {}) => parseInventoryLog(text, shop, [], stock).map((r) => [r.itemId, r.intent || "", r.quantity, r.issue]);
test("spoken order, out, enough and cancel actions need no count", () => {
  assert.deepEqual(say("basil low"), [["basil", "order", null, ""]]);
  assert.deepEqual(say("basil order"), [["basil", "order", null, ""]]);
  assert.deepEqual(say("running low on cilantro"), [["cilantro", "order", null, ""]]);
  assert.deepEqual(say("need limes"), [["limes", "order", null, ""]]);
  assert.deepEqual(say("basil to order"), [["basil", "order", null, ""]]);
  assert.deepEqual(say("out of cilantro"), [["cilantro", "out", 0, ""]]);
  assert.deepEqual(say("basil almost out"), [["basil", "order", null, ""]]);
  assert.deepEqual(say("basil good"), [["basil", "enough", null, ""]]);
  assert.deepEqual(say("cancel basil"), [["basil", "cancel", null, ""]]);
  assert.ok(parseInventoryLog("basil low", shop, [], {}).every(dictationRowReady));
});
test("one spoken action covers every item in the same sentence, but not the next sentence", () => {
  assert.deepEqual(say("basil, cilantro and limes low").map((r) => [r[0], r[1]]), [["basil", "order"], ["cilantro", "order"], ["limes", "order"]]);
  assert.deepEqual(say("basil cilantro limes low").map((r) => [r[0], r[1]]), [["basil", "order"], ["cilantro", "order"], ["limes", "order"]]);
  assert.deepEqual(say("low on basil and cilantro").map((r) => [r[0], r[1]]), [["basil", "order"], ["cilantro", "order"]]);
  const split = say("basil. cilantro good");
  assert.equal(split[0][1], ""); assert.match(split[0][3], /exact quantity/); assert.equal(split[1][1], "enough");
});
test("counts with an action save both, while plain counts keep the review rules", () => {
  const rows = parseInventoryLog("basil 2 bags low. rice 3 bags. limes 4", shop, [], {});
  assert.deepEqual([rows[0].intent, rows[0].quantity, rows[0].unit, rows[0].issue], ["order", 2, "bag", ""]);
  assert.deepEqual([rows[1].intent, rows[1].quantity, rows[1].issue], [undefined, 3, ""]);
  assert.equal(dictationRowReady(rows[1]), false);
  assert.match(rows[2].issue, /Unit not stated/);
  assert.match(parseInventoryLog("cancel basil 2 lb", shop, [], {})[0].issue, /count separately/);
  assert.match(parseInventoryLog("basil low good", shop, [], {})[0].issue, /Mixed instructions/);
});
test("misheard words, nicknames and close matches", () => {
  assert.deepEqual(say("bazil low")[0].slice(0, 2), ["basil", "order"]);
  assert.deepEqual(say("cilantra good")[0].slice(0, 2), ["cilantro", "enough"]);
  assert.deepEqual(say("scallions order")[0].slice(0, 2), ["green-onions", "order"]);
  assert.deepEqual(say("white rice low")[0].slice(0, 2), ["rice", "order"]);
  assert.equal(say("lime low")[0][0], "limes");
  assert.equal(say("bay low")[0][0], "", "short words never fuzzy-match");
  const ambiguous = parseInventoryLog("oyster sauce order", shop, [], {})[0];
  assert.equal(ambiguous.itemId, ""); assert.deepEqual(ambiguous.candidates, ["oyster-panda", "oyster-kum"]);
  assert.equal(dictationRowReady(ambiguous), false);
});
test("nicknames are validated and optional on saved items", () => {
  assert.deepEqual(aliasInput("scallions, green onion ,, scallions"), { aliases: ["scallions", "green onion"] });
  assert.deepEqual(aliasInput(""), {});
  assert.throws(() => aliasInput(Array(11).fill("x").map((x, i) => x + i)));
  assert.throws(() => aliasInput("x".repeat(41)));
  assert.equal("aliases" in goodInput({ name: "Basil", category: "Produce", baseUnit: "lb" }, "basil"), false);
  assert.deepEqual(goodInput({ name: "Green onions", category: "Produce", baseUnit: "case", aliases: "scallions" }, "g").aliases, ["scallions"]);
});
test("action words inside an item name stay part of the name", () => {
  const goods = [...shop, { id: "tea", name: "Good Earth tea", baseUnit: "box", category: "Drinks" }];
  const rows = parseInventoryLog("good earth tea low. good earth tea good", goods, [], {});
  assert.deepEqual(rows.map((r) => [r.itemId, r.intent]), [["tea", "order"], ["tea", "enough"]]);
});
