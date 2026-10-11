import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as dates from '../src/utils/dateUtils.ts';
const filename = new URL('../src/components/reservations/useInitialBusinessDate.ts', import.meta.url);
const module = { exports: {} }, nativeRequire = createRequire(filename);
runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  module, exports: module.exports, Date,
  require: name => name === '@/utils/dateUtils' ? dates : nativeRequire(name),
});
const useInitialBusinessDate = module.exports.useInitialBusinessDate;
test('a live business timezone save or refresh cannot reset an initialized guest calendar', async t => {
  let date, renderer;
  function Draft({ timezone, loading, error }) { date = useInitialBusinessDate(timezone, loading, error); return null; }
  t.after(async () => { await act(async () => renderer?.unmount()); });
  await act(async () => { renderer = create(React.createElement(Draft, { timezone: 'Pacific/Kiritimati', loading: true, error: null })); });
  assert.equal(date, null);
  await act(async () => { renderer.update(React.createElement(Draft, { timezone: 'Pacific/Kiritimati', loading: false, error: 'Missing settings' })); });
  assert.equal(date, null);
  await act(async () => { renderer.update(React.createElement(Draft, { timezone: 'Pacific/Kiritimati', loading: false, error: null })); });
  const initialized = date;
  assert.equal(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, dates.getTodayInTimezone('Pacific/Kiritimati'));
  for (const loading of [false, true, false]) {
    await act(async () => { renderer.update(React.createElement(Draft, { timezone: 'Pacific/Honolulu', loading, error: null })); });
    assert.equal(date, initialized);
  }
});
