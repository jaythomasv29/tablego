import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as catering from '../src/lib/catering/admin.ts';
import { timestampString } from '../src/lib/reservations/service.ts';
const filename = new URL('../src/app/api/staff/catering/[id]/route.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const original = { name: 'Synthetic Guest', date: '2026-11-15', email: 'guest@example.invalid', phone: '+16505550100', status: 'pending', specialRequests: 'Original guest request', selectedDishes: ['Pad Thai'] };
function handler() {
  const module = { exports: {} }, records = new Map([['catering/synthetic', { ...original }], ['settings/general', { timezone: 'America/Los_Angeles' }]]), writes = [], require = createRequire(filename);
  let reads = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
  const db = { doc: ref, runTransaction: async work => work({ get: async reference => { reads++; return { exists: records.has(reference.path), data: () => records.get(reference.path) }; },
    set: (reference, data) => { writes.push(reference.path); records.set(reference.path, { ...records.get(reference.path), ...data }); },
    update: (reference, data) => { writes.push(reference.path); records.set(reference.path, { ...records.get(reference.path), ...data }); },
    create: (reference, data) => { writes.push(reference.path); records.set(reference.path, data); },
  }) };
  const imports = {
    '@/lib/auth/admin': { requireAdmin: async request => request.foreign ? { status: 403 } : request.admin ? null : { status: 401 } },
    '@/lib/serverFirebase': { getServerDatabase: () => db }, '@/lib/catering/admin': catering,
    '@/lib/reservations/service': { timestampString }, '@/lib/reservations/policy': { businessTimezone: settings => settings.timezone },
    '@/lib/reservations/http': { ReservationError, privateJson: data => ({ status: 200, data }), reservationError: error => ({ status: error.status || 503, data: { error: error.message } }) },
  };
  runInNewContext(compiled, { module, exports: module.exports, require: name => imports[name] || require(name) });
  const patch = (body, options = {}) => module.exports.PATCH({ admin: true, ...options, json: async () => body }, { params: Promise.resolve({ id: 'synthetic' }) });
  return { patch, records, writes, reads: () => reads };
}
const body = { status: 'contacted', originalStatus: 'pending', internalNotes: 'Private pricing discussion', followUpDate: '2026-10-12', version: 1 };
test('catering mutation guards deny unauthorized/origin requests before accessing records', async () => {
  const route = handler(); assert.equal((await route.patch(body, { admin: false })).status, 401); assert.equal((await route.patch(body, { foreign: true })).status, 403); assert.equal(route.reads(), 0); assert.equal(route.writes.length, 0);
});
test('catering saves new staff fields only in protected storage and preserves guest input', async () => {
  const route = handler(), result = await route.patch(body); assert.equal(result.status, 200); assert.equal(result.data.lead.status, 'contacted');
  const raw = route.records.get('catering/synthetic'), staff = route.records.get('cateringStaff/synthetic');
  assert.equal(raw.internalNotes, undefined); assert.equal(raw.workflowStage, undefined); assert.equal(raw.followUpDate, undefined); assert.equal(raw.status, 'pending'); assert.equal(raw.specialRequests, original.specialRequests);
  assert.equal(staff.internalNotes, body.internalNotes); assert.equal(staff.workflowStage, 'contacted'); assert.equal(staff.version, 2);
  assert.ok(route.writes.every(path => !path.startsWith('notificationOutbox/')));
});
test('catering conflicts from new or legacy clients never overwrite saved staff work', async () => {
  const route = handler(); assert.equal((await route.patch(body)).status, 200);
  const size = route.writes.length; assert.equal((await route.patch({ ...body, internalNotes: 'Stale draft' })).status, 409); assert.equal(route.writes.length, size);
  route.records.set('catering/synthetic', { ...route.records.get('catering/synthetic'), status: 'completed' });
  assert.equal((await route.patch({ ...body, originalStatus: 'contacted', version: 2 })).status, 409); assert.equal(route.records.get('cateringStaff/synthetic').internalNotes, body.internalNotes);
});
test('catering no-op retry creates no new history and closing clears protected follow-up', async () => {
  const route = handler(); const first = await route.patch(body), size = route.writes.length;
  assert.equal((await route.patch({ ...body, originalStatus: 'contacted', version: first.data.lead.version })).data.changed, false); assert.equal(route.writes.length, size);
  const closed = await route.patch({ ...body, status: 'declined', originalStatus: 'contacted', version: 2 }); assert.equal(closed.status, 200); assert.equal(closed.data.lead.status, 'declined'); assert.equal(route.records.get('cateringStaff/synthetic').followUpDate, ''); assert.equal(route.records.get('catering/synthetic').status, 'completed');
});
