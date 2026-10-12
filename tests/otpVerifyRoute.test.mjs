import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const filename = new URL('../src/app/api/otp/verify/route.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function route(verify) {
  const module = { exports: {} }, cookies = [];
  const imports = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200, cookies: { set: (...args) => cookies.push(args) } }) } },
    '@/lib/auth/admin': { validMutationOrigin: () => true, secureCookie: () => true },
    '@/lib/auth/rateLimit': { rateLimit: async () => null },
    '@/lib/auth/signedToken': { issueSignedToken: async () => ({ token: 'signed-proof' }) },
    '@/lib/twilio': { toE164: () => '+16505550100', verifyPhoneCode: verify },
  };
  runInNewContext(compiled, { module, exports: module.exports, SyntaxError, console: { warn() {} }, require: name => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return { post: () => module.exports.POST({ json: async () => ({ phone: '6505550100', code: '1234' }) }), cookies };
}

test('expired Twilio challenges return recovery instructions without issuing proof', async () => {
  const handler = route(async () => { throw { status: 404, code: 20404 }; });
  const response = await handler.post();
  assert.equal(response.status, 400);
  assert.match(response.data.error, /Request a new code/);
  assert.deepEqual(handler.cookies, []);
});

test('provider outages remain server errors and never issue phone proof', async () => {
  for (const error of [{ status: 503, code: 20404 }, { status: 401, code: 20003 }, new Error('timeout')]) {
    const handler = route(async () => { throw error; });
    assert.equal((await handler.post()).status, 500);
    assert.deepEqual(handler.cookies, []);
  }
});

test('only approved verification issues the secure phone cookie', async () => {
  for (const valid of [false, true]) {
    const handler = route(async () => valid), response = await handler.post();
    assert.equal(response.status, 200);
    assert.equal(response.data.valid, valid);
    assert.equal(handler.cookies.length, valid ? 1 : 0);
    if (valid) assert.equal(handler.cookies[0][2].httpOnly, true);
  }
});
