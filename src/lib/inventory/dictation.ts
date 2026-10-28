import type { CatalogGood, SupplierOffer } from "./operations";
import type { InventoryRecords } from "./model";
export interface DictationRow {
  id: string;
  source: string;
  itemId: string;
  quantity: number | null;
  unit: string;
  issue: string;
  confirmed?: boolean;
}
const small: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const units: Record<string, string> = {
  each: "each",
  piece: "each",
  pieces: "each",
  ea: "each",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  bag: "bag",
  bags: "bag",
  box: "box",
  boxes: "box",
  case: "case",
  cases: "case",
  bunch: "bunch",
  bunches: "bunch",
  bottle: "bottle",
  bottles: "bottle",
  gallon: "gallon",
  gallons: "gallon",
  pack: "pack",
  packs: "pack",
  can: "can",
  cans: "can",
  tub: "tub",
  tubs: "tub",
  container: "container",
  containers: "container",
  liter: "liter",
  liters: "liter",
  litre: "liter",
  litres: "liter",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
};
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ./'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const isNumber = (word: string) =>
  Object.hasOwn(small, word) ||
  ["hundred", "thousand", "half", "quarter", "point"].includes(word) ||
  /^\d+(?:\.\d+)?$/.test(word) ||
  /^\d+\/\d+$/.test(word);
function numberValue(words: string[]): number | null {
  const phrase = words.join(" ").replace(/\ba\s+(half|quarter)\b/g, "$1");
  if (/^\d+(?:\.\d+)?$/.test(phrase)) return Number(phrase);
  if (/^\d+\/\d+$/.test(phrase)) {
    const [a, b] = phrase.split("/").map(Number);
    return b ? a / b : null;
  }
  const decimal = phrase.split(" point ");
  if (decimal.length > 2) return null;
  if (decimal.length === 2) {
    const left = numberValue(decimal[0].split(" ")),
      right = decimal[1].split(" ");
    if (
      left === null ||
      !right.every((w) => small[w] !== undefined && small[w] < 10)
    )
      return null;
    return Number(`${left}.${right.map((w) => small[w]).join("")}`);
  }
  const fraction = phrase.match(/^(.*?)(?: and )?(half|quarter)$/);
  if (fraction) {
    const prefix = fraction[1].trim().replace(/ and$/, "").trim();
    if (!prefix) return fraction[2] === "half" ? 0.5 : 0.25;
    const whole = numberValue(prefix.split(" "));
    return whole === null
      ? null
      : whole + (fraction[2] === "half" ? 0.5 : 0.25);
  }
  let total = 0,
    current = 0,
    lastSmall = -1,
    seen = false;
  for (const word of words) {
    if (word === "and") continue;
    if (word === "hundred") {
      if (current <= 0 || current >= 10) return null;
      current *= 100;
      lastSmall = -1;
      seen = true;
      continue;
    }
    if (word === "thousand") {
      if (current <= 0 || current >= 1000) return null;
      total += current * 1000;
      current = 0;
      lastSmall = -1;
      seen = true;
      continue;
    }
    const n = small[word] ?? (/^\d+$/.test(word) ? Number(word) : undefined);
    if (n === undefined) return null;
    if (
      lastSmall >= 0 &&
      !(lastSmall >= 20 && lastSmall % 10 === 0 && n > 0 && n < 10)
    )
      return null;
    current += n;
    lastSmall = n;
    seen = true;
  }
  return seen ? total + current : null;
}
function clauses(text: string, aliases: string[]): string[] {
  // Preserve conjunctions inside known product names and inside spoken numbers.
  let protectedText = text
    .replace(/\r/g, "")
    .replace(/\band\b/gi, (word, index) => {
      const before =
          text.slice(0, index).trim().split(/\s+/).at(-1)?.toLowerCase() || "",
        after =
          text
            .slice(index + word.length)
            .trim()
            .split(/\s+/)[0]
            ?.toLowerCase() || "";
      return isNumber(before) && (isNumber(after) || after === "a")
        ? " ⟦∧⟧ "
        : word;
    });
  for (const alias of aliases
    .filter((a) => a.includes(" and "))
    .sort((a, b) => b.length - a.length)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    protectedText = protectedText.replace(new RegExp(escaped, "gi"), (match) =>
      match.replace(/ and /gi, " ⟦∧⟧ "),
    );
  }
  return protectedText
    .split(/[,;\n]+|\.(?!\d)|\band\b/gi)
    .map((s) => s.replace(/⟦∧⟧/g, "and").trim())
    .filter(Boolean);
}
const singularToken = (word: string) =>
  word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;
