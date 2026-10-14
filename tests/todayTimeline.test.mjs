import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as service from '../src/lib/reservations/service.ts';
import * as availability from '../src/lib/reservations/availability.ts';
import * as domain from '../src/lib/reservations/domain.ts';
import * as dates from '../src/utils/dateUtils.ts';

test('Today renders one chronological list and refreshes its passed-time cue without changing attendance', async t => {
  const filename = new URL('../src/components/service/ServiceConsole.tsx', import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  let instant = '2026-10-11T01:59:59Z';
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
  const bookings = [
    ['later', '8:00 PM', 'pending'], ['waiting', '7:00 PM', 'confirmed'],
    ['cancelled', '6:30 PM', 'cancelled'], ['seated', '6:00 PM', 'seated'],
  ].map(([id, time, status]) => service.serviceReservation(id, { name: id, date: '2026-10-10', time, status, guests: 2 }, 'America/Los_Angeles'));
  const snapshot = structuredClone(bookings);
  const require = createRequire(filename), module = { exports: {} }, timers = [];
  const component = tag => ({ children, ...props }) => React.createElement(tag, props, children);
  const defaultExport = value => ({ __esModule: true, default: value });
  const imports = {
    'next/link': defaultExport(component('a')),
    '@/components/AdminLayout': defaultExport(component('main')),
    '@/components/ui/button': { Button: component('button') },
    '@/components/ui/input': { Input: component('input') },
    '@/components/ui/label': { Label: component('label') },
    '@/components/ui/dialog': { Dialog: ({ open, children }) => open ? children : null,
      DialogContent: component('div'), DialogTitle: component('h2'), DialogDescription: component('p') },
    '@/lib/reservations/service': service, '@/lib/reservations/domain': domain,
    '@/lib/reservations/availability': availability, '@/utils/dateUtils': dates,
    './useReservations': { useReservations: () => ({ bookings, timezone: 'America/Los_Angeles', synced: true, loading: false, error: '' }) },
    '@/components/PhoneNumber': defaultExport(() => null),
  };
  for (const name of ['@/components/ReservationActions', './TodaySummary', './BookingDetails', './DeliverySummary', '@/components/NotificationStatus', './ReservationActivity']) imports[name] = defaultExport(() => null);
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name),
    Date: ClockDate, AbortController, setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval() {},
    fetch: async () => ({ ok: true, json: async () => ({ smsReminders: { available: false, reason: 'Unavailable' } }) }),
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(module.exports.default, { today: true })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(renderer.root.findByType('h1').props.children, 'Today');
  assert.equal(renderer.root.findAllByType('h2').length, 0, 'there are no separate arrival/later/status sections');
  const rows = () => renderer.root.findAllByType('article');
  assert.deepEqual(rows().map(row => row.findByType('h3').props.children), ['seated', 'cancelled', 'waiting', 'later']);
  const passed = () => renderer.root.findAllByType('span').filter(node => node.props.children === 'Time passed');
  assert.equal(passed().length, 0);
  instant = '2026-10-11T02:00:00Z';
  await act(async () => timers[0]());
  assert.equal(passed().length, 0);
  instant = '2026-10-11T02:00:01Z';
  await act(async () => timers[0]());
  assert.equal(passed().length, 1);
  assert.equal(passed()[0].parent.parent.findByType('h3').props.children, 'waiting');
  assert.match(rows()[2].props.className, /border-amber/);
  assert.deepEqual(bookings, snapshot, 'time passing must not mark guests seated or no-show');
});
