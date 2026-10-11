import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
const env = dotenv.parse(await readFile('.env.staging.local'));
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-staging-1d712') throw new Error('Staging only');
const base = process.env.TABLEGO_STAGING_TEST_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/127\.0\.0\.1:310[02]$/.test(base)) throw new Error('Smoke tests require a local capture-staging port');
const results = [];
async function read(path, headers = {}) { return fetch(`${base}${path}`, { headers, redirect: 'manual' }); }
for (const headers of [{}, { Cookie: 'company-auth=true' }, { 'x-middleware-subrequest': 'src/middleware:src/middleware:src/middleware:src/middleware:src/middleware' }]) {
  const response = await read('/admin/home', headers);
  assert.equal(response.status, 307); assert.match(response.headers.get('location'), /\/login\?callbackUrl=/); assert.match(response.headers.get('cache-control'), /no-store/);
}
console.log('PASS anonymous, forged cookie and middleware-header staff page access redirect to login');
const publicPage = await read('/'); assert.equal(publicPage.status, 200); assert.ok(!publicPage.headers.get('cache-control').includes('no-store'));
results.push({ path: '/', cacheControl: publicPage.headers.get('cache-control') });
for (const path of ['/reservation/staging-fixture', '/cancel-reservation/staging-fixture', '/reschedule/staging-fixture', '/api/staff/settings']) {
  const response = await read(path); assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  results.push({ path, cacheControl: response.headers.get('cache-control'), referrerPolicy: response.headers.get('referrer-policy') });
}
const image = await read('/images/menu-placeholder.svg'); assert.match(image.headers.get('cache-control'), /public, max-age=3600/); results.push({ path: '/images/menu-placeholder.svg', cacheControl: image.headers.get('cache-control') });
const html = await publicPage.text(); const chunk = html.match(/src="([^\"]*\/_next\/static\/[^\"]+\.js)"/)?.[1]; assert.ok(chunk);
const javascript = await read(chunk); assert.match(javascript.headers.get('cache-control'), /immutable/); results.push({ path: 'hashed JavaScript asset', cacheControl: javascript.headers.get('cache-control') });
await writeFile('.staging/cache-policy-results.json', JSON.stringify(results, null, 2));
console.log('PASS public pages/assets cache; private API and guest management responses do not cache');
