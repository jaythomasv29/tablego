import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { formatDateForDisplay } from '../src/utils/dateUtils.ts';
const filename = new URL('../src/components/reservations/ReservationReceipt.tsx',import.meta.url);
const module={exports:{}}, normalRequire=createRequire(filename);
runInNewContext(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:name=>name==='@/utils/dateUtils'?{formatDateForDisplay}:normalRequire(name)});
const details={name:'Test Guest',date:'2026-10-15',time:'7:00 PM',guests:2,timezone:'America/Los_Angeles'};
test('receipt reports the saved confirmed state and frozen business calendar',()=>{
 const html=renderToStaticMarkup(React.createElement(module.exports.ReservationReceipt,{details:{...details,status:'confirmed'}}));
 assert.match(html,/Your table is confirmed/);assert.match(html,/October 15, 2026/);assert.match(html,/7:00 PM/);assert.match(html,/America\/Los_Angeles/);assert.ok(!html.includes('awaits restaurant acceptance'));
});
test('manual receipt continues to await restaurant acceptance',()=>{
 const html=renderToStaticMarkup(React.createElement(module.exports.ReservationReceipt,{details:{...details,status:'pending'}}));
 assert.match(html,/Your table request is in/);assert.match(html,/awaits restaurant acceptance/);assert.ok(!html.includes('Your table is confirmed'));
});
