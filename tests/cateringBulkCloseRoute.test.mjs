import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as catering from '../src/lib/catering/admin.ts';
import * as bulk from '../src/lib/catering/bulkClose.ts';
const filename = new URL('../src/app/api/staff/catering/bulk-close/route.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function handler() {
  const module = { exports: {} }, records = new Map(), stamps = new Map(), require = createRequire(filename);
  let sequence = 0, reads = 0, writes = 0;
  const put = (path, data) => { records.set(path, data); stamps.set(path, { seconds: 100, nanoseconds: ++sequence }); };
  put('settings/general', { timezone: 'America/Los_Angeles' });
  const snapshot = reference => { reads++; return { id: reference.id, exists: records.has(reference.path), updateTime: stamps.get(reference.path), data: () => records.get(reference.path) }; };
  const ref = path => ({ path, id: path.split('/').at(-1), create: async data => { writes++; put(path, data); }, collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }), get: async () => snapshot(ref(path)) });
  const db = { doc: ref, collection: name => ({ get: async () => ({ docs: [...records.keys()].filter(path => path.startsWith(`${name}/`) && path.split('/').length === 2).map(path => snapshot(ref(path))) }) }),
    runTransaction: async work => {
      const pending = []; let writing = false;
      const get = async reference => { assert.equal(writing, false, 'transaction reads must precede writes'); return snapshot(reference); };
      const result = await work({ get, getAll: async (...refs) => Promise.all(refs.map(get)),
        set: (reference, data) => { writing = true; pending.push([reference.path, data, true]); }, update: (reference, data) => { writing = true; pending.push([reference.path, data, true]); }, create: (reference, data) => { writing = true; pending.push([reference.path, data, false]); } });
      for (const [path, data, merge] of pending) { writes++; put(path, merge ? { ...records.get(path), ...data } : data); }
      return result;
    },
  };
  const imports = { '@/lib/auth/admin': { requireAdmin: async request => request.foreign ? { status: 403 } : request.admin ? null : { status: 401 }, readCookie: request => request.cookie },
    '@/lib/serverFirebase': { getServerDatabase: () => db }, '@/lib/catering/admin': catering, '@/lib/catering/bulkClose': bulk,
    '@/lib/reservations/policy': { businessTimezone: settings => settings.timezone }, '@/lib/reservations/http': { ReservationError, privateJson: data => ({ status: 200, data }), reservationError: error => ({ status: error.status || 503, data: { error: error.message } }) } };
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name) });
  const post = (body, options = {}) => module.exports.POST({ admin: true, cookie: 'synthetic-session', ...options, json: async () => body });
  const seed = (id, status = 'pending') => { put(`catering/${id}`, { name: `Synthetic ${id}`, date: '2026-11-15', status: ['completed', 'declined'].includes(status) ? 'completed' : 'pending', specialRequests: 'Original guest request' }); put(`cateringStaff/${id}`, { workflowStage: status, internalNotes: 'Private staff note', followUpDate: '2026-10-12', version: 2 }); };
  return { post, put, seed, records, stamps, reads: () => reads, writes: () => writes, preview: async () => (await post({ action: 'preview' })).data, confirm: operationId => post({ action: 'confirm', operationId }) };
}
test('bulk catering requires staff auth and same-origin requests before reading or writing', async () => {
  const route = handler(); assert.equal((await route.post({ action: 'preview' }, { admin: false })).status, 401); assert.equal((await route.post({ action: 'preview' }, { foreign: true })).status, 403); assert.equal(route.reads(), 0); assert.equal(route.writes(), 0);
});
test('review includes all active stages, excludes closed records, and exposes no private notes', async () => {
  const route = handler(); for (const [id, status] of [['new', 'pending'], ['talking', 'contacted'], ['booked', 'confirmed'], ['review', 'needs-review'], ['done', 'completed'], ['lost', 'declined']]) route.seed(id, status);
  const preview = await route.preview(); assert.equal(preview.items.length, 4); assert.equal(preview.totalActive, 4); assert.ok(preview.operationId);
  assert.ok(preview.items.every(item => !Object.hasOwn(item, 'internalNotes') && !Object.hasOwn(item, 'recordStamp')));
  assert.equal(route.records.get('catering/new').status, 'pending'); assert.equal(route.records.get('cateringBulkClosures/' + preview.operationId).state, 'review');
});
test('bulk close is atomic, preserves notes/guest input, clears follow-up, and creates history without messages', async () => {
  const route = handler(); route.seed('new'); route.seed('booked', 'confirmed'); route.seed('done', 'completed'); const preview = await route.preview(), result = await route.confirm(preview.operationId);
  assert.equal(result.status, 200); assert.equal(result.data.closedCount, 2);
  for (const id of ['new', 'booked']) { assert.equal(route.records.get(`catering/${id}`).status, 'completed'); assert.equal(route.records.get(`catering/${id}`).specialRequests, 'Original guest request'); const staff = route.records.get(`cateringStaff/${id}`); assert.equal(staff.internalNotes, 'Private staff note'); assert.equal(staff.followUpDate, ''); assert.equal(staff.version, 3); }
  assert.equal(route.records.get('cateringStaff/done').version, 2);
  const events = [...route.records].filter(([path]) => path.includes('/events/')); assert.equal(events.length, 2); assert.ok(events.every(([, data]) => data.bulkOperationId === preview.operationId)); assert.ok([...route.records.keys()].every(path => !path.startsWith('notificationOutbox/')));
});
test('new arrivals after review stay active', async () => {
  const route = handler(); route.seed('old'); const preview = await route.preview(); route.seed('arrival'); assert.equal((await route.confirm(preview.operationId)).status, 200); assert.equal(route.records.get('catering/arrival').status, 'pending');
});
test('concurrent private changes or legacy updates abort the whole bulk action without partial closure', async () => {
  for (const changed of ['catering/b', 'cateringStaff/b']) { const route = handler(); route.seed('a'); route.seed('b'); const preview = await route.preview(), before = route.writes(); route.put(changed, { ...route.records.get(changed), version: 2, updatedField: 'changed without version bump' }); assert.equal((await route.confirm(preview.operationId)).status, 409); assert.equal(route.writes(), before); assert.equal(route.records.get('catering/a').status, 'pending'); }
});
test('deleted reviewed records require a fresh review', async () => {
  const route = handler(); route.seed('a'); route.seed('b'); const preview = await route.preview(); route.records.delete('catering/b'); route.stamps.delete('catering/b'); assert.equal((await route.confirm(preview.operationId)).status, 409); assert.equal(route.records.get('catering/a').status, 'pending');
});
test('expired, missing and another staff session reviews cannot close inquiries', async () => {
  const route = handler(); route.seed('a'); const preview = await route.preview(); assert.equal((await route.post({ action: 'confirm', operationId: preview.operationId }, { cookie: 'other-session' })).status, 409); route.put(`cateringBulkClosures/${preview.operationId}`, { ...route.records.get(`cateringBulkClosures/${preview.operationId}`), expiresAt: 0 }); assert.equal((await route.confirm(preview.operationId)).status, 409); assert.equal(route.records.get('catering/a').status, 'pending'); assert.equal((await route.confirm('bad-id')).status, 400);
});
test('retrying a completed operation never recloses a reopened inquiry or new arrival', async () => {
  const route = handler(); route.seed('a'); const preview = await route.preview(); assert.equal((await route.confirm(preview.operationId)).status, 200); route.seed('a'); route.seed('arrival'); const before = route.writes(), repeat = await route.confirm(preview.operationId); assert.equal(repeat.data.repeated, true); assert.equal(route.writes(), before); assert.equal(route.records.get('catering/a').status, 'pending'); assert.equal(route.records.get('catering/arrival').status, 'pending');
});
test('large inboxes use a bounded transaction and empty inboxes create no review records', async () => {
  const empty = handler(); assert.equal((await empty.preview()).operationId, null); assert.equal(empty.writes(), 0);
  const route = handler(); for (let i = 0; i < 101; i++) route.seed(`id-${String(i).padStart(3, '0')}`); const preview = await route.preview(); assert.equal(preview.items.length, 100); assert.equal(preview.totalActive, 101); const before = route.writes(); assert.equal((await route.confirm(preview.operationId)).status, 200); assert.equal(route.writes() - before, 301); assert.equal([...route.records].filter(([path, data]) => /^catering\/[^/]+$/.test(path) && data.status === 'pending').length, 1);
});
