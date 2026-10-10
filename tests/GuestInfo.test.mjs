import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

// Compile the real component without importing the application or Firebase.
const filename = new URL('../src/components/GuestInfo.tsx', import.meta.url);
const module = { exports: {} };
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
runInNewContext(compiled, {
  module,
  exports: module.exports,
  require: createRequire(filename),
  fetch: (...args) => globalThis.fetch(...args),
  setTimeout,
});
const GuestInfo = module.exports.default;

async function mount(t, verify) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(['/api/otp/send', '/api/otp/verify'].includes(url));
    requests.push({ url, body: JSON.parse(options.body) });
    return { json: async () => url === '/api/otp/send' ? { success: true } : verify() };
  };
  const confirmations = [];
  const props = {
    formData: { name: 'Test Guest', email: 'guest@example.invalid', phone: '(650)-555-0123' },
    onUpdate() {},
    onPhoneVerified: value => confirmations.push(value),
    phoneVerified: false,
    smsOptIn: true,
    onSmsOptIn() {},
    otpEnabled: true,
  };
  let renderer;
  t.after(async () => {
    await act(async () => renderer?.unmount());
    globalThis.fetch = originalFetch;
  });
  await act(async () => { renderer = create(React.createElement(GuestInfo, props)); });
  await act(async () => { await renderer.root.findByType('button').props.onClick(); });
  return { renderer, props, requests, confirmations };
}

async function enterCode(renderer, code = '1234') {
  for (const [index, value] of [...code].entries()) {
    await act(async () => {
      const boxes = renderer.root.findAllByType('input').filter(input => input.props.inputMode === 'numeric');
      boxes[index].props.onChange({ target: { value } });
    });
  }
}

test('a complete OTP submits once despite parent callback changes', async t => {
  const state = await mount(t, () => ({ success: true, valid: true }));
  await enterCode(state.renderer);
  assert.deepEqual(state.confirmations, [true]);
  await act(async () => {
    state.renderer.update(React.createElement(GuestInfo, {
      ...state.props,
      onPhoneVerified: value => state.confirmations.push(value),
    }));
  });
  assert.equal(state.requests.filter(request => request.url === '/api/otp/verify').length, 1);
  assert.deepEqual(state.requests.at(-1).body, { phone: '(650)-555-0123', code: '1234' });
});

test('an incomplete OTP never requests verification', async t => {
  const state = await mount(t, () => ({ success: true, valid: true }));
  await enterCode(state.renderer, '123');
  assert.equal(state.requests.filter(request => request.url === '/api/otp/verify').length, 0);
  assert.deepEqual(state.confirmations, []);
});

test('an invalid OTP clears its digits and permits an explicit new attempt', async t => {
  const state = await mount(t, () => ({ success: true, valid: false }));
  await enterCode(state.renderer);
  const boxes = state.renderer.root.findAllByType('input').filter(input => input.props.inputMode === 'numeric');
  assert.ok(boxes.every(input => input.props.value === ''));
  await enterCode(state.renderer);
  assert.equal(state.requests.filter(request => request.url === '/api/otp/verify').length, 2);
  assert.deepEqual(state.confirmations, []);
});
