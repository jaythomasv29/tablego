import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as activity from '../src/lib/reservations/activity.ts';

const filename = new URL('../src/components/service/ReservationActivity.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const Open = React.createContext(false);
const Root = ({ open, children }) => React.createElement(Open.Provider, { value: open }, children);
const Pass = ({ children }) => children;
const Content = ({ children, ...props }) => React.useContext(Open) ? React.createElement('section', props, children) : null;
const booking = (id, minute = 0) => ({ id, createdAt: `2026-10-12T08:${String(minute).padStart(2, '0')}:00Z`, name: 'Synthetic Guest', status: 'confirmed', date: '2026-11-15', time: '7:00 PM', guests: 2 });

async function mount(t, bookings, { saved = new Map(), synced = true } = {}) {
  const module = { exports: {} }, listeners = new Map();
  const imports = {
    'radix-ui': { Popover: { Root, Trigger: Pass, Portal: Pass, Content, Close: Pass } },
    '@/components/ui/button': { Button: props => React.createElement('button', props) },
    '@/lib/reservations/activity': activity,
    '@/lib/reservations/domain': { statusLabels: { confirmed: 'Confirmed' } },
    '@/utils/dateUtils': { formatReadableDatePST: value => value, formatBusinessTimestamp: value => value },
  };
  const require = createRequire(filename);
  runInNewContext(compiled, {
    module, exports: module.exports, require: name => imports[name] || require(name),
    process: { env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'synthetic' } },
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    window: { addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type) },
  });
  const Component = module.exports.default;
  let renderer, props = { bookings, synced, timezone: 'America/Los_Angeles' };
  await act(async () => { renderer = create(React.createElement(Component, props)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return {
    renderer, saved,
    label: () => renderer.root.findAllByType('button')[0].props['aria-label'],
    update: async changes => { props = { ...props, ...changes }; await act(async () => renderer.update(React.createElement(Component, props))); },
    open: async value => { await act(async () => renderer.root.findByType(Root).props.onOpenChange(value)); },
    storage: async marker => { await act(async () => listeners.get('storage')({ key: 'tablego:reservation-activity:v1:synthetic', newValue: JSON.stringify(marker) })); },
  };
}

test('the popup automatically clears new activity, persists across navigation and stays read while open', async t => {
  const initial = booking('initial'), fresh = booking('fresh', 1);
  const state = await mount(t, [initial]);
  assert.match(state.label(), /up to date/);
  await state.update({ bookings: [initial, fresh] });
  assert.match(state.label(), /1 new reservation/);
  await state.open(true);
  assert.match(state.label(), /up to date/);
  assert.match(JSON.stringify(state.renderer.toJSON()), /Synthetic Guest/);
  await state.update({ bookings: [initial, fresh, booking('during-open', 2)] });
  assert.match(state.label(), /up to date/);
  await state.open(false);
  await state.open(true);
  assert.doesNotMatch(JSON.stringify(state.renderer.toJSON()), /Synthetic Guest/);
  await state.open(false);
  const remount = await mount(t, [initial, fresh, booking('during-open', 2)], { saved: state.saved });
  assert.match(remount.label(), /up to date/);
  await remount.update({ bookings: [initial, fresh, booking('during-open', 2), booking('after-close', 3)] });
  assert.match(remount.label(), /1 new reservation/);
});

test('cached snapshots cannot clear unseen activity or establish the first baseline', async t => {
  const initial = booking('initial');
  const state = await mount(t, [], { synced: false });
  assert.equal(state.saved.size, 0);
  await state.update({ bookings: [initial], synced: true });
  await state.update({ bookings: [initial, booking('fresh', 1)], synced: false });
  const before = [...state.saved.values()][0];
  await state.open(true);
  assert.equal([...state.saved.values()][0], before);
  await state.update({ synced: true });
  assert.match(state.label(), /up to date/);
});

test('reading activity in another tab clears its badge without modifying bookings', async t => {
  const initial = booking('initial'), fresh = booking('fresh', 1), records = [initial, fresh];
  const state = await mount(t, [initial]);
  await state.update({ bookings: records });
  assert.match(state.label(), /1 new reservation/);
  await state.storage(activity.readReservationActivity(records, null));
  assert.match(state.label(), /up to date/);
  assert.equal(records[1].status, 'confirmed');
});