function continuousClauses(
  source: string,
  aliases: string[],
  knownUnits: Record<string, string>,
): string[] {
  const tokens = Array.from(source.matchAll(/\S+/g)).map((m) => ({
    word: normalize(m[0]),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
  const names = aliases
    .map((a) => a.split(" ").map(singularToken))
    .sort((a, b) => b.length - a.length);
  const anchors: {
    start: number;
    end: number;
    tokenStart: number;
    tokenEnd: number;
  }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const match = names.find(
      (name) =>
        name.length &&
        name.every(
          (word, j) =>
            tokens[i + j] && singularToken(tokens[i + j].word) === word,
        ),
    );
    if (match) {
      anchors.push({
        start: tokens[i].start,
        end: tokens[i + match.length - 1].end,
        tokenStart: i,
        tokenEnd: i + match.length,
      });
      i += match.length - 1;
    }
  }
  if (anchors.length < 2) return [source];
  const starts = (from: number, to: number) => {
    const found: number[] = [];
    for (let i = from; i < to; i++)
      if (
        isNumber(tokens[i].word) ||
        (["a", "an"].includes(tokens[i].word) &&
          knownUnits[tokens[i + 1]?.word])
      ) {
        found.push(tokens[i].start);
        while (
          i + 1 < to &&
          (isNumber(tokens[i + 1].word) ||
            tokens[i + 1].word === "and" ||
            tokens[i + 1].word === "a")
        )
          i++;
      }
    return found;
  };
  let beginning = 0;
  const result: string[] = [];
  for (let a = 1; a < anchors.length; a++) {
    const previous = anchors[a - 1],
      next = anchors[a],
      numbers = starts(previous.tokenEnd, next.tokenStart);
    const currentPrefix = source.slice(beginning, previous.start);
    const leading = currentPrefix
      .split(/\s+/)
      .map(normalize)
      .some(
        (w, i, words) =>
          isNumber(w) || (["a", "an"].includes(w) && knownUnits[words[i + 1]]),
      );
    const boundary =
      numbers.length >= 2
        ? numbers[1]
        : numbers.length === 1 && leading
          ? numbers[0]
          : next.start;
    const part = source.slice(beginning, boundary).trim();
    if (part) result.push(part);
    beginning = boundary;
  }
  const tail = source.slice(beginning).trim();
  if (tail) result.push(tail);
  return result;
}
export function parseInventoryLog(
  text: string,
  goods: CatalogGood[],
  offers: SupplierOffer[],
  stock: InventoryRecords,
): DictationRow[] {
  const aliases = goods
    .map((g) => ({ id: g.id, name: normalize(g.name) }))
    .concat(
      offers.map((o) => ({
        id: o.itemId,
        name: normalize(o.supplierItemName),
      })),
    );
  const knownUnits = { ...units };
  for (const unit of [
    ...goods.map((g) => g.baseUnit),
    ...Object.values(stock).map((item) => item.unit),
    ...offers
      .flatMap((offer) => [offer.orderUnit, offer.packUnit])
      .filter(Boolean),
  ]) {
    const key = normalize(unit);
    if (key && !key.includes(" ") && !knownUnits[key]) {
      knownUnits[key] = unit;
      const singular = singularToken(key);
      if (!knownUnits[singular]) knownUnits[singular] = unit;
      if (!knownUnits[singular + "s"]) knownUnits[singular + "s"] = unit;
    }
  }
  const parts = clauses(
    text.slice(0, 20000),
    aliases.map((a) => a.name),
  ).flatMap((source) =>
    continuousClauses(
      source,
      aliases.map((a) => a.name),
      knownUnits,
    ),
  );
  const truncated = text.length > 20000 || parts.length > 200;
  const sources = parts.slice(0, truncated ? 199 : 200);
  const rows: DictationRow[] = sources.map((source, index) => {
    const issues: string[] = [];
    const words = normalize(source).replace(/-/g, " ").split(" "),
      numberGroups: { words: string[]; indexes: number[] }[] = [],
      unitValues: string[] = [],
      removed = new Set<number>();
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (knownUnits[word]) {
        unitValues.push(knownUnits[word]);
        removed.add(i);
        continue;
      }
      if (["a", "an"].includes(word) && knownUnits[words[i + 1]]) {
        numberGroups.push({ words: ["one"], indexes: [i] });
        removed.add(i);
        continue;
      }
      if (isNumber(word)) {
        const group = { words: [word], indexes: [i] };
        while (
          i + 1 < words.length &&
          (isNumber(words[i + 1]) ||
            (words[i + 1] === "and" &&
              i + 2 < words.length &&
              (isNumber(words[i + 2]) || words[i + 2] === "a")) ||
            (words[i + 1] === "a" &&
              ["half", "quarter"].includes(words[i + 2])))
        ) {
          i++;
          group.words.push(words[i]);
          group.indexes.push(i);
        }
        numberGroups.push(group);
        group.indexes.forEach((n) => removed.add(n));
      }
    }
    let quantity: number | null = null;
    if (numberGroups.length === 1)
      quantity = numberValue(numberGroups[0].words);
    else if (numberGroups.length > 1)
      issues.push("Multiple quantities or a range: choose one exact count");
    if (quantity === null) issues.push("Enter an exact quantity");
    else if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      quantity > 999999 ||
      Math.round(quantity * 100) / 100 !== quantity
    ) {
      quantity = null;
      issues.push("Use a quantity from 0 to 999999 with up to two decimals");
    }
    if (
      /(?:^|\s)-\s*\d|\b(?:minus|negative|about|approximately|roughly|between|to|or)\b/i.test(
        source,
      )
    ) {
      quantity = null;
      issues.push("Approximate, negative or ranged quantity needs review");
    }
    const query = words
      .filter((w, i) => !removed.has(i))
      .join(" ")
      .replace(
        /^(?:i have|i see|we have|we have got|we've got|there are|there is|there's|have|got|counted|check)\s+/,
        "",
      )
      .replace(/\b(?:of|a|of|remaining|left|on hand)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const canonicalQuery = query.split(" ").map(singularToken).join(" ");
    let candidates = aliases.filter(
      (a) => a.name.split(" ").map(singularToken).join(" ") === canonicalQuery,
    );
    if (!candidates.length && query) {
      const tokens = query.split(" ").map(singularToken);
      candidates = aliases.filter((a) => {
        const names = a.name.split(" ").map(singularToken);
        return tokens.every((t) => names.includes(t));
      });
    }
    const ids = Array.from(new Set(candidates.map((a) => a.id))).filter((id) =>
      goods.some((g) => g.id === id),
    );
    const itemId = ids.length === 1 ? ids[0] : "";
    if (ids.length > 1)
      issues.push("Several items match: choose the exact item");
    else if (!itemId) issues.push("Item not recognized: choose an item");
    let unit = unitValues[0] || "";
    if (unitValues.length > 1) {
      unit = "";
      issues.push("Multiple units: choose the counting unit");
    }
    if (!unit) {
      unit =
        stock[itemId]?.unit ||
        goods.find((g) => g.id === itemId)?.baseUnit ||
        "";
      issues.push("Unit not stated clearly: verify the unit");
    }
    return {
      id: `log-${index + 1}`,
      source,
      itemId,
      quantity,
      unit,
      issue: Array.from(new Set(issues)).join(". "),
    };
  });
  const occurrences = new Map<string, number>();
  for (const r of rows)
    if (r.itemId)
      occurrences.set(r.itemId, (occurrences.get(r.itemId) || 0) + 1);
  for (const r of rows)
    if (r.itemId && (occurrences.get(r.itemId) || 0) > 1)
      r.issue = [
        r.issue,
        "Item appears more than once: reconcile these rows before saving",
      ]
        .filter(Boolean)
        .join(". ");
  if (truncated)
    rows.push({
      id: "log-limit",
      source:
        "Some text was not processed. Split the log into smaller batches (20,000 characters and 200 rows maximum).",
      itemId: "",
      quantity: null,
      unit: "",
      issue: "Log limit reached: remaining text needs a separate review",
    });
  return rows;
}
