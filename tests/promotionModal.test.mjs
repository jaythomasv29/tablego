import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as promotion from '../src/lib/mailing/promotion.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
const component = tag => ({ children, ...props }) => React.createElement(tag, props, children);
const defaultExport = value => ({ __esModule: true, default: value });
test('Monthly offers opens both deals without signup, honors dismissal, and never overlays a booking', async t => {
  const filename = new URL('../src/components/mailing/PromotionModal.tsx', import.meta.url), module = { exports: {} }, require = createRequire(filename);
  const storage = new Map(), focused = [], timers = [];
  const imports = {
    '@radix-ui/react-dialog': { Root: ({ open, children, ...props }) => open ? React.createElement('dialog', props, children) : null, Portal: component('div'), Overlay: () => null, Content: component('section'), Close: component('button'), Title: component('h2'), Description: component('p') },
    'next/image': defaultExport(component('img')), 'next/link': defaultExport(component('a')), './EmailSignup': defaultExport(component('signup')),
    '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: defaultRestaurant, timezone: 'America/Los_Angeles' }) }, '@/lib/mailing/promotion': { ...promotion, activePromotions: timezone => promotion.activePromotions(timezone, new Date('2026-10-14T22:00:00Z')) },
  };
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require: name => imports[name] || require(name), Date, Intl,
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
      document: { querySelector: () => null, activeElement: null, getElementById: id => ({ focus: () => focused.push(id) }) },
      setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    });
  const Page = module.exports.default; let ui, closed = 0;
  await act(async () => { ui = create(React.createElement(Page, { manuallyOpen: true, blocked: false, onClose: () => closed++ })); });
  t.after(async () => { await act(async () => ui.unmount()); });
  assert.deepEqual(ui.root.findAllByType('article').map(card => card.findByType('h3').props.children), ['10% off lunch', 'Every day, 4–6 PM']);
  assert.equal(ui.root.findByType('signup').props.source, 'modal');
  assert.ok(ui.root.findAllByType('p').some(p => typeof p.props.children === 'string' && p.props.children.includes('isn’t required to redeem')));
  const content = ui.root.findAllByType('section').find(section => section.props.onCloseAutoFocus);
  content.props.onCloseAutoFocus({ preventDefault() {} }); assert.deepEqual(focused, ['promotion-opener']);
  await act(async () => ui.root.findByType('dialog').props.onOpenChange(false)); assert.equal(closed, 1); assert.equal(storage.size, 1);
  await act(async () => ui.update(React.createElement(Page, { manuallyOpen: false, blocked: true, onClose() {} })));
  assert.equal(ui.root.findAllByType('dialog').length, 0);
});
