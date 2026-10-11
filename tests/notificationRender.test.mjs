import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer from 'nodemailer';
import { renderNotification } from '../src/lib/reservations/render.ts';
import { renderCateringNotification } from '../src/lib/catering/notification.ts';
import { encryptToken } from '../src/lib/reservations/managementToken.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
process.env.ADMIN_SESSION_SECRET = 'synthetic-test-secret-never-used-outside-tests';
process.env.NEXT_PUBLIC_BASE_URL = 'https://staging.example.invalid';
test('reservation messages use consistent requested/accepted language and escape guest content', () => {
  const job = { event: 'created', recipient: 'guest', reservationId: 'synthetic', encryptedToken: encryptToken('synthetic-token'), restaurant: { ...defaultRestaurant, name: 'Test Restaurant' }, reservation: { name: '<script>alert(1)</script>', email: 'guest@example.invalid', phone: '6505550100', date: '2026-11-01', time: '7:00 PM', guests: 2, comments: '<img src=x onerror=alert(1)>', status: 'pending', restaurantTimezone: 'America/Los_Angeles' } };
  const message = renderNotification(job);
  assert.match(message.subject, /request received.*Test Restaurant/); assert.match(message.text, /still needs to accept/);
  assert.match(message.text, /November 1, 2026/); assert.match(message.text, /America\/Los_Angeles/);
  assert.ok(!message.html.includes('<script>')); assert.ok(!message.html.includes('<img src=x'));
  const accepted = renderNotification({ ...job, event: 'confirmed', reservation: { ...job.reservation, status: 'confirmed' } });
  const automatic = renderNotification({ ...job, reservation: { ...job.reservation, status: 'confirmed' } });
  assert.match(automatic.subject, /Reservation confirmed/); assert.match(automatic.text, /let the restaurant know you are coming/); assert.ok(!automatic.text.includes('still needs to accept'));
  const rescheduled = renderNotification({ ...job, event: 'rescheduled', reservation: { ...job.reservation, status: 'confirmed' } });
  assert.match(rescheduled.subject, /change confirmed/);
  assert.match(accepted.subject, /confirmed/); assert.ok(!accepted.text.includes('still needs to accept'));
});
test('catering email describes an inquiry and keeps untrusted requests as text', () => {
  const message = renderCateringNotification({ recipient: 'guest', inquiry: { name: 'Synthetic <guest>', email: 'guest@example.invalid', date: '2026-11-01', partySize: '20', budget: '$1000', eventType: 'Dinner', selectedDishes: [{ name: '<script>bad</script>' }], specialRequests: '<img src=x>' } }, defaultRestaurant);
  assert.match(message.text, /This is an inquiry/); assert.ok(!message.html.includes('<script>')); assert.match(message.html, /&lt;img/);
});
test('updated mail transport serializes a bounded SMTP message without network delivery', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({ from: 'restaurant@example.invalid', to: 'guest@example.invalid', subject: 'Synthetic booking', text: 'Request saved', messageId: '<synthetic@example.invalid>' });
  assert.deepEqual(result.envelope.to, ['guest@example.invalid']); assert.match(result.message.toString(), /Message-ID: <synthetic@example.invalid>/); assert.match(result.message.toString(), /Request saved/);
  transport.close();
});
