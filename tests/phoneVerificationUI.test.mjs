import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const filename = new URL('../src/components/PhoneVerificationField.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

async function mount(t, verify = async () => ({ success: true, valid: true })) {
  const module = { exports: {} }, requests = [], confirmations = [];
  const require = createRequire(filename);
  runInNewContext(compiled, { module, exports: module.exports, require: name => name === './PhoneNumber' ? { PhoneVerifiedBadge: ({ verified }) => verified ? React.createElement('span', { 'aria-label': 'Phone number verified' }, 'Verified') : null } : require(name),
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      const data = url === '/api/otp/send' ? { success: true, codeLength: 6 } : await verify();
      return { ok: data.success !== false, json: async () => data };
    },
  });
  const Component = module.exports.default;
  let renderer, props;
  const update = async changes => { props = { ...props, ...changes }; await act(async () => renderer.update(React.createElement(Component, props))); };
  props = { phone: '6505550100', verified: false, onChange: phone => { props = { ...props, phone }; renderer.update(React.createElement(Component, props)); }, onVerified: verified => { confirmations.push(verified); props = { ...props, verified }; renderer.update(React.createElement(Component, props)); } };
  await act(async () => { renderer = create(React.createElement(Component, props)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = text => renderer.root.findAllByType('button').find(button => JSON.stringify(button.props.children).includes(text));
  const send = async () => { await act(async () => { await button('Send code').props.onClick(); }); };
  const enter = async value => { await act(async () => renderer.root.findAllByType('input').find(input => input.props.autoComplete === 'one-time-code').props.onChange({ target: { value } })); };
  return { renderer, requests, confirmations, update, button, send, enter };
}

test('catering verification follows the provider code length and resets when the number changes', async t => {
  const state = await mount(t);
  await state.send();
  await state.enter('12');
  assert.equal(state.button('Verify code').props.disabled, true);
  await state.enter('123456');
  await act(async () => { await state.button('Verify code').props.onClick(); });
  assert.deepEqual(state.requests.at(-1).body, { phone: '6505550100', code: '123456' });
  assert.equal(state.confirmations.at(-1), true);
  await state.update({ phone: '6505550101' });
  assert.equal(state.confirmations.at(-1), false);
  assert.ok(state.button('Send code'));
  assert.doesNotMatch(JSON.stringify(state.renderer.toJSON()), /Phone number verified/);
});

test('an expired catering code gives recovery instructions and never verifies the number', async t => {
  const state = await mount(t, async () => ({ success: false, error: 'Code expired or no longer active. Request a new code.' }));
  await state.send(); await state.enter('123456');
  await act(async () => { await state.button('Verify code').props.onClick(); });
  assert.equal(state.confirmations.includes(true), false);
  assert.match(JSON.stringify(state.renderer.toJSON()), /Request a new code/);
  assert.equal(state.renderer.root.findAllByType('input').find(input => input.props.autoComplete === 'one-time-code').props.value, '');
});

test('a late verification response cannot verify a changed phone number', async t => {
  let finish;
  const state = await mount(t, () => new Promise(resolve => { finish = resolve; }));
  await state.send(); await state.enter('123456');
  let checking;
  await act(async () => { checking = state.button('Verify code').props.onClick(); });
  await state.update({ phone: '6505550101' });
  await act(async () => { finish({ success: true, valid: true }); await checking; });
  assert.equal(state.confirmations.includes(true), false);
  assert.equal(state.button('Send code').props.disabled, false);
});
