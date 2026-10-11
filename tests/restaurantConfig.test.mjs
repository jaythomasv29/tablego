import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultRestaurant, restaurantIdentity, validateGeneral, validateRestaurant } from '../src/lib/restaurant/config.ts';
import { validateHours } from '../src/lib/restaurant/hours.ts';
import { cateringInput } from '../src/lib/catering/input.ts';
import { closureDate, openAt, slotsForDate } from '../src/lib/reservations/availability.ts';
const valid = { timezone: 'America/Los_Angeles', reservationCutoffMinutes: 60, minimumLeadTimeMinutes: 50, restaurant: defaultRestaurant, version: 0 };
test('public identity has safe defaults and rejects secret keys and unsafe links', () => {
  assert.deepEqual(restaurantIdentity(undefined), defaultRestaurant);
  assert.throws(() => validateRestaurant({ ...defaultRestaurant, smtpPassword: 'secret' }));
  for (const link of ['javascript:alert(1)', '//attacker.invalid', 'https://user:secret@example.invalid', '/\\attacker.invalid', 'http://example.invalid']) assert.throws(() => validateRestaurant({ ...defaultRestaurant, orderUrl: link }));
  assert.equal(validateRestaurant({ ...defaultRestaurant, orderUrl: '/order' }).orderUrl, '/order');
});
test('business policy requires a real timezone, bounded integer minutes and conflict version', () => {
  assert.equal(validateGeneral(valid).autoConfirmReservations, true);
  assert.equal(validateGeneral({ ...valid, autoConfirmReservations: false }).autoConfirmReservations, false);
  assert.equal(validateGeneral(valid).timezone, 'America/Los_Angeles');
  for (const changes of [{ timezone: 'No/Such_Zone' }, { minimumLeadTimeMinutes: -1 }, { reservationCutoffMinutes: 0.5 }, { version: undefined }, { apiKey: 'secret' }, { autoConfirmReservations: 'false' }, { autoConfirmReservations: null }]) assert.throws(() => validateGeneral({ ...valid, ...changes }));
});
test('hours saves reject malformed and overnight ranges before disabling bookings', () => {
  const hours = Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => [day, { lunch: { isOpen: true, open: '11:00', close: '15:00' }, dinner: { isOpen: true, open: '17:00', close: '22:00' } }]));
  assert.equal(validateHours(hours).monday.lunch.open, '11:00');
  assert.throws(() => validateHours({ ...hours, monday: { ...hours.monday, lunch: { isOpen: true, open: '23:00', close: '02:00' } } }));
  assert.throws(() => validateHours({ ...hours, monday: { ...hours.monday, lunch: { ...hours.monday.lunch, customRanges: [{ start: '', end: '' }] } } }));
});
test('closure dates retain literal full-calendar legacy dates and reject impossible dates', () => {
  assert.equal(closureDate('2026-12-25T00:00:00Z'), '2026-12-25');
  assert.equal(closureDate('2026-12-25'), '2026-12-25');
  assert.equal(closureDate('2026-02-30'), null);
});
test('catering accepts only validated inquiry fields and excludes caller status and secrets', () => {
  const input = { name: 'Synthetic Caterer', email: 'test@example.invalid', phone: '6505550100', date: '2026-11-10', partySize: '20', budget: '$1000', selectedDishes: [], status: 'confirmed', password: 'secret' };
  const result = cateringInput(input);
  assert.equal(result.status, undefined); assert.equal(result.password, undefined);
  assert.throws(() => cateringInput({ ...input, date: '2026-02-30' }));
  assert.throws(() => cateringInput({ ...input, email: 'invalid' }));
});

test('open status uses restaurant clock and custom hours independently of booking lead time', () => {
  const hours = Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => [day, { lunch: { isOpen: true, open: '11:00', close: '15:00', customRanges: [{ start: '11:00', end: '12:00' }, { start: '13:00', end: '15:00' }] }, dinner: { isOpen: true, open: '17:00', close: '22:00' } }]));
  const policy = { businessHours: hours, specialDates: [], timezone: 'America/Los_Angeles', cutoffMinutes: 60, leadTimeMinutes: 50 };
  assert.equal(openAt(policy, new Date('2026-11-15T19:59:00Z')), true);
  assert.equal(openAt(policy, new Date('2026-11-15T20:00:00Z')), false);
  assert.equal(openAt(policy, new Date('2026-11-15T21:00:00Z')), true);
  assert.ok(!slotsForDate('2026-11-15', policy, new Date('2026-11-15T22:30:00Z')).some(slot => slot.period === 'lunch'));
  assert.equal(openAt(policy, new Date('2026-11-15T22:30:00Z')), true);
  const partial = { ...policy, specialDates: [{ date: '2026-11-15T00:00:00Z', closureType: 'lunch' }] };
  assert.equal(openAt(partial, new Date('2026-11-15T21:00:00Z')), false);
  assert.equal(openAt(partial, new Date('2026-11-16T01:00:00Z')), true);
  assert.equal(openAt({ ...partial, specialDates: [...partial.specialDates, { date: '2026-11-15', closureType: 'dinner' }] }, new Date('2026-11-16T01:00:00Z')), false);
});
