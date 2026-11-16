// Builds src/lib/menu/catalog.data.ts from scripts/menu-text.json (see render-menu-pages.swift).
// Detects every dish on the print menu (name, price, section, description, options) plus the
// tap areas that make it selectable in MenuCanvas. Re-run after replacing the menu PDF and
// review the printed summary; PHOTO_DISHES below links photo captions to dishes by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = new URL('./menu-text.json', import.meta.url);
const OUTPUT = new URL('../src/lib/menu/catalog.data.ts', import.meta.url);

// Photo caption → dish name. Captions that are not a menu dish map to null (photo stays inert).
const PHOTO_DISHES = {
  'Roti': 'Roti & Two Curry Sauce',
  'Spicy New York Steak Salad': 'Spicy NY Steak Salad',
  'Panang Curry Prawns': 'Prawns Chu Chee',
  'Mango Cashew Chicken': 'Mango Cashew',
  'Yellow Curry Chicken': 'Yellow Curry',
  'Thai BBQ Chicken': 'BBQ Chicken',
  'Thaiphoon House Fried Rice Prawns': 'Thaiphoon House Fried Rice',
  'Kao Soi Chicken': 'Kao Soi',
  'Pad Thai Prawns': 'Pad Thai',
  'Pad See Ew Chicken': 'Pad See Ew',
  'Chicken Eggplant Stir Fry': 'Eggplant Stir Fry',
  'Sweet Sticky Rice Mango': null,
};
// Small centered text that is a note, not a photo caption.
const NOT_CAPTIONS = /^\(|allerg|contains peanuts/i;
// Dish titles that are promotions rather than orderable dishes.
const NOT_DISHES = [/complete the meal/i];
// Sections whose dishes take the "Entree protein options" banner, unless the dish names a protein
// or lists its own choices.
const PROTEIN_SECTIONS = new Set(['Signature Dishes', 'Wok', 'Curry', 'Noodles', 'Fried Rice']);
const NAMED_PROTEIN = /chicken|beef|pork|duck|prawn|shrimp|salmon|sole|crab|seafood|ribs|tofu/i;

const COLUMNS = [{ left: 21, right: 201 }, { left: 216, right: 396 }, { left: 410, right: 590 }];
const PAGE = { width: 612, height: 1008, header: 60, footer: 978 };
const PRICE = /\s(\$\d[\d.]*(?:\/\$?\d[\d.]*)*)$/;

const runs = JSON.parse(readFileSync(SOURCE, 'utf8'))
  .filter(r => r.y > PAGE.header && r.y < PAGE.footer)
  .map(r => ({ ...r, bottom: r.y + r.h, base: r.y + r.h }));

const colOf = x => (x < 208 ? 0 : x < 403 ? 1 : 2);
const covers = (r, c) => Math.min(r.x + r.w, COLUMNS[c].right) - Math.max(r.x, COLUMNS[c].left) > 10;
const titleCase = s => s.toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = n => Math.round(n * 10) / 10;

// Join runs sitting on one visual line, inserting a space only where the PDF left a word gap.
function join(group) {
  const sorted = [...group].sort((a, b) => a.x - b.x);
  return sorted.reduce((text, r, i) => {
    if (!i) return r.text;
    const prev = sorted[i - 1];
    return text + (r.x - (prev.x + prev.w) > r.size * 0.25 ? ' ' : '') + r.text;
  }, '').replace(/\s+/g, ' ').trim();
}

// Group runs into lines: same page, column, weight, similar size and baseline.
function lines(filter) {
  const out = [];
  for (const r of runs.filter(filter)) {
    const line = out.find(l => l.page === r.page && l.col === colOf(r.x) && l.bold === r.bold
      && Math.abs(l.size - r.size) < 1.5 && Math.abs(l.base - r.base) < 2.5);
    if (line) { line.runs.push(r); line.base = Math.max(line.base, r.base); }
    else out.push({ page: r.page, col: colOf(r.x), bold: r.bold, size: r.size, base: r.base, runs: [r] });
  }
  return out.map(l => ({ ...l, text: join(l.runs), y: Math.min(...l.runs.map(r => r.y)), bottom: Math.max(...l.runs.map(r => r.bottom)),
    x: Math.min(...l.runs.map(r => r.x)), right: Math.max(...l.runs.map(r => r.x + r.w)) }));
}

const isGF = r => r.bold && r.text === 'GF';
const headings = lines(r => r.bold && r.size >= 10 && r.size < 20).map(h => ({ ...h, name: titleCase(h.text) === 'Starters' ? 'Starters' : titleCase(h.text) }));
const boldLines = lines(r => r.bold && r.size >= 6.5 && r.size < 10 && !isGF(r)).sort((a, b) => a.page - b.page || a.col - b.col || a.y - b.y);
const captions = lines(r => !r.bold && r.size <= 6.2).filter(l => {
  const c = COLUMNS[l.col]; return !NOT_CAPTIONS.test(l.text) && Math.abs((l.x + l.right) / 2 - (c.left + c.right) / 2) < 12;
});

// Titles: bold lines ending in a price; a priceless bold line right below a title continues it.
const titles = [];
for (const line of boldLines) {
  const prev = titles.at(-1);
  if (PRICE.test(line.text)) titles.push({ ...line, lines: [line] });
  else if (prev && prev.page === line.page && prev.col === line.col && line.y - prev.bottom < 6 && !/^(choose|add)\b/i.test(line.text)) {
    prev.lines.push(line); prev.bottom = line.bottom;
  }
}

function sectionFor(t) {
  const above = headings.filter(h => h.page === t.page && h.y < t.y);
  const own = above.filter(h => h.col === t.col).sort((a, b) => b.y - a.y)[0];
  return (own || above.sort((a, b) => b.y - a.y)[0])?.name || 'Menu';
}

function parseChips(text) {
  const choices = [], addOns = [];
  const fmt = s => s.trim().replace(/\.$/, '').replace(/^\+\$(\d[\d.]*)\s+(.+)$/, (_, p, n) => (Number(p) ? `${n} (+$${p})` : n));
  for (const part of text.split(/(?=Choose:|Add\s)/)) {
    if (/^Choose:/.test(part)) choices.push(...part.replace(/^Choose:\s*/, '').split(/,\s*(?:or\s+)?|\s+or\s+/).map(fmt).filter(Boolean));
    else if (/^Add\s/.test(part)) addOns.push(part.replace(/^Add\s+/, '').trim().replace(/\.$/, '').replace(/^(.+?)\s+\+\$(\d[\d.]*)$/, (_, n, p) => `${n[0].toUpperCase()}${n.slice(1)} (+$${p})`));
  }
  return { choices, addOns };
}

// Entree protein options banner, e.g. "Pork +$2.50 Shrimp +$3.50 ...".
const bannerTitle = runs.find(r => /^ENTREE PROTEIN OPTIONS/.test(r.text));
const banner = bannerTitle ? runs.filter(r => r.page === bannerTitle.page && r.bold && r.y > bannerTitle.bottom + 2 && r.y < bannerTitle.bottom + 20)
  .sort((a, b) => a.x - b.x).map(r => r.text).join(' ') : '';
const PROTEINS = ['Chicken', 'Veggie', ...[...banner.matchAll(/([A-Z][a-z]+(?: [A-Z][a-z]+)?) \+\$(\d[\d.]*)/g)].map(m => `${m[1]} (+$${m[2]})`)];

const dishes = [];
titles.forEach((t, i) => {
  const [, price] = t.lines[0].text.match(PRICE);
  const name = t.lines.map(l => l.text.replace(PRICE, '')).join(' ').replace(/\s+/g, ' ').trim();
  if (NOT_DISHES.some(re => re.test(name))) return;
  const next = [titles[i + 1], ...headings, ...captions].filter(x => x && x.page === t.page && x.col === t.col && x.y > t.bottom - 1);
  // The protein banner spans every column and ends the dishes above it.
  const band = bannerTitle && bannerTitle.page === t.page && bannerTitle.y > t.bottom ? [bannerTitle.y - 4] : [];
  const limit = Math.min(PAGE.footer, ...band, ...next.map(x => x.y));
  const own = runs.filter(r => r.page === t.page && colOf(r.x) === t.col && r.y >= t.bottom - 1 && r.y < limit && !(r.bold && r.size >= 10));
  const desc = lines(r => own.includes(r) && !r.bold && r.size >= 6.5).sort((a, b) => a.y - b.y);
  const chips = lines(r => own.includes(r) && r.bold && r.size < 6.5 && !isGF(r)).sort((a, b) => a.y - b.y || a.x - b.x);
  const bottom = Math.max(t.bottom, ...desc.map(l => l.bottom), ...chips.map(l => l.bottom));
  const { choices, addOns } = parseChips(chips.map(c => c.text).join(' '));
  const section = sectionFor(t);
  const gf = runs.some(r => isGF(r) && r.page === t.page && colOf(r.x) === t.col && r.y > t.y - 4 && r.y < t.y + t.size);
  const c = COLUMNS[t.col];
  dishes.push({
    id: slug(name), name, section, price, page: t.page, gf,
    description: desc.map(l => l.text).join(' ').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim(),
    choices: choices.length ? choices : PROTEIN_SECTIONS.has(section) && !NAMED_PROTEIN.test(name) ? PROTEINS : [],
    addOns,
    areas: [{ page: t.page, x: round(c.left - 4), y: round(t.y - 3), w: round(c.right - c.left + 8), h: round(bottom - t.y + 6) }],
  });
});

// Photo areas: from the bottom of whatever sits above the caption down to the caption.
const unmatched = [];
for (const cap of captions) {
  if (!(cap.text in PHOTO_DISHES) && !dishes.some(d => d.name === cap.text)) { unmatched.push(cap.text); continue; }
  const target = cap.text in PHOTO_DISHES ? PHOTO_DISHES[cap.text] : cap.text;
  if (!target) continue;
  const dish = dishes.find(d => d.name === target);
  if (!dish) throw new Error(`Caption "${cap.text}" maps to unknown dish "${target}"`);
  const top = Math.max(PAGE.header, ...runs.filter(r => r.page === cap.page && covers(r, cap.col) && r.bottom < cap.y - 4).map(r => r.bottom),
    ...dishes.flatMap(d => d.areas).filter(a => a.page === cap.page && colOf(a.x + 4) === cap.col && a.y + a.h < cap.y).map(a => a.y + a.h));
  const c = COLUMNS[cap.col];
  dish.areas.push({ page: cap.page, x: round(c.left - 4), y: round(top + 5), w: round(c.right - c.left + 8), h: round(cap.bottom - top - 3) });
}

// Neighbouring areas in a column must not overlap, so every tap has exactly one dish.
const all = dishes.flatMap(d => d.areas).sort((a, b) => a.page - b.page || a.x - b.x || a.y - b.y);
all.forEach((a, i) => {
  const below = all[i + 1];
  if (below && below.page === a.page && below.x === a.x && a.y + a.h > below.y - 1) a.h = round(below.y - 1 - a.y);
});

// Reading order: sections as they appear on the menu, then column, then top to bottom.
const sectionOrder = [...new Set([...headings].sort((a, b) => a.page - b.page || a.y - b.y || a.col - b.col).map(h => h.name))];
const at = d => d.areas[0];
dishes.sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.page - b.page || at(a).x - at(b).x || at(a).y - at(b).y);

const ids = new Set();
for (const d of dishes) { if (ids.has(d.id)) throw new Error(`Duplicate dish id ${d.id}`); ids.add(d.id); }

writeFileSync(OUTPUT, `// Generated by scripts/build-menu-catalog.mjs from the print menu PDF. Do not edit by hand.
export const MENU_PAGE_SIZE = ${JSON.stringify({ width: PAGE.width, height: PAGE.height })} as const;
export const MENU_DISH_DATA = ${JSON.stringify(dishes, null, 2)} as const;
`);

for (const d of dishes) console.log(`${d.page} ${d.section.padEnd(16)} ${d.name.padEnd(32)} ${d.price.padEnd(10)} ${d.gf ? 'GF ' : '   '}${d.areas.length > 1 ? '📷 ' : '   '}${d.choices.join(' | ')}${d.addOns.length ? ` +[${d.addOns.join(', ')}]` : ''}`);
console.log(`\n${dishes.length} dishes, ${dishes.reduce((n, d) => n + d.areas.length - 1, 0)} photos linked`);
if (unmatched.length) console.log(`Captions without a dish (add to PHOTO_DISHES): ${unmatched.join('; ')}`);
