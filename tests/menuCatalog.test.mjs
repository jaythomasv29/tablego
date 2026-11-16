import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MENU_DISHES, MENU_PAGE_SIZE, MAX_CATERING_DISHES, menuDish, resolveDishSelections, groupDishesBySection } from '../src/lib/menu/catalog.ts';
import { cateringInput } from '../src/lib/catering/input.ts';
import { renderCateringNotification } from '../src/lib/catering/notification.ts';
import { cateringLead, filterCatering } from '../src/lib/catering/admin.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';

const base = { name: 'Synthetic Catering', email: 'catering@example.invalid', phone: '(650) 555-0100', date: '2026-11-15', partySize: '40', budget: '$1000 – $2,500' };

test('menu catalog has unique dishes with tap areas inside the printed pages that never overlap', () => {
  assert.ok(MENU_DISHES.length >= 70, 'expected the full print menu');
  assert.equal(new Set(MENU_DISHES.map(d => d.id)).size, MENU_DISHES.length);
  for (const dish of MENU_DISHES) {
    assert.match(dish.price, /^\$\d/, `${dish.name} has a price`);
    assert.ok(dish.section && dish.areas.length, `${dish.name} has a section and an area`);
    for (const a of dish.areas) {
      assert.ok(a.x >= 0 && a.y >= 0 && a.w > 20 && a.h > 5 && a.x + a.w <= MENU_PAGE_SIZE.width && a.y + a.h <= MENU_PAGE_SIZE.height, `${dish.id} area within page`);
    }
  }
  const areas = MENU_DISHES.flatMap(d => d.areas.map(a => ({ ...a, id: d.id })));
  for (const a of areas) for (const b of areas) {
    if (a === b || a.page !== b.page) continue;
    const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
    assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
  }
  assert.ok(menuDish('pad-thai').choices.includes('Shrimp (+$3.50)'));
  assert.deepEqual(menuDish('fresh-spring-rolls').addOns, ['Avocado (+$1.50)']);
  assert.equal(menuDish('sweet-sticky-rice-mango'), undefined);
});

test('dish selections resolve to catalog names and prices and reject anything off the menu', () => {
  const [pad, rolls] = resolveDishSelections([
    { id: 'pad-thai', name: 'Free lobster', price: '$0', choice: 'Shrimp (+$3.50)', note: '  mild please ' },
    { id: 'fresh-spring-rolls', addOns: ['Avocado (+$1.50)', 'Avocado (+$1.50)'] },
  ]);
  assert.deepEqual(pad, { id: 'pad-thai', name: 'Pad Thai', section: 'Noodles', price: '$18', choice: 'Shrimp (+$3.50)', addOns: [], note: 'mild please' });
  assert.deepEqual(rolls.addOns, ['Avocado (+$1.50)']);
  assert.throws(() => resolveDishSelections([{ id: 'firestore-doc-id', name: 'Pad Thai' }]), /no longer on the menu/);
  assert.throws(() => resolveDishSelections([{ id: 'pad-thai', choice: 'Lobster' }]), /listed option/);
  assert.throws(() => resolveDishSelections([{ id: 'pad-thai', addOns: ['Gold leaf'] }]), /listed add-ons/);
  assert.throws(() => resolveDishSelections([{ id: 'pad-thai' }, { id: 'pad-thai' }]), /twice/);
  assert.throws(() => resolveDishSelections([{ id: 'pad-thai', note: 'x'.repeat(201) }]), /under 200/);
  assert.throws(() => resolveDishSelections(MENU_DISHES.slice(0, MAX_CATERING_DISHES + 1).map(d => ({ id: d.id }))), /at most 30/);
  assert.throws(() => resolveDishSelections('pad-thai'), /at most 30/);
  assert.deepEqual(groupDishesBySection([{ id: 'pad-thai', section: 'Noodles' }, { id: 'satay-chicken', section: 'Starters' }]).map(g => g.section), ['Starters', 'Noodles']);
});

test('catering input stores resolved dishes from the catalog', () => {
  const inquiry = cateringInput({ ...base, selectedDishes: [{ id: 'kung-pao', choice: 'Veggie' }] });
  assert.deepEqual(inquiry.selectedDishes, [{ id: 'kung-pao', name: 'Kung Pao', section: 'Wok', price: '$18', choice: 'Veggie', addOns: [], note: '' }]);
});

test('restaurant email lists dishes by section with options, notes and prices, escaped', () => {
  const inquiry = cateringInput({ ...base, specialRequests: 'Nut allergy table', selectedDishes: [
    { id: 'pad-thai', choice: 'Shrimp (+$3.50)', note: '<b>no peanuts</b>' }, { id: 'satay-chicken' },
  ] });
  const staff = renderCateringNotification({ recipient: 'restaurant', inquiry }, defaultRestaurant);
  assert.match(staff.subject, /Catering inquiry — Synthetic Catering/);
  assert.ok(staff.html.indexOf('Starters') < staff.html.indexOf('Noodles'), 'sections follow menu order');
  assert.match(staff.html, /Pad Thai<\/td><td[^>]*>Shrimp \(\+\$3\.50\)/);
  assert.match(staff.html, /\$18/); assert.match(staff.html, /As listed/);
  assert.ok(staff.html.includes('&lt;b&gt;no peanuts&lt;/b&gt;') && !staff.html.includes('<b>no peanuts'));
  assert.match(staff.text, /Noodles:\n- Pad Thai \(\$18\) — Shrimp \(\+\$3\.50\) — Note: <b>no peanuts<\/b>/);
  assert.match(staff.text, /catering@example\.invalid/);
  const guest = renderCateringNotification({ recipient: 'guest', inquiry }, defaultRestaurant);
  assert.equal(guest.to, 'catering@example.invalid'); assert.match(guest.html, /Requested menu · 2 dishes/);
  const legacy = renderCateringNotification({ recipient: 'restaurant', inquiry: { ...inquiry, selectedDishes: [{ id: 'old', name: 'Curry' }] } }, defaultRestaurant);
  assert.match(legacy.html, /Other.*Curry/s);
  const none = renderCateringNotification({ recipient: 'restaurant', inquiry: { ...inquiry, selectedDishes: [] } }, defaultRestaurant);
  assert.match(none.html, /No dishes selected/);
});

test('admin leads expose structured menu selections and stay compatible with older inquiries', () => {
  const lead = cateringLead('synthetic', { ...base, status: 'pending', selectedDishes: [
    { id: 'pad-thai', name: 'Pad Thai', section: 'Noodles', price: '$18', choice: 'Shrimp (+$3.50)', addOns: [], note: 'mild' }, 'Legacy Curry',
  ] }, 'America/Los_Angeles');
  assert.deepEqual(lead.selectedDishes, ['Pad Thai', 'Legacy Curry']);
  assert.deepEqual(lead.menuSelections[0], { name: 'Pad Thai', section: 'Noodles', price: '$18', choice: 'Shrimp (+$3.50)', addOns: [], note: 'mild' });
  assert.deepEqual(lead.menuSelections[1], { name: 'Legacy Curry', section: '', price: '', choice: '', addOns: [], note: '' });
  assert.equal(filterCatering([lead], { filter: 'all', search: 'shrimp', dueOnly: false, sort: 'newest' }, 'America/Los_Angeles', new Date('2026-11-01T12:00:00Z')).length, 1);
});
