import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as catering from '../src/lib/catering/admin.ts';
import * as dates from '../src/utils/dateUtils.ts';
const wrap = tag => ({ children, ...props }) => React.createElement(tag, props, children);
const lead = catering.cateringLead('synthetic', { name: 'Synthetic Catering', email: 'catering@example.invalid', phone: '+16505550100', date: '2026-11-15', partySize: '35', budget: '$1500', address: 'Test Hall', specialRequests: 'Guest original request', selectedDishes: ['Pad Thai'], followUpDate: '2026-10-12', status: 'pending' }, 'America/Los_Angeles');
const imports = {
  '@/components/ui/button': { Button: wrap('button') }, '@/components/ui/input': { Input: wrap('input') }, '@/components/ui/textarea': { Textarea: wrap('textarea') }, '@/components/ui/label': { Label: wrap('label') },
  '@/components/ui/dialog': { Dialog: ({ children, ...props }) => React.createElement('dialog', props, children), DialogContent: wrap('section'), DialogTitle: wrap('h1'), DialogDescription: wrap('p') },
  '@/components/PhoneNumber': { default: ({ phone }) => React.createElement('span', {}, phone) }, '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: { name: 'Test Restaurant' } }) },
  '@/utils/dateUtils': dates, '@/lib/catering/admin': catering, './CateringStage': { default: ({ status }) => React.createElement('span', {}, catering.cateringStatusLabels[status]) }, './CateringDetails': { default: () => null }, './BulkCloseCatering': { default: () => null },
  'lucide-react': Object.fromEntries(['Mail', 'CalendarDays', 'MapPin', 'Users', 'ChevronRight', 'Inbox', 'RefreshCw', 'Search', 'Clock3'].map(name => [name, () => null])),
};
async function mount(t, component, fetch) {
  const filename = new URL(`../src/components/catering/${component}.tsx`, import.meta.url), module = { exports: {} }, require = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name), fetch, AbortController, document: { visibilityState: 'visible' }, window: { setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {} } });
  const saves = [], closes = [], bulkClosed = [];
  let renderer; await act(async () => { renderer = create(React.createElement(module.exports.default, { id: 'synthetic', timezone: 'America/Los_Angeles', onSaved: item => saves.push(item), onClose: () => closes.push(true), disabled: false, onClosed: ids => bulkClosed.push(ids) })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = text => renderer.root.findAllByType('button').find(node => node.props.children === text);
  const change = async (id, value) => { await act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); };
  return { renderer, saves, closes, bulkClosed, button, change, submit };
}
test('stale catering saves retain the draft and protect unsaved-close actions', async t => {
  const requests = [];
  const state = await mount(t, 'CateringDetails', async (url, options = {}) => {
    if (options.method === 'PATCH') { requests.push(JSON.parse(options.body)); return { ok: false, json: async () => ({ error: 'Another staff member changed this inquiry. Your draft is kept.' }) }; }
    return { ok: true, json: async () => ({ lead, events: [] }) };
  });
  await state.change('catering-stage', 'contacted'); await state.change('catering-notes', 'Call tomorrow'); await state.submit();
  assert.equal(state.renderer.root.findByProps({ id: 'catering-notes' }).props.value, 'Call tomorrow'); assert.equal(state.saves.length, 0); assert.equal(requests[0].originalStatus, 'pending'); assert.equal(requests[0].version, 1);
  assert.match(JSON.stringify(state.renderer.toJSON()), /Your draft is kept/);
  await act(async () => state.button('Close inquiry').props.onClick()); assert.equal(state.closes.length, 0);
  assert.ok(state.button('Keep editing')); await act(async () => state.button('Keep editing').props.onClick());
  await act(async () => state.renderer.root.findByType('dialog').props.onOpenChange(false)); assert.equal(state.closes.length, 0);
  await act(async () => state.button('Discard and close').props.onClick()); assert.equal(state.closes.length, 1);
});
test('closing a catering lead clears follow-up and saves private staff fields separately from guest details', async t => {
  let current = lead; const requests = [];
  const state = await mount(t, 'CateringDetails', async (url, options = {}) => {
    if (options.method === 'PATCH') { const body = JSON.parse(options.body); requests.push(body); current = { ...current, ...body, version: 2 }; return { ok: true, json: async () => ({ lead: current, changed: true }) }; }
    return { ok: true, json: async () => ({ lead: current, events: [] }) };
  });
  await state.change('catering-stage', 'declined');
  assert.equal(state.renderer.root.findByProps({ id: 'catering-follow-up' }).props.value, ''); assert.equal(state.renderer.root.findByProps({ id: 'catering-follow-up' }).props.disabled, true);
  await state.change('catering-notes', 'Guest decided not to proceed'); await state.submit();
  assert.equal(requests[0].followUpDate, ''); assert.ok(!Object.hasOwn(requests[0], 'specialRequests')); assert.equal(state.saves[0].specialRequests, 'Guest original request');
  assert.match(JSON.stringify(state.renderer.toJSON()), /no customer message was sent/); assert.equal(state.button('Save inquiry').props.disabled, true);
});
test('catering load failures show an explicit retry rather than an empty inbox', async t => {
  const state = await mount(t, 'CateringInbox', async () => ({ ok: false, status: 503, json: async () => ({ error: 'Service unavailable' }) }));
  const rendered = JSON.stringify(state.renderer.toJSON()); assert.match(rendered, /Service unavailable/); assert.ok(state.button('Retry loading inquiries')); assert.doesNotMatch(rendered, /Your catering inbox is ready/);
});
test('a cleared active inbox keeps closed inquiries available and disables another reset', async t => {
  const state = await mount(t, 'CateringInbox', async () => ({ ok: true, json: async () => ({ timezone: 'America/Los_Angeles', leads: [{ ...lead, status: 'completed', followUpDate: '' }] }) }));
  assert.match(JSON.stringify(state.renderer.toJSON()), /Your active inbox is clear/); assert.ok(state.button('View closed inquiries'));
  assert.equal(state.renderer.root.findByType(imports['./BulkCloseCatering'].default).props.disabled, true);
  await act(async () => state.button('View closed inquiries').props.onClick()); assert.match(JSON.stringify(state.renderer.toJSON()), /Synthetic Catering/);
});
const bulkPreview = { operationId: 'synthetic-operation', timezone: 'America/Los_Angeles', totalActive: 2, limit: 100, items: [{ id: 'a', name: 'Synthetic New', date: '2026-11-15', status: 'pending' }, { id: 'b', name: 'Synthetic Confirmed', date: '2026-11-16', status: 'confirmed' }] };
test('bulk catering review requires an explicit confirmation and cancel never closes inquiries', async t => {
  const requests = [];
  const state = await mount(t, 'BulkCloseCatering', async (url, options) => { const body = JSON.parse(options.body); requests.push(body); return { ok: true, json: async () => body.action === 'preview' ? bulkPreview : { ids: ['a', 'b'] } }; });
  await act(async () => state.button('Close all active inquiries').props.onClick()); assert.deepEqual(requests, [{ action: 'preview' }]); assert.match(state.renderer.root.findAllByType('p').map(node => [].concat(node.props.children).join('')).join(' '), /Includes 1 confirmed/);
  await act(async () => state.button('Keep inquiries').props.onClick()); assert.equal(requests.length, 1); assert.equal(state.bulkClosed.length, 0);
  await act(async () => state.button('Close all active inquiries').props.onClick()); await act(async () => state.button('Mark 2 completed').props.onClick()); assert.deepEqual(requests.at(-1), { action: 'confirm', operationId: bulkPreview.operationId }); assert.deepEqual(state.bulkClosed[0], ['a', 'b']);
});
test('a stale bulk review asks for a new review without leaving a stale confirmation button', async t => {
  const state = await mount(t, 'BulkCloseCatering', async (url, options) => JSON.parse(options.body).action === 'preview' ? { ok: true, json: async () => bulkPreview } : { ok: false, status: 409, json: async () => ({ error: 'Some inquiries changed. Nothing was closed.' }) });
  await act(async () => state.button('Close all active inquiries').props.onClick()); await act(async () => state.button('Mark 2 completed').props.onClick()); assert.ok(state.button('Review again')); assert.equal(state.button('Mark 2 completed'), undefined); assert.equal(state.bulkClosed.length, 0);
});
test('network errors retain the same bulk operation for a safe retry', async t => {
  const requests = []; let attempt = 0;
  const state = await mount(t, 'BulkCloseCatering', async (url, options) => { const body = JSON.parse(options.body); requests.push(body); if (body.action === 'preview') return { ok: true, json: async () => bulkPreview }; if (!attempt++) throw new TypeError('Failed to fetch'); return { ok: true, json: async () => ({ ids: ['a', 'b'], repeated: true }) }; });
  await act(async () => state.button('Close all active inquiries').props.onClick()); await act(async () => state.button('Mark 2 completed').props.onClick()); assert.equal(state.bulkClosed.length, 0); await act(async () => state.button('Mark 2 completed').props.onClick()); assert.deepEqual(requests[1], requests[2]); assert.equal(state.bulkClosed.length, 1);
});
