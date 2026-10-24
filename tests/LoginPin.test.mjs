import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as credentials from '../src/lib/auth/adminCredentials.ts';
const require = createRequire(import.meta.url);
function load(path, mocks, globals = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, process, ...globals, require: name => name in mocks ? mocks[name] : require(name),
  });
  return module.exports;
}

test('PIN login issues the normal remembered session, preserves legacy login, and does not mutate existing sessions', async t => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'pin-test-secret-at-least-32-characters';
  t.after(() => { if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previous; });
  let phone = '+16503237700', origin = true, limited = null;
  const writes = [], issued = [];
  const route = load('../src/app/api/auth/login/route.ts', {
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200, cookies: { set: (...args) => writes.push({ cookie: args }) } }) } },
    '@/lib/auth/adminCredentials': credentials,
    '@/lib/auth/signedToken': { issueSignedToken: async (kind, data, ttl) => { issued.push({ kind, data, ttl }); return { token: 'signed-session', claims: { id: `new-${issued.length}`, expiresAt: 123456 } }; } },
    '@/lib/auth/admin': { secureCookie: () => true, validMutationOrigin: () => origin, staffFirebaseToken: async () => 'scoped-firebase-token' },
    '@/lib/serverFirebase': { getServerDatabase: () => ({ doc: path => ({ get: async () => ({ data: () => ({ restaurant: { phone } }) }), set: async data => writes.push({ path, data }) }) }) },
    '@/lib/auth/rateLimit': { rateLimit: async () => limited },
    '@/lib/restaurant/config': { defaultRestaurant: { phone: '+16503237700' } },
  });
  const login = body => route.POST({ json: async () => body });
  const response = await login({ pin: '7700', remember: true });
  assert.equal(response.status, 200); assert.equal(response.data.firebaseToken, 'scoped-firebase-token');
  assert.deepEqual(JSON.parse(JSON.stringify(issued[0])), { kind: 'admin', data: { username: 'restaurant-pin' }, ttl: 400 * 86400 });
  assert.equal(writes[0].path, 'staffSessions/new-1');
  assert.equal(writes[1].cookie[2].maxAge, 400 * 86400);
  assert.equal(writes[1].cookie[2].httpOnly, true);
  const count = writes.length;
  for (const pin of ['0000', '770', 7700, '77000', '7700 ']) assert.ok((await login({ pin })).status >= 400);
  assert.equal(writes.length, count);
  phone = '+16503238888';
  assert.equal((await login({ pin: '7700' })).status, 401);
  assert.equal((await login({ pin: '8888', remember: false })).status, 200);
  assert.equal(issued.at(-1).ttl, 7 * 86400);
  phone = undefined;
  assert.equal((await login({ pin: '7700' })).status, 200);
  assert.equal((await login({ username: '000', password: '000', remember: true })).status, 200);
  assert.equal((await login({ pin: '1111', username: '000', password: '000' })).status, 401);
  limited = { status: 429 };
  assert.equal((await login({ pin: '7700' })).status, 429);
  origin = false;
  assert.equal((await login({ pin: '7700' })).status, 403);
});

async function mount(t, responder = async () => ({ ok: true, json: async () => ({ firebaseToken: 'firebase-token' }) })) {
  const calls = [], navigations = [], tokens = [];
  const page = load('../src/app/login/page.tsx', {
    'next/navigation': { useRouter: () => ({ push: url => navigations.push(url) }), useSearchParams: () => new URLSearchParams('callbackUrl=%2Fadmin%2Fhome') },
    '@/components/ui/button': { Button: props => React.createElement('button', props) },
    '@/components/ui/input': { Input: props => React.createElement('input', props) },
    '@/components/ui/label': { Label: props => React.createElement('label', props) },
    'lucide-react': { Delete: props => React.createElement('svg', props) },
    'firebase/auth': { signInWithCustomToken: async (_, token) => tokens.push(token) }, '@/firebase': { auth: {} },
  }, { fetch: async (...args) => { calls.push(args); return responder(...args); } });
  let renderer;
  await act(async () => { renderer = create(React.createElement(page.default)); });
  t.after(() => act(() => renderer.unmount()));
  return { renderer, calls, navigations, tokens };
}
const button = (renderer, label) => renderer.root.findAllByType('button').find(item => item.children.join('') === label);
const digit = async (renderer, number) => act(async () => button(renderer, number).props.onClick());
const submit = renderer => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });

test('default keypad signs in with four digits and remembered session without a username', async t => {
  const { renderer, calls, navigations, tokens } = await mount(t);
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.inputMode, 'numeric');
  assert.equal(button(renderer, 'Sign in').props.disabled, true);
  for (const number of ['7', '7', '0', '0']) await digit(renderer, number);
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.value, '7700');
  assert.equal(button(renderer, 'Sign in').props.disabled, false);
  assert.equal(button(renderer, '1').props.disabled, true);
  await act(async () => submit(renderer));
  assert.deepEqual(JSON.parse(calls[0][1].body), { pin: '7700', remember: true });
  assert.deepEqual(tokens, ['firebase-token']); assert.deepEqual(navigations, ['/admin/home']);
});
test('clear, backspace, keyboard input and leading zeros work', async t => {
  const { renderer, calls } = await mount(t);
  await digit(renderer, '0'); await digit(renderer, '7');
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Delete last digit' }).props.onClick());
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.value, '0');
  await act(async () => button(renderer, 'Clear').props.onClick());
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.value, '');
  await act(async () => renderer.root.findByProps({ id: 'pin' }).props.onChange({ target: { value: '00a07' } }));
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.value, '0007');
  assert.equal(calls.length, 0);
});
test('incomplete PIN never sends and duplicate submit is ignored while signing in', async t => {
  let finish;
  const { renderer, calls } = await mount(t, () => new Promise(resolve => { finish = resolve; }));
  await act(async () => submit(renderer)); assert.equal(calls.length, 0);
  for (const number of ['7', '7', '0', '0']) await digit(renderer, number);
  act(() => { submit(renderer); submit(renderer); }); assert.equal(calls.length, 1);
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.disabled, true);
  await act(async () => finish({ ok: false, status: 401 }));
  assert.ok(renderer.root.findByProps({ role: 'alert' }).children.join('').includes('That code didn’t match'));
});
test('username/password remains available and PIN mode can be restored', async t => {
  const { renderer, calls } = await mount(t);
  await act(async () => button(renderer, 'Use username and password').props.onClick());
  await act(async () => renderer.root.findByProps({ id: 'username' }).props.onChange({ target: { value: '000' } }));
  await act(async () => renderer.root.findByProps({ id: 'password' }).props.onChange({ target: { value: '000' } }));
  await act(async () => submit(renderer));
  assert.deepEqual(JSON.parse(calls[0][1].body), { username: '000', password: '000', remember: true });
  await act(async () => button(renderer, 'Use number pad').props.onClick());
  assert.equal(renderer.root.findByProps({ id: 'pin' }).props.value, '');
});
