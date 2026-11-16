import { MENU_DISH_DATA, MENU_PAGE_SIZE } from './catalog.data.ts';

// Dishes detected on the print menu. Regenerate catalog.data.ts with scripts/build-menu-catalog.mjs.
export type MenuArea = { page: number; x: number; y: number; w: number; h: number };
export type MenuDish = {
  id: string; name: string; section: string; price: string; page: number; gf: boolean; description: string;
  choices: readonly string[]; addOns: readonly string[]; areas: readonly MenuArea[];
};
/** What the guest sends: a dish id plus optional choices. */
export type DishSelection = { id: string; choice?: string; addOns?: string[]; note?: string };
/** What is stored and emailed: canonical details resolved on the server. */
export type SelectedDish = { id: string; name: string; section: string; price: string; choice: string; addOns: string[]; note: string };

export const MENU_DISHES: readonly MenuDish[] = MENU_DISH_DATA;
export { MENU_PAGE_SIZE };
export const MAX_CATERING_DISHES = 30;
export const DISH_NOTE_LIMIT = 200;

const byId = new Map(MENU_DISHES.map(dish => [dish.id, dish]));
export function menuDish(id: string) { return byId.get(id); }

/** Validate guest selections against the menu and return the canonical stored form. Throws on invalid input. */
export function resolveDishSelections(value: unknown): SelectedDish[] {
  if (!Array.isArray(value) || value.length > MAX_CATERING_DISHES) throw new Error(`Select at most ${MAX_CATERING_DISHES} dishes`);
  const seen = new Set<string>();
  return value.map(raw => {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    const dish = input && typeof input.id === 'string' ? menuDish(input.id) : undefined;
    if (!input || !dish) throw new Error('A selected dish is no longer on the menu. Please review your selections.');
    if (seen.has(dish.id)) throw new Error(`${dish.name} was selected twice`);
    seen.add(dish.id);
    const choice = input.choice === undefined || input.choice === '' ? '' : input.choice;
    if (typeof choice !== 'string' || (choice && !dish.choices.includes(choice))) throw new Error(`Choose a listed option for ${dish.name}`);
    const addOns = input.addOns === undefined ? [] : input.addOns;
    if (!Array.isArray(addOns) || addOns.some(addOn => typeof addOn !== 'string' || !dish.addOns.includes(addOn))) throw new Error(`Choose listed add-ons for ${dish.name}`);
    const note = input.note === undefined ? '' : input.note;
    if (typeof note !== 'string' || note.length > DISH_NOTE_LIMIT) throw new Error(`Keep the note for ${dish.name} under ${DISH_NOTE_LIMIT} characters`);
    return { id: dish.id, name: dish.name, section: dish.section, price: dish.price, choice, addOns: Array.from(new Set(addOns as string[])), note: note.trim() };
  });
}

/** One-line summary of the guest's choices for a dish, e.g. "Shrimp (+$3.50) · Avocado (+$1.50)". */
export function dishDetails(dish: Pick<SelectedDish, 'choice' | 'addOns'>) {
  return [dish.choice, ...(dish.addOns || [])].filter(Boolean).join(' · ');
}

/** Group dishes by section, keeping the order they appear on the menu. Unknown sections go last. */
export function groupDishesBySection<T extends { id?: string; section?: string }>(dishes: readonly T[]) {
  const order = (dish: T) => { const index = MENU_DISHES.findIndex(item => item.id === dish.id); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const groups = new Map<string, T[]>();
  for (const dish of [...dishes].sort((a, b) => order(a) - order(b))) {
    const section = dish.section || 'Other';
    groups.set(section, [...(groups.get(section) || []), dish]);
  }
  return Array.from(groups).map(([section, items]) => ({ section, items }));
}
