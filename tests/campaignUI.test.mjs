import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import * as policy from '../src/lib/campaigns/policy.ts';
import { renderCampaign } from '../src/lib/campaigns/render.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
const component = tag => ({ children, ...props }) => React.createElement(tag, props, children);
function page(context = {}) {
  const file = new URL('../src/components/campaigns/Campaigns.tsx', import.meta.url), module = { exports: {} }, require = createRequire(file);
  const imports = { '@/lib/campaigns/policy': policy, '@/lib/campaigns/render': { renderCampaign }, '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: defaultRestaurant, timezone: 'America/Los_Angeles' }) }, '@/components/ui/dialog': { Dialog: ({ open, children }) => open ? children : null, DialogContent: component('dialog'), DialogTitle: component('h2'), DialogDescription: component('p') } };
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: name => imports[name] || require(name), window: { setInterval: () => 1, clearInterval() {} }, Date, Intl, ...context }); return module.exports.default;
}
test('campaign UI previews a locked audience and requires a separate explicit launch action', async t => {
  const requests = [], campaign = { ...policy.recommendedCampaign(), id: 'synthetic-id', recipient: policy.TEST_RECIPIENT, version: 1, status: 'draft', timezone: '', createdAt: '2026-10-14T18:00:00Z', launchedAt: '', messages: [] };
  const Page = page({ fetch: async (url, request) => { if (request?.method === 'POST') requests.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ campaigns: [campaign], metrics: policy.campaignMetrics([campaign]), provider: 'smtp', capture: true, configuration: 'capture' }) }; } });
  let ui; await act(async () => { ui = create(React.createElement(Page)); }); t.after(async () => { await act(async () => ui.unmount()); });
  const button = text => ui.root.findAllByType('button').find(b => b.children.filter(c => typeof c === 'string').join('').trim() === text);
  assert.ok(button('Preview email'), JSON.stringify(ui.root.findAllByType('button').map(b => b.children.filter(c => typeof c === 'string'))));
  await act(async () => button('Preview email').props.onClick()); assert.equal(requests.length, 0);
  const iframe = ui.root.findByType('iframe'); assert.equal(iframe.props.sandbox, ''); assert.ok(!iframe.props.srcDoc.includes('href=')); assert.ok(iframe.props.srcDoc.includes('543 Emerson St'));
  await act(async () => button('Launch test').props.onClick()); assert.equal(requests.length, 0);
  assert.ok(ui.root.findAllByType('p').some(p => p.children.filter(c => typeof c === 'string').join('').includes('captured in staging')));
  await act(async () => button('Launch test campaign').props.onClick()); assert.deepEqual(requests, [{ action: 'launch', id: 'synthetic-id', version: 1 }]);
});
test('incomplete Resend configuration disables launch while leaving draft editing available', async t => {
  const campaign = { ...policy.recommendedCampaign(), id: 'synthetic', recipient: policy.TEST_RECIPIENT, version: 1, status: 'draft', messages: [] };
  const Page = page({ fetch: async () => ({ ok: true, json: async () => ({ campaigns: [campaign], metrics: policy.campaignMetrics([campaign]), provider: 'resend', configuration: 'setup-required' }) }) });
  let ui; await act(async () => { ui = create(React.createElement(Page)); }); t.after(async () => { await act(async () => ui.unmount()); });
  const button = text => ui.root.findAllByType('button').find(b => b.children.filter(c => typeof c === 'string').join('').trim() === text);
  assert.equal(button('Launch test').props.disabled, true); assert.equal(button('Edit draft').props.disabled, false);
  assert.match(ui.root.findByProps({ role: 'status' }).props.children, /Resend setup is pending/);
});
