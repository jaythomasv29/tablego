import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as domain from '../src/lib/reservations/domain.ts';
import * as availability from '../src/lib/reservations/availability.ts';
import * as changes from '../src/lib/reservations/guestChanges.ts';
const filename = new URL('../src/components/ManageReservation.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const reservation = { id: 'synthetic', name: 'Synthetic Guest', date: '2026-11-15', time: '7:00 PM', guests: 2, comments: 'Window seat', status: 'confirmed', guestAcknowledged: true, version: 1, timezone: 'America/Los_Angeles', autoConfirmReservations: true };
const wrap = tag => ({ children, ...props }) => React.createElement(tag, props, children);
async function mount(t, { fail = false, available = true } = {}) {
  const module = { exports: {} }, requests = [], require = createRequire(filename);
  const modules = {
    '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: { name: 'Test Restaurant', shortName: 'Test', location: 'Test City', address: 'Test Address', phone: '6505550100', phoneLabel: '6505550100' } }) },
    'next/link': { default: wrap('a') },
    '@/components/ui/button': { Button: wrap('button') }, '@/components/ui/input': { Input: wrap('input') }, '@/components/ui/textarea': { Textarea: wrap('textarea') }, '@/components/ui/label': { Label: wrap('label') },
    '@/components/ui/card': Object.fromEntries(['Card', 'CardContent', 'CardHeader', 'CardTitle'].map(name => [name, wrap('div')])),
    '@/components/ui/dialog': { Dialog: ({ children, open }) => open ? React.createElement('div', {}, children) : null, DialogTrigger: () => null, DialogContent: wrap('div'), DialogTitle: wrap('h2'), DialogDescription: wrap('p') },
    '@/utils/dateUtils': { formatReadableDatePST: value => value }, '@/lib/reservations/domain': domain, '@/lib/reservations/availability': availability, '@/lib/reservations/guestChanges': changes,
    '@/components/reservations/ReservationMoment': { default: () => null }, '@/components/reservations/ShareReservation': { default: () => null },
    'lucide-react': Object.fromEntries(['CalendarDays', 'Clock', 'Users', 'MapPin', 'ArrowUpRight'].map(name => [name, () => null])),
  };
  runInNewContext(compiled, { module, exports: module.exports, require: name => modules[name] || require(name), URLSearchParams, AbortController, process: { env: {} }, window: { location: { hash: '#token=synthetic-private-token' } },
    fetch: async (url, options = {}) => {
      if (url.includes('/availability/')) return { ok: available, json: async () => available ? { slots: [] } : { error: 'Unavailable' } };
      if (options.method !== 'POST') return { ok: true, json: async () => ({ reservation }) };
      const body = JSON.parse(options.body); requests.push(body);
      return { ok: !fail, json: async () => fail ? { error: 'Reservation changed. Reload before trying again.' } : { reservation: { ...reservation, ...body, status: body.action === 'cancel' ? 'cancelled' : 'confirmed', version: 2 } } };
    },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(module.exports.default, { id: 'synthetic', initialAction: 'reschedule' })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = text => renderer.root.findAllByType('button').find(node => node.props.children === text);
  const change = async (id, value) => { await act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); }); };
  return { renderer, requests, button, change, submit };
}
test('guests can change party size and clear requests while keeping a booked time absent from new slots', async t => {
  const state = await mount(t);
  assert.equal(state.button('Save changes').props.disabled, false);
  assert.equal(state.renderer.root.findByProps({ id: 'new-time' }).props.value, '7:00 PM');
  await state.change('new-guests', '4'); await state.change('new-comments', ''); await state.submit();
  assert.deepEqual(state.requests[0], { action: 'reschedule', version: 1, date: '2026-11-15', time: '7:00 PM', guests: 4, comments: '' });
  assert.match(JSON.stringify(state.renderer.toJSON()), /Your change is saved and confirmed/);
});
test('failed edits retain the guest draft and availability outages do not block details-only changes', async t => {
  const state = await mount(t, { fail: true, available: false });
  assert.equal(state.button('Save changes').props.disabled, false);
  await state.change('new-comments', 'Vegetarian'); await state.submit();
  assert.equal(state.renderer.root.findByProps({ id: 'new-comments' }).props.value, 'Vegetarian');
  assert.match(JSON.stringify(state.renderer.toJSON()), /Reload before trying again/);
  await act(async () => state.button('Keep current booking').props.onClick());
  await act(async () => state.button('Edit reservation').props.onClick());
  assert.equal(state.renderer.root.findByProps({ id: 'new-comments' }).props.value, 'Window seat');
});
test('Other cancellation requires a typed reason and sends it with the saved version', async t => {
  const state = await mount(t);
  const dialog = state.renderer.root.findAll(node => typeof node.props.onOpenChange === 'function')[0];
  await act(async () => dialog.props.onOpenChange(true));
  assert.equal(state.renderer.root.findByProps({ id: 'cancellation-reason' }).findAllByType('option').length, 6);
  await state.change('cancellation-reason', 'other');
  assert.equal(state.button('Yes, cancel reservation').props.disabled, true);
  await state.change('cancellation-details', 'Flight delayed');
  assert.equal(state.button('Yes, cancel reservation').props.disabled, false);
  await act(async () => { await state.button('Yes, cancel reservation').props.onClick(); });
  assert.deepEqual(state.requests[0], { action: 'cancel', version: 1, cancellationReasonCode: 'other', cancellationReasonDetails: 'Flight delayed' });
});
