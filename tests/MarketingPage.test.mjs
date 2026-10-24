import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const filename = new URL('../src/app/admin/marketing/page.tsx', import.meta.url);
const normalRequire = createRequire(filename);
const guests = [1, 2].map(number => ({ id: String(number).repeat(64), name: `Guest ${number}`, email: `guest${number}@example.com`, kind: 'reservation', lastDate: '2026-01-01', inactiveDays: 100, previewHash: 'preview-version', subject: 'Welcome back', body: `Hello guest ${number}` }));
async function mount(t, fail = false) {
  const calls = [];
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, Date,
    fetch: async (url, options = {}) => { calls.push({ url, ...options }); return { ok: !fail || options.method !== 'POST', json: async () => options.method === 'POST' ? fail ? { error: 'Selection is stale; refresh.' } : { queued: 2 } : { candidates: guests, history: [], today: '2026-10-23' } }; },
    require: name => {
      if (name === '@/components/AdminLayout') return { __esModule: true, default: ({ children }) => React.createElement('div', {}, children) };
      if (name === '@/components/ui/button') return { Button: props => React.createElement('button', props) };
      if (name === '@/components/ui/dialog') return { Dialog: ({ open, children }) => open ? React.createElement('dialog', {}, children) : null,
        DialogContent: props => React.createElement('div', props), DialogTitle: props => React.createElement('h2', props), DialogDescription: props => React.createElement('p', props) };
      if (name === '@/utils/dateUtils') return { formatDateForDisplay: value => value };
      return normalRequire(name);
    },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(module.exports.default)); });
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls };
}
const button = (renderer, label) => renderer.root.findAllByType('button').find(item => item.children.join('').includes(label));
test('loading and previewing individual emails never sends; closing preserves the queue', async t => {
  const { renderer, calls } = await mount(t);
  assert.equal(calls.filter(call => call.method === 'POST').length, 0);
  await act(async () => button(renderer, 'Review email').props.onClick());
  assert.ok(renderer.root.findByType('dialog'));
  assert.equal(calls.filter(call => call.method === 'POST').length, 0);
  await act(async () => button(renderer, 'Keep for later').props.onClick());
  assert.equal(renderer.root.findAllByType('dialog').length, 0);
  assert.equal(calls.length, 1);
});
test('batch review lists recipients and approval posts only selected IDs', async t => {
  const { renderer, calls } = await mount(t);
  await act(async () => renderer.root.findAllByType('input')[0].props.onChange({ target: { checked: true } }));
  await act(async () => button(renderer, 'Review selected').props.onClick());
  assert.ok(JSON.stringify(renderer.toJSON()).includes('guest1@example.com'));
  assert.ok(JSON.stringify(renderer.toJSON()).includes('guest2@example.com'));
  assert.equal(calls.length, 1);
  await act(async () => button(renderer, 'Approve & send').props.onClick());
  const posts = calls.filter(call => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(posts[0].body), { ids: guests.map(item => item.id), action: 'approve', previews: Object.fromEntries(guests.map(item => [item.id, item.previewHash])) });
  assert.equal(renderer.root.findAllByType('dialog').length, 0);
});
test('stale approval remains open and reports the server error', async t => {
  const { renderer } = await mount(t, true);
  await act(async () => button(renderer, 'Review email').props.onClick());
  await act(async () => button(renderer, 'Approve & send').props.onClick());
  assert.ok(renderer.root.findByType('dialog'));
  assert.ok(JSON.stringify(renderer.toJSON()).includes('Selection is stale; refresh.'));
});
test('dismissal is explicitly separate from approving a send', async t => {
  const { renderer, calls } = await mount(t);
  await act(async () => button(renderer, 'Review email').props.onClick());
  await act(async () => button(renderer, 'Dismiss follow-up').props.onClick());
  assert.equal(JSON.parse(calls.find(call => call.method === 'POST').body).action, 'dismiss');
});
