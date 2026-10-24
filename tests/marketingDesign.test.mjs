import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingCopy, marketingTestMessage, renderMarketingNotification } from '../src/lib/marketing/render.ts';
import { restaurantIdentity } from '../src/lib/restaurant/config.ts';
const restaurant = restaurantIdentity({});
const candidate = kind => ({ id: 'synthetic', kind, name: 'Alex & Family', email: 'alex@example.invalid', lastDate: '2026-01-01', inactiveDays: 50 });
test('reservation and catering designs have matching branded envelopes and distinct working calls to action', () => {
  for (const kind of ['reservation', 'catering']) {
    const guest = candidate(kind), copy = marketingCopy(guest, restaurant, 'https://example.com');
    const email = renderMarketingNotification({ candidate: guest, ...copy, unsubscribeUrl: 'https://example.com/marketing/unsubscribe?key=synthetic&token=synthetic' });
    assert.ok(email.html.startsWith('<!DOCTYPE html>'));
    assert.ok(email.html.includes('role="presentation"'));
    assert.ok(email.html.includes('Hello Alex &amp; Family,'));
    assert.ok(email.html.includes(restaurant.address));
    assert.ok(email.html.includes(`href="https://example.com/${kind === 'catering' ? 'cater' : 'reservation'}"`));
    assert.ok(email.html.includes('href="https://example.com/menu"'));
    assert.ok(email.html.includes(`href="tel:${restaurant.phone}"`));
    assert.ok(email.html.includes('Unsubscribe from restaurant marketing emails'));
    assert.ok(email.text.includes(copy.body));
    const preview = marketingTestMessage(copy);
    assert.ok(preview.html.includes(copy.design.actionLabel));
    assert.ok(preview.html.includes(copy.design.featureTitle));
    assert.ok(preview.html.includes('TEST PREVIEW'));
    assert.ok(!preview.html.includes('/marketing/unsubscribe'));
  }
});
test('approved design keeps its restaurant identity and links even if settings change later', () => {
  const settings = { ...restaurant };
  const copy = marketingCopy(candidate('reservation'), settings, 'https://original.example');
  settings.name = 'Later restaurant name'; settings.phone = '+15555555555'; settings.address = 'Later address';
  const result = marketingTestMessage(copy);
  assert.ok(result.html.includes(restaurant.name));
  assert.ok(result.html.includes(restaurant.address));
  assert.ok(result.html.includes('https://original.example/reservation'));
  assert.ok(!result.html.includes('Later restaurant name'));
});
test('legacy queued messages preserve their approved body without requiring a design snapshot', () => {
  const message = renderMarketingNotification({ candidate: candidate('reservation'), subject: 'Existing subject', body: 'Previously approved <message>', unsubscribeUrl: 'https://example.com/preferences' });
  assert.ok(message.html.includes('Previously approved &lt;message&gt;'));
  assert.equal(message.subject, 'Existing subject');
  assert.ok(message.text.startsWith('Previously approved <message>'));
});
test('email design escapes restaurant and guest text and rejects unsafe CTA protocols', () => {
  const copy = marketingCopy({ kind: 'catering', name: '<script>bad</script>' }, { ...restaurant, shortName: '<img onerror="bad">' }, 'https://example.com');
  copy.design.actionUrl = 'javascript:alert(1)';
  const html = marketingTestMessage(copy).html;
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror='));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('href="javascript:'));
});
