import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { marketingCopy, marketingTestMessage } from '../src/lib/marketing/render.ts';
import { restaurantIdentity } from '../src/lib/restaurant/config.ts';
const require = createRequire(import.meta.url);
const config = { restaurant: restaurantIdentity({}), baseUrl: 'https://example.com', configurationVersion: 'a'.repeat(64) };
async function mount(t, responder) {
  const calls = [], closed = [];
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/marketing/MarketingTestModal.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, Error, AbortController, crypto: { randomUUID }, setTimeout: () => 1, clearTimeout: () => {}, encodeURIComponent,
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      if (options.method === 'POST') return responder ? responder() : { ok: true, json: async () => ({ id: 'marketing-test-synthetic', state: 'queued' }) };
      return { ok: true, json: async () => url.includes('?id=') ? { state: 'delivered', deliveryMode: 'capture' } : config };
    },
    require: name => {
      if (name === '@/lib/marketing/render') return { marketingCopy, marketingTestMessage };
      if (name === 'lucide-react') return Object.fromEntries(['Mail', 'Send', 'CheckCircle2'].map(name => [name, props => React.createElement('svg', props)]));
      if (name === '@/components/ui/button') return { Button: props => React.createElement('button', props) };
      if (name === '@/components/ui/input') return { Input: props => React.createElement('input', props) };
      if (name === '@/components/ui/label') return { Label: props => React.createElement('label', props) };
      if (name === '@/components/ui/dialog') return { Dialog: ({ children }) => React.createElement('dialog', {}, children), DialogContent: props => React.createElement('div', props), DialogTitle: props => React.createElement('h2', props), DialogDescription: props => React.createElement('p', props) };
      return require(name);
    },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(module.exports.default, { initialKind: 'reservation', onClose: () => closed.push(true) })); });
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls, closed };
}
const submit = renderer => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
const change = async (renderer, id, value) => act(async () => renderer.root.findByProps({ id }).props.onChange({ target: { value } }));
test('test modal opens with blank fields, a sandboxed preview, and never sends merely by opening or editing', async t => {
  const { renderer, calls } = await mount(t);
  assert.equal(renderer.root.findByProps({ id: 'test-email' }).props.value, '');
  assert.equal(renderer.root.findByProps({ id: 'test-name' }).props.value, '');
  assert.equal(renderer.root.findByType('iframe').props.sandbox, '');
  assert.ok(renderer.root.findByType('iframe').props.srcDoc.includes('Hello Guest'));
  await change(renderer, 'test-name', '<Boss>');
  await change(renderer, 'test-kind', 'catering');
  const html = renderer.root.findByType('iframe').props.srcDoc;
  assert.ok(html.includes('&lt;Boss&gt;')); assert.ok(html.includes('next team lunch'));
  assert.equal(calls.filter(call => call.method === 'POST').length, 0);
});
test('explicit test send posts exactly one recipient, locks duplicate clicks, and reports captured delivery', async t => {
  let finish;
  const { renderer, calls } = await mount(t, () => new Promise(resolve => { finish = resolve; }));
  await change(renderer, 'test-email', 'boss@example.com');
  act(() => { submit(renderer); submit(renderer); });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(renderer.root.findByType('fieldset').props.disabled, true);
  const sent = JSON.parse(calls.find(call => call.method === 'POST').body);
  assert.equal(sent.email, 'boss@example.com'); assert.equal(sent.name, ''); assert.equal(sent.kind, 'reservation');
  assert.equal(sent.configurationVersion, config.configurationVersion); assert.ok(sent.key);
  await act(async () => finish({ ok: true, json: async () => ({ id: 'marketing-test-synthetic', state: 'queued' }) }));
  assert.ok(JSON.stringify(renderer.toJSON()).includes('Test captured'));
  assert.ok(!calls.some(call => call.url === '/api/staff/marketing'));
});
test('a failed network response preserves the request key on retry', async t => {
  let attempt = 0;
  const { renderer, calls } = await mount(t, () => { if (++attempt === 1) throw Error('Connection interrupted'); return { ok: true, json: async () => ({ id: 'marketing-test-synthetic' }) }; });
  await change(renderer, 'test-email', 'boss@example.com');
  await act(async () => submit(renderer));
  assert.ok(JSON.stringify(renderer.toJSON()).includes('Connection interrupted'));
  await act(async () => submit(renderer));
  const posts = calls.filter(call => call.method === 'POST').map(call => JSON.parse(call.body));
  assert.equal(posts.length, 2); assert.equal(posts[0].key, posts[1].key);
});
