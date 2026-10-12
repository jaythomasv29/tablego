import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cateringLead, cateringRecord, cateringUpdate, cateringFollowUpDue, filterCatering, cateringEmailLink } from '../src/lib/catering/admin.ts';
const zone = 'America/Los_Angeles', now = new Date('2026-10-13T02:00:00Z');
const fixture = overrides => cateringLead('synthetic', { name: 'Synthetic Guest', email: 'guest@example.invalid', phone: '+16505550100', date: '2026-11-15', partySize: '30', budget: '$1200', status: 'pending', ...overrides }, zone);
test('catering normalizes current and incomplete legacy inquiries without losing event details', () => {
  const legacy = fixture({ partySize: null, guests: 25, message: 'No peanuts', selectedDishes: [' Pad Thai ', { name: 'Curry' }, {}, null, 2], createdAt: { toDate: () => new Date('2026-10-13T02:00:00Z') }, phoneVerified: true, phoneVerificationSource: 'server' });
  assert.equal(legacy.partySize, '25'); assert.equal(legacy.specialRequests, 'No peanuts'); assert.deepEqual(legacy.selectedDishes, ['Pad Thai', 'Curry']); assert.equal(legacy.phoneVerified, true); assert.equal(legacy.version, 1);
  assert.equal(fixture({ partySize: 35 }).partySize, '35');
  const broken = fixture({ name: null, date: 'invalid', status: 'unknown', selectedDishes: [{ name: 123 }], createdAt: 'invalid' });
  assert.equal(broken.needsReview, true); assert.equal(broken.date, ''); assert.equal(broken.status, 'needs-review'); assert.equal(broken.createdAt, null);
});
test('workflow honors old-client completion while preserving declined stages', () => {
  assert.equal(fixture({ status: 'pending', workflowStage: 'contacted' }).status, 'contacted');
  assert.equal(fixture({ status: 'completed', workflowStage: 'contacted' }).status, 'completed');
  assert.equal(fixture({ status: 'completed', workflowStage: 'declined' }).status, 'declined');
});
test('untrusted guest records cannot supply private staff fields', () => {
  const guest = { status: 'pending', date: '2026-11-15', internalNotes: 'Caller supplied', workflowStage: 'confirmed', followUpDate: '2026-10-12', version: 500 };
  const noStaff = cateringLead('synthetic', cateringRecord(guest), zone); assert.equal(noStaff.internalNotes, ''); assert.equal(noStaff.status, 'pending'); assert.equal(noStaff.followUpDate, ''); assert.equal(noStaff.version, 1);
  const withStaff = cateringLead('synthetic', cateringRecord(guest, { internalNotes: 'Actual staff note', workflowStage: 'contacted', version: 2 }), zone); assert.equal(withStaff.internalNotes, 'Actual staff note'); assert.equal(withStaff.status, 'contacted'); assert.equal(withStaff.version, 2);
});
test('catering follow-ups use the business calendar across international viewing zones', () => {
  for (const viewer of ['Pacific/Kiritimati', 'Asia/Tokyo', 'Europe/London', 'America/Los_Angeles']) {
    const old = process.env.TZ; process.env.TZ = viewer;
    try {
      assert.equal(cateringFollowUpDue(fixture({ followUpDate: '2026-10-12' }), zone, now), true);
      assert.equal(cateringFollowUpDue(fixture({ followUpDate: '2026-10-13' }), zone, now), false);
      assert.equal(cateringFollowUpDue(fixture({ followUpDate: '2026-10-12', status: 'completed' }), zone, now), false);
      assert.equal(fixture({ date: '2026-11-15' }).date, '2026-11-15');
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  }
});
test('upcoming sorting, due filters and menu search retain legacy leads safely', () => {
  const leads = [fixture({ date: '2026-10-11' }), { ...fixture({ date: '2026-10-16', selectedDishes: ['Pad Thai'], followUpDate: '2026-10-12' }), id: 'upcoming' }, { ...fixture({ date: null }), id: 'missing' }];
  const options = { filter: 'active', search: '', dueOnly: false, sort: 'event' };
  assert.deepEqual(filterCatering(leads, options, zone, now).map(lead => lead.id), ['upcoming', 'synthetic', 'missing']);
  assert.equal(filterCatering(leads, { ...options, search: 'Pad Thai', dueOnly: true }, zone, now)[0].id, 'upcoming');
  assert.equal(filterCatering(leads, { ...options, filter: 'closed' }, zone, now).length, 0);
});
test('catering updates validate notes/date/version and clear follow-ups on closure', () => {
  const body = { status: 'contacted', originalStatus: 'pending', internalNotes: '  Menu discussed\nCall tomorrow  ', followUpDate: '2026-11-01', version: 1 };
  assert.equal(cateringUpdate(body).internalNotes, 'Menu discussed\nCall tomorrow');
  assert.equal(cateringUpdate({ ...body, status: 'completed' }).followUpDate, '');
  for (const bad of [{ version: 0 }, { version: '1' }, { originalStatus: 'invented' }, { status: 'invented' }, { internalNotes: null }, { internalNotes: 'x'.repeat(2001) }, { internalNotes: 'bad\u0000' }, { followUpDate: '2026-02-30' }]) assert.throws(() => cateringUpdate({ ...body, ...bad }));
});
test('draft email links bound the recipient and encode names and subjects safely', () => {
  const link = cateringEmailLink(fixture({ name: 'Guest & friend' }), 'Restaurant');
  assert.match(link, /^mailto:guest@example.invalid\?/); assert.equal(new URLSearchParams(link.split('?')[1]).get('subject'), 'Restaurant catering · 2026-11-15');
  for (const email of ['a@example.invalid,b@example.invalid', 'a@example.invalid?bcc=b@example.invalid', 'a@example.invalid\r\nBcc:b@example.invalid']) assert.equal(cateringEmailLink(fixture({ email }), 'Restaurant'), null);
});
