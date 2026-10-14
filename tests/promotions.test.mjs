import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activePromotions, promotions } from '../src/lib/mailing/promotion.ts';
test('current offers include the supplied local lunch perk and verified daily Happy Hour', () => {
  const offers = activePromotions('America/Los_Angeles', new Date('2026-10-14T22:00:00Z'));
  assert.equal(offers.length, 2); const lunch = offers.find(offer => offer.flyerUrl);
  assert.equal(lunch.title, '10% off lunch'); assert.equal(lunch.endsOn, '2026-12-12');
  assert.match(lunch.description, /local employee badge or business card/); assert.match(lunch.qualification, /non-alcoholic/);
  assert.match(lunch.terms, /takeout, online orders, third-party delivery/); assert.match(lunch.terms, /happy hour/); assert.match(lunch.terms, /Cannot be combined/);
  assert.equal(offers.find(offer => offer.label === 'Happy Hour').title, 'Every day, 4–6 PM');
});
test('lunch offer remains through December 12 locally and expires after restaurant midnight for every viewer timezone', () => {
  const original = process.env.TZ;
  try {
    for (const viewer of ['America/Los_Angeles', 'Pacific/Honolulu', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney']) {
      process.env.TZ = viewer;
      assert.equal(activePromotions('America/Los_Angeles', new Date('2026-12-13T07:59:59Z')).length, 2, viewer);
      const expired = activePromotions('America/Los_Angeles', new Date('2026-12-13T08:00:00Z'));
      assert.equal(expired.length, 1, viewer); assert.equal(expired[0].label, 'Happy Hour');
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  assert.equal(promotions.length, 2, 'filtering must not mutate configured offers');
});
