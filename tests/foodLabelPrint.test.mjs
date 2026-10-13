import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
const filename = new URL('../src/app/admin/labeling/page.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
async function mount(t) {
  const module = { exports: {} }, require = createRequire(filename), body = { nodeType: 1 }, portals = [];
  const items = Array.from({ length: 12 }, (_, index) => ({ id: `synthetic-${index}`, name: `Synthetic food ${index + 1}`, description: `Description ${index + 1}`, category: 'Test menu' }));
  const imports = {
    'react-dom': { createPortal: (node, target) => { portals.push({ node, target }); return null; } },
    'firebase/firestore': { collection: (db, name) => name, getDocs: async name => ({ docs: name === 'menu' ? items.map(item => ({ id: item.id, data: () => item })) : [] }) },
    '@/firebase': { db: {} }, '@/components/AdminLayout': { __esModule: true, default: ({ children }) => React.createElement('div', { style: { height: '100vh', overflow: 'hidden' } }, children) },
    '@/contexts/TimezoneContext': { useTimezone: () => ({ restaurant: { name: 'Test Restaurant', location: 'Test City' } }) },
    'lucide-react': Object.fromEntries(['Printer', 'ChevronDown', 'ChevronRight', 'Search', 'X', 'Pencil', 'Check'].map(name => [name, () => null])),
  };
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name), document: { body } });
  let renderer; await act(async () => { renderer = create(React.createElement(module.exports.default)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const latest = () => portals.at(-1);
  const cards = () => latest().node.props.children.flatMap(page => page.props.children.flatMap(row => row.props.children[1].props.children));
  const button = text => renderer.root.findAllByType('button').find(node => node.props.children === text);
  const select = async count => { const inputs = renderer.root.findAllByType('input').filter(node => node.props.type === 'checkbox'); await act(async () => { for (let index = 0; index < count; index++) inputs[index].props.onChange(); }); };
  return { renderer, latest, cards, body, select, button };
}
test('label print output escapes the clipped dashboard and preserves every card across full and partial pages', async t => {
  const state = await mount(t);
  assert.equal(state.latest().target, state.body);
  assert.equal(state.renderer.root.findAllByProps({ id: 'label-print-root' }).length, 0, 'print markup must not be inside the fixed-height admin layout');
  for (const count of [1, 4, 5, 8, 9, 12]) {
    if (state.button('Clear all')) await act(async () => state.button('Clear all').props.onClick());
    await state.select(count);
    assert.equal(state.latest().node.props.children.length, Math.ceil(count / 4));
    assert.equal(state.cards().length, count);
    assert.deepEqual(Array.from(state.cards(), card => card.props.item.name), Array.from({ length: count }, (_, index) => `Synthetic food ${index + 1}`));
  }
});
test('print pages retain duplicate label instances, protein choices and edited text beyond the first sheet', async t => {
  const state = await mount(t); await state.select(8);
  await act(async () => state.button('+ Add another protein').props.onClick());
  assert.equal(state.latest().node.props.children.length, 3); assert.equal(state.cards().length, 9);
  await act(async () => state.renderer.root.findAllByType('button').find(node => node.props.title === 'Edit label text').props.onClick());
  await act(async () => state.renderer.root.findByProps({ placeholder: 'Label name' }).props.onChange({ target: { value: 'Edited food label' } }));
  await act(async () => state.renderer.root.findAllByType('button').filter(node => node.props.children === 'Chicken')[1].props.onClick());
  assert.equal(state.cards()[0].props.item.name, 'Edited food label');
  assert.equal(state.cards().at(-1).props.protein, 'Chicken');
  assert.equal(state.cards().at(-1).props.item.name, 'Synthetic food 1');
});
