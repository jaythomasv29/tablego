import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { formatReadableDatePST } from '../src/utils/dateUtils.ts';
const filename = new URL('../src/components/reservations/ShareReservation.tsx', import.meta.url), module = { exports: {} };
const normalRequire = createRequire(filename);
runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  module, exports: module.exports, crypto: { randomUUID }, fetch: (...args) => globalThis.fetch(...args), require: name => {
    if (name === '@/components/ui/button') return { Button: props => React.createElement('button', props) };
    if (name === '@/components/ui/input') return { Input: props => React.createElement('input', props) };
    if (name === '@/components/ui/label') return { Label: props => React.createElement('label', props) };
    if (name === '@/components/ui/dialog') return { Dialog: ({ open, children }) => open ? React.createElement('dialog', {}, children) : null,
      DialogContent: props => React.createElement('div', props), DialogTitle: props => React.createElement('h2', props), DialogDescription: props => React.createElement('p', props) };
    if (name === '@/utils/dateUtils') return { formatReadableDatePST };
    return normalRequire(name);
  },
});
async function mount(t, responder, disabled = false, preview = false) {
  const calls = [], notices = [], original = globalThis.fetch;
  globalThis.fetch = async (...args) => { calls.push(args); return responder(...args); };
  let renderer;
  await act(async () => { renderer = create(React.createElement(module.exports.default, {
    id: 'synthetic', token: 'synthetic-private-owner-token', date: '2026-10-15', time: '7:00 PM', guests: 2, timezone: 'America/Los_Angeles', disabled, preview, onQueued: notice => notices.push(notice),
  })); });
  t.after(() => { act(() => renderer.unmount()); globalThis.fetch = original; });
  await act(async () => renderer.root.findByType('button').props.onClick());
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Friend@Example.Invalid' } }));
  return { renderer, calls, notices };
}
const submit = renderer => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
const response = (ok = true) => ({ ok, json: async () => ok ? { success: true, queued: true } : { error: 'An invitation was already queued' } });

test('double submission queues one invitation, locks recipient editing, and reports queued delivery', async t => {
  let finish;
  const state = await mount(t, () => new Promise(resolve => { finish = resolve; }));
  act(() => { submit(state.renderer); submit(state.renderer); });
  assert.equal(state.calls.length, 1); assert.equal(state.renderer.root.findByType('input').props.disabled, true);
  assert.deepEqual(JSON.parse(state.calls[0][1].body), { email: 'friend@example.invalid' });
  assert.equal(state.calls[0][1].headers.Authorization, 'Bearer synthetic-private-owner-token');
  assert.equal(state.calls[0][0], '/api/reservations/synthetic/share');
  await act(async () => finish(response()));
  assert.equal(state.notices.length, 1); assert.match(state.notices[0], /Invitation queued/);
  assert.equal(state.renderer.root.findAllByType('dialog').length, 0);
});

test('a network retry reuses the same invitation key instead of sending twice', async t => {
  let attempt = 0;
  const state = await mount(t, () => { if (++attempt === 1) throw new TypeError('Connection lost'); return response(); });
  await act(async () => submit(state.renderer));
  assert.equal(state.notices.length, 0); assert.equal(state.renderer.root.findByType('input').props.disabled, false);
  await act(async () => submit(state.renderer));
  assert.equal(state.calls.length, 2);
  assert.equal(state.calls[0][1].headers['Idempotency-Key'], state.calls[1][1].headers['Idempotency-Key']);
  assert.equal(state.notices.length, 1);
});

test('server refusal keeps the form open and changing the recipient starts a new invitation', async t => {
  const state = await mount(t, () => response(false));
  await act(async () => submit(state.renderer));
  assert.equal(state.notices.length, 0); assert.equal(state.renderer.root.findAllByType('dialog').length, 1);
  assert.match(state.renderer.root.findByProps({ role: 'alert' }).children.join(''), /already queued/);
  await act(async () => state.renderer.root.findByType('input').props.onChange({ target: { value: 'another@example.invalid' } }));
  await act(async () => submit(state.renderer));
  assert.notEqual(state.calls[0][1].headers['Idempotency-Key'], state.calls[1][1].headers['Idempotency-Key']);
});

test('sharing cannot submit while the owner has another booking action in progress', async t => {
  const state = await mount(t, () => response(), true);
  await act(async () => submit(state.renderer));
  assert.equal(state.calls.length, 0); assert.equal(state.notices.length, 0);
});

test('staging explains that invitations are captured before and after sending', async t => {
  const state = await mount(t, () => response(), false, true);
  assert.match(JSON.stringify(state.renderer.toJSON()), /invitations are captured for testing/);
  await act(async () => submit(state.renderer));
  assert.match(state.notices[0], /no live email will be sent/);
});

test('a changed booking starts a fresh invitation after a failed send instead of reusing an old snapshot', async t => {
  const state = await mount(t, () => response(false));
  await act(async () => submit(state.renderer));
  const props = state.renderer.root.props;
  await act(async () => state.renderer.update(React.createElement(module.exports.default, { ...props, date: '2026-10-16' })));
  await act(async () => submit(state.renderer));
  assert.equal(state.calls.length, 2);
  assert.notEqual(state.calls[0][1].headers['Idempotency-Key'], state.calls[1][1].headers['Idempotency-Key']);
});
