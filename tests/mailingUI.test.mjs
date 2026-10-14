import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
import * as policy from '../src/lib/mailing/policy.ts';
const component = tag => ({ children, ...props }) => React.createElement(tag, props, children);
const defaultExport = value => ({ __esModule: true, default: value });
function load(path, imports = {}, context = {}) {
  const filename = new URL('../src/' + path, import.meta.url), module = { exports: {} }, require = createRequire(filename);
  const dependencies = { 'next/link': defaultExport(component('a')), '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: defaultRestaurant, timezone: 'America/Los_Angeles' }) }, '@/lib/mailing/policy': policy, ...imports };
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: name => dependencies[name] || require(name), URL, URLSearchParams, Date, Intl, ...context });
  return module.exports.default;
}
test('email-preference links do not mutate on load and opening another link in the same tab updates the action', async t => {
  const listeners = new Map(), requests = [], window = { location: { hash: '#id=synthetic&token=synthetic&action=confirm', pathname: '/mailing/preferences' }, history: { replaceState() { window.location.hash = ''; } }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const Page = load('app/mailing/preferences/page.tsx', {}, { window, fetch: async (url, request) => { requests.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ success: true }) }; } });
  let ui; await act(async () => { ui = create(React.createElement(Page)); }); t.after(async () => { await act(async () => ui.unmount()); });
  assert.equal(requests.length, 0); assert.equal(ui.root.findByType('button').props.children, 'Confirm my subscription');
  await act(async () => ui.root.findByType('button').props.onClick()); assert.equal(requests[0].action, 'confirm'); assert.equal(ui.root.findByType('h1').props.children, 'You’re on the list.');
  await act(async () => { window.location.hash = '#id=synthetic&token=synthetic&action=unsubscribe'; listeners.get('hashchange')(); });
  assert.equal(requests.length, 1); assert.equal(ui.root.findByType('button').props.children, 'Unsubscribe');
  await act(async () => ui.root.findByType('button').props.onClick()); assert.equal(requests[1].action, 'unsubscribe'); assert.equal(ui.root.findByType('h1').props.children, 'You’re unsubscribed.');
});
test('signup starts unchecked, sends the displayed consent version, and shows confirmation rather than immediate enrollment', async t => {
  const requests = [], Form = load('components/mailing/EmailSignup.tsx', {}, { fetch: async (url, request) => { requests.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ message: policy.SIGNUP_MESSAGE }) }; } });
  let ui; await act(async () => { ui = create(React.createElement(Form, { source: 'banner', compact: true })); }); t.after(async () => { await act(async () => ui.unmount()); });
  const input = type => ui.root.findAllByType('input').find(input => input.props.type === type);
  assert.equal(input('checkbox').props.checked, false);
  await act(async () => { input('email').props.onChange({ target: { value: 'synthetic@example.invalid' } }); input('checkbox').props.onChange({ target: { checked: true } }); });
  await act(async () => ui.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(requests[0].consent, true); assert.equal(requests[0].consentVersion, policy.CONSENT_VERSION); assert.equal(requests[0].source, 'banner');
  assert.equal(ui.root.findByProps({ role: 'status' }).props.children, policy.SIGNUP_MESSAGE);
});
test('mailing admin separates past contacts, filters addresses, and only offers unsubscribe actions', async t => {
  const contacts = [{ id: 'sub', email: 'subscriber@example.invalid', status: 'subscribed', sources: ['Homepage banner'], version: 1, confirmedAt: '2026-10-14T12:00:00Z' }, { id: 'past', email: 'past@example.invalid', status: 'contact', sources: ['Reservation'], version: 0, confirmedAt: '' }];
  const requests = [], counters = { total: 2, subscribed: 1, pending: 0, unsubscribed: 0, contact: 1 };
  const Page = load('components/mailing/MailingList.tsx', { '@/components/ui/dialog': { Dialog: ({ open, children }) => open ? children : null, DialogContent: component('div'), DialogTitle: component('h2'), DialogDescription: component('p') } },
    { window: { dispatchEvent() {} }, CustomEvent: class {}, fetch: async (url, request) => {
      if (request?.method === 'PATCH') { requests.push(JSON.parse(request.body)); contacts[0].status = 'unsubscribed'; counters.subscribed = 0; counters.unsubscribed = 1; }
      return { ok: true, json: async () => ({ contacts: contacts.map(c => ({ ...c })), counts: { ...counters } }) };
    } });
  let ui; await act(async () => { ui = create(React.createElement(Page)); }); t.after(async () => { await act(async () => ui.unmount()); });
  assert.equal(ui.root.findAllByType('article').length, 2);
  const buttons = () => ui.root.findAllByType('button'); assert.equal(buttons().filter(b => b.props.children === 'Unsubscribe').length, 1);
  await act(async () => ui.root.findByProps({ 'aria-label': 'Search contacts by email' }).props.onChange({ target: { value: 'subscriber' } }));
  assert.equal(ui.root.findAllByType('article').length, 1);
  await act(async () => buttons().find(b => b.props.children === 'Unsubscribe').props.onClick()); assert.equal(ui.root.findByType('h2').props.children, 'Unsubscribe this contact?');
  await act(async () => buttons().find(b => b.props.children === 'Yes, unsubscribe').props.onClick());
  assert.equal(requests[0].action, 'unsubscribe'); assert.equal(requests[0].version, 1); assert.equal(buttons().filter(b => b.props.children === 'Unsubscribe').length, 0);
});
test('site analytics honors browser opt-outs, excludes email preferences, and removes fragments', async () => {
  for (const choice of [{ doNotTrack: '1' }, { globalPrivacyControl: true }, { path: '/mailing/preferences' }, {}]) {
    const Page = load('components/SiteAnalytics.tsx', { 'next/navigation': { usePathname: () => choice.path || '/' }, '@vercel/analytics/react': { Analytics: component('analytics') } }, { navigator: choice });
    let ui; await act(async () => { ui = create(React.createElement(Page)); });
    if (Object.keys(choice).length) assert.equal(ui.toJSON(), null);
    else {
      const beforeSend = ui.root.findByType('analytics').props.beforeSend;
      assert.equal(beforeSend({ url: 'https://test.example.invalid/mailing/preferences#token=private' }), null);
      assert.equal(beforeSend({ url: 'https://test.example.invalid/#private-fragment' }).url, 'https://test.example.invalid/');
    }
    await act(async () => ui.unmount());
  }
});
