import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as inventory from '../src/lib/inventory/model.ts';
import * as model from '../src/lib/work/model.ts';
import { workGoods, goodsTemplates } from '../src/lib/work/goods.ts';
import { starterWorkCrew } from '../src/lib/work/crew.ts';
import * as availability from '../src/lib/reservations/availability.ts';
import { renderWorkNotification } from '../src/lib/work/render.ts';
import { defaultRestaurant } from '../src/lib/restaurant/config.ts';
const require = createRequire(import.meta.url);
const crew = [{ id: 'manager-id', name: 'Test staff', role: 'both' }, { id: 'front-id', name: 'FOH Staff', role: 'front' }, { id: 'kitchen-id', name: 'Kitchen Staff', role: 'kitchen' }];
function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, process, Buffer, URL, Date, console, require: name => name in mocks ? mocks[name] : require(name) });
  return module.exports;
}
const policy = { timezone: 'America/Los_Angeles', businessHours: model.defaultWorkHours(), specialDates: [] };
test('Work follows requested weekday hours, dinner-only weekends, and station checklists', () => {
  const settings = model.defaultWorkSettings();
  const monday = model.createWorkDay('2026-10-26', settings, policy);
  assert.equal(monday.shifts.length, 2);
  assert.equal(monday.shifts[0].open, 660); assert.equal(monday.shifts[0].close, 840);
  assert.equal(monday.tasks.filter(t => t.shift === 'dinner' && t.station === 'Front of house' && t.checkpoint === 'opening').length, 8);
  for (const [date, closing] of [['2026-10-25', 1260], ['2026-10-28', 1290], ['2026-10-30', 1320], ['2026-10-31', 1290]]) {
    const day = model.createWorkDay(date, settings, policy);
    assert.equal(day.shifts.at(-1).close, closing);
    if (['2026-10-25', '2026-10-31'].includes(date)) assert.equal(day.shifts.length, 1);
  }
});
test('Work respects period closures, full closures, legacy closure dates, and split ranges', () => {
  const settings = model.defaultWorkSettings(), date = '2026-10-26';
  assert.equal(model.createWorkDay(date, settings, { ...policy, specialDates: [{ date: `${date}T00:00:00Z`, closureType: 'full' }] }).tasks.length, 0);
  assert.deepEqual(model.createWorkDay(date, settings, { ...policy, specialDates: [{ date, closureType: 'lunch' }] }).shifts.map(s => s.shift), ['dinner']);
  const hours = structuredClone(policy.businessHours);
  hours.monday.lunch.customRanges = [{ start: '11:00', end: '12:00' }, { start: '12:30', end: '14:00' }];
  const day = model.createWorkDay(date, settings, { ...policy, businessHours: hours });
  assert.equal(day.shifts.length, 3); assert.equal(new Set(day.tasks.map(t => t.id)).size, day.tasks.length);
});
test('due state uses restaurant calendar time through DST, completion wins, and dates validate', () => {
  const task = model.createWorkDay('2026-11-01', model.defaultWorkSettings(), policy).tasks[0];
  assert.equal(model.taskState(task, '2026-11-01', policy.timezone, new Date('2026-11-02T00:00:00Z')), 'due');
  assert.equal(model.taskState(task, '2026-11-01', policy.timezone, new Date('2026-11-02T01:00:00Z')), 'overdue');
  assert.equal(model.taskState(task, '2026-11-01', policy.timezone, new Date('2026-11-01T20:00:00Z')), 'upcoming');
  assert.equal(model.taskState(task, '2026-11-01', policy.timezone, new Date('2026-11-02T08:00:00Z')), 'overdue');
  assert.equal(model.taskState({ ...task, completedAt: 'done' }, '2026-11-01', policy.timezone), 'completed');
  assert.throws(() => model.createWorkDay('2026-02-30', model.defaultWorkSettings(), policy), /valid date/);
});
test('recurring task settings bound input and preserve editable stations, offsets and assignments', () => {
  const settings = model.defaultWorkSettings();
  assert.throws(() => model.validateWorkSettings({ ...settings, templates: [...settings.templates, settings.templates[0]] }), /unique/);
  assert.throws(() => model.validateTemplate({ ...settings.templates[0], offset: 241 }), /timing/);
  const template = model.validateTemplate({ ...settings.templates[0], station: 'Bar', shift: 'dinner', assignee: 'Alex', offset: -30 });
  assert.equal(model.createWorkDay('2026-10-26', { ...settings, templates: [template] }, policy).tasks[0].due, 930);
});
function fixture() {
  const records = new Map([['settings/general', { timezone: policy.timezone }], ['settings/businessHours', policy.businessHours]]);
  const snap = path => ({ exists: records.has(path), id: path.split('/').at(-1), data: () => records.has(path) ? structuredClone(records.get(path)) : undefined });
  const db = { doc: path => ({ path }), collection: path => ({ path }) };
  db.runTransaction = async fn => {
    const staged = new Map(); let wrote = false;
    const tx = {
      get: async ref => { assert.equal(wrote, false, 'no reads after writes'); return ref.path === 'specialDates' ? { docs: [] } : snap(ref.path); },
      set: (ref, value) => { wrote = true; staged.set(ref.path, structuredClone(value)); },
      create: (ref, value) => { assert.equal(records.has(ref.path) || staged.has(ref.path), false, 'unique durable intent'); wrote = true; staged.set(ref.path, structuredClone(value)); },
    };
    const result = await fn(tx); for (const [key, value] of staged) records.set(key, value); return result;
  };
  class ReservationError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const repository = load('../src/lib/work/repository.ts', { '../serverFirebase': { getServerDatabase: () => db }, '../reservations/policy': { businessTimezone: () => policy.timezone }, '../reservations/availability': availability, '../reservations/http': { ReservationError }, './model': model, '../inventory/model': inventory, './crew': { starterWorkCrew: () => structuredClone(crew) } });
  return { repository, records };
}
test('day snapshots, optimistic concurrency, audit, and exactly one checkpoint intent', async () => {
  const { repository, records } = fixture();
  const date = '2026-10-23'; // A past Friday: check-ins can be recorded late.
  let board = await repository.getWorkBoard(date);
  assert.equal(records.has(`workDays/${date}`), false, 'reading previews does not write');
  const group = board.day.tasks.filter(t => t.shift === 'dinner' && t.station === 'Front of house' && t.checkpoint === 'opening');
  let completed;
  for (const task of group) {
    completed = await repository.changeWork({ date, action: 'complete', memberId: 'manager-id', taskId: task.id, version: board.day.version, by: 'Test staff', note: '' }, 'session');
    assert.equal(completed.notificationIds.length, task.id === group.at(-1).id ? 1 : 0);
    board = completed;
  }
  const jobs = () => Array.from(records.keys()).filter(k => k.startsWith('notificationOutbox/'));
  assert.equal(jobs().length, 1);
  const version = board.day.version;
  await assert.rejects(repository.changeWork({ date, action: 'complete', memberId: 'manager-id', taskId: group[0].id, version: 0, by: 'Other device' }, 'other'), /another device/);
  assert.equal(records.get(`workDays/${date}`).version, version);
  board = await repository.changeWork({ date, action: 'reopen', taskId: group[0].id, version, by: 'Manager' }, 'session');
  board = await repository.changeWork({ date, action: 'complete', memberId: 'manager-id', taskId: group[0].id, version: board.day.version, by: 'Staff', note: 'Rechecked' }, 'session');
  assert.equal(jobs().length, 1, 'reopening never repeats a checkpoint report');
  const settings = model.defaultWorkSettings(); settings.templates = [];
  await repository.saveWorkSettings(settings, 'manager');
  assert.equal((await repository.getWorkBoard(date)).day.tasks.length, 44, 'saved plan is unchanged');
  assert.equal((await repository.getWorkBoard('2026-10-24')).day.tasks.length, 0, 'unstarted days use new recurring plan');
  await assert.rejects(repository.saveWorkSettings(settings, 'other'), /another device/);
  assert.ok(Array.from(records.keys()).some(k => k.startsWith(`workDays/${date}/events/`)));
});
test('assigned tasks can move between stations; future completions and malformed input fail without writes', async () => {
  const { repository, records } = fixture(); const date = '2099-01-02';
  let board = await repository.getWorkBoard(date);
  board = await repository.changeWork({ date, action: 'add', task: { ...model.defaultWorkSettings().templates[0], title: 'Special event prep', station: 'Prep' }, shiftId: board.day.shifts[0].id, requestId: 'synthetic-request-123', version: 0, by: 'Manager' }, 'manager-session');
  const task = board.day.tasks.at(-1);
  assert.equal(task.source, 'assigned');
  board = await repository.changeWork({ date, action: 'update', taskId: task.id, station: 'Back of house', assignee: 'Alex', version: board.day.version, by: 'Manager' }, 'manager-session');
  assert.equal(board.day.tasks.at(-1).assignee, 'Alex');
  await assert.rejects(repository.changeWork({ date, action: 'complete', memberId: 'manager-id', taskId: task.id, version: board.day.version, by: 'Alex' }, 'staff'), /Future/);
  const version = records.get(`workDays/${date}`).version;
  await assert.rejects(repository.changeWork({ date, action: 'update', taskId: task.id, station: '', assignee: '', version, by: 'Manager' }, 'staff'), /station/);
  assert.equal(records.get(`workDays/${date}`).version, version);
});
test('disabled emails do not queue completion reports', async () => {
  const { repository, records } = fixture(); const settings = model.defaultWorkSettings(); settings.emailEnabled = false; settings.crew = crew;
  await repository.saveWorkSettings(settings, 'manager'); const board = await repository.getWorkBoard('2026-10-23');
  const task = board.day.tasks.find(t => t.station === 'Prep');
  const result = await repository.changeWork({ date: board.day.date, action: 'complete', memberId: 'manager-id', taskId: task.id, version: 0, by: 'Staff' }, 'session');
  assert.equal(result.notificationIds.length, 0); assert.equal(Array.from(records.keys()).filter(k => k.startsWith('notificationOutbox/')).length, 0);
});
test('Work email escapes staff input, links directly to the dated board, and names the actual checkpoint', () => {
  const tasks = model.createWorkDay('2026-10-23', model.defaultWorkSettings(), policy).tasks.slice(0, 1).map(t => ({ ...t, title: '<script>bad</script>', completedBy: '<Staff>', note: '<img src=x>' }));
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.invalid';
  const message = renderWorkNotification({ tasks, date: '2026-10-23', timezone: policy.timezone, completedAt: '2026-10-23T18:00:00Z', completedBy: '<Staff>', to: 'owner@example.invalid' }, defaultRestaurant);
  assert.match(message.subject, /Lunch.*Front of house.*Opening/); assert.ok(message.text.includes('/admin/work?date=2026-10-23'));
  assert.ok(!message.html.includes('<script>')); assert.ok(!message.html.includes('<img src=x>')); assert.match(message.html, /&lt;Staff&gt;/);
  assert.equal(message.to, 'owner@example.invalid');
});
test('Work API denies every action before touching private work records', async () => {
  const denied = { status: 401 }; const fail = () => assert.fail('private work data must not be touched');
  const route = load('../src/app/api/staff/work/route.ts', { 'next/server': { after: fail }, '@/lib/auth/admin': { requireAdmin: async () => denied }, '@/lib/auth/rateLimit': {}, '@/lib/reservations/http': {}, '@/lib/reservations/notifications': {}, '@/lib/work/repository': { getWorkBoard: fail, changeWork: fail, saveWorkSettings: fail } });
  for (const method of ['GET', 'POST', 'PUT']) assert.equal(await route[method]({}), denied);
});

test('owner roster has the supplied FOH, kitchen and manager lists; managers can confirm either crew', () => {
  const members = starterWorkCrew();
  assert.equal(members.length, 23);
  assert.deepEqual(members.filter(m => m.role === 'both').map(m => m.name), ['James V.', 'Tom V.']);
  assert.equal(model.eligibleCrew(members, 'Front of house').length, 10);
  assert.equal(model.eligibleCrew(members, 'Back of house').length, 15);
  assert.equal(model.eligibleCrew(members, 'Prep').length, 15);
  assert.equal(model.eligibleCrew(members, 'Bar', { bar: 'kitchen' }).length, 15);
  assert.throws(() => model.validateWorkCrew([...members, members[0]]), /unique/);
});
test('server enforces station crew, rejects removed members, and snapshots the chosen identity', async () => {
  const { repository, records } = fixture(); const date = '2026-10-23';
  let board = await repository.getWorkBoard(date);
  const foh = board.day.tasks.find(t => t.station === 'Front of house');
  const kitchen = board.day.tasks.find(t => t.station === 'Prep');
  const complete = (task, memberId, version = board.day.version) => repository.changeWork({ date, action: 'complete', taskId: task.id, memberId, version, by: 'Spoofed name' }, 'session');
  await assert.rejects(complete(foh, 'kitchen-id'), /current crew member/);
  await assert.rejects(complete(kitchen, 'front-id'), /current crew member/);
  await assert.rejects(complete(foh, 'deleted-id'), /current crew member/);
  assert.equal(records.has(`workDays/${date}`), false, 'invalid identity makes no writes');
  board = await complete(foh, 'front-id');
  let saved = board.day.tasks.find(t => t.id === foh.id);
  assert.equal(saved.completedBy, 'FOH Staff'); assert.equal(saved.completedById, 'front-id'); assert.equal(saved.completedCrew, 'front');
  const settings = { ...board.settings, crew: crew.filter(m => m.id !== 'front-id') };
  await repository.saveWorkSettings(settings, 'manager');
  const other = board.day.tasks.find(t => t.station === 'Front of house' && !t.completedAt);
  await assert.rejects(complete(other, 'front-id'), /current crew member/);
  saved = (await repository.getWorkBoard(date)).day.tasks.find(t => t.id === foh.id);
  assert.equal(saved.completedBy, 'FOH Staff', 'removing a crew member preserves prior accountability');
  board = await repository.changeWork({ date, action: 'reopen', taskId: foh.id, version: board.day.version, by: 'Manager' }, 'session');
  assert.equal(board.day.tasks.find(t => t.id === foh.id).completedById, null);
});

test('FOH recurring additions belong to the requested opening and closing checkpoints on both shifts', () => {
  const settings = model.defaultWorkSettings();
  const additions = settings.templates.filter(t => ['foh-open-sweep', 'foh-open-sanitization', 'foh-close-sweep', 'foh-close-bathrooms', 'foh-close-bathroom-trash', 'foh-close-bar-trash', 'foh-close-third-party-tablets', 'foh-close-pos-ipads', 'foh-close-account'].includes(t.id));
  assert.equal(additions.length, 9);
  assert.equal(additions.filter(t => t.checkpoint === 'opening').length, 2);
  assert.equal(additions.filter(t => t.checkpoint === 'closing').length, 7);
  assert.ok(additions.every(t => t.station === 'Front of house' && t.shift === 'both' && t.enabled));
  const day = model.createWorkDay('2026-10-26', settings, policy);
  assert.equal(day.tasks.filter(t => additions.some(a => t.id.endsWith(a.id))).length, 18);
});

test('optional names default to the authoritative station team; explicit invalid people still fail', async () => {
  const { repository } = fixture(); const date = '2026-10-23'; let board = await repository.getWorkBoard(date);
  for (const [station, expected] of [['Front of house', 'FOH-Team'], ['Back of house', 'BOH-Team'], ['Prep', 'BOH-Team']]) {
    const task = board.day.tasks.find(t => t.station === station);
    board = await repository.changeWork({ date, action: 'complete', taskId: task.id, version: board.day.version, memberId: '', by: 'Spoofed team name' }, 'session');
    const saved = board.day.tasks.find(t => t.id === task.id);
    assert.equal(saved.completedBy, expected); assert.equal(saved.completedById, null); assert.equal(saved.completionIdentity, 'team'); assert.ok(saved.completedAt);
  }
  const other = board.day.tasks.find(t => t.station === 'Front of house' && !t.completedAt);
  await assert.rejects(repository.changeWork({ date, action: 'complete', taskId: other.id, version: board.day.version, memberId: 'kitchen-id' }, 'session'), /current crew member/);
});
test('goods catalog is deduplicated by identity and keeps size, brand and fresh/frozen distinctions', () => {
  assert.equal(workGoods.length, 117); assert.equal(new Set(workGoods.map(g => g.id)).size, 117);
  for (const id of ['broccoli', 'carrots', 'bean-sprouts', 'green-onions', 'oyster-panda']) assert.equal(workGoods.filter(g => g.id === id).length, 1);
  for (const id of ['soup-8oz', 'soup-16oz', 'soup-32oz', 'chicken-breast-fresh', 'chicken-breast-frozen', 'oyster-kum-chun', 'oyster-panda', 'singha-large', 'singha-small']) assert.ok(workGoods.some(g => g.id === id));
  const settings = model.defaultWorkSettings(); assert.equal(settings.templates.length, 22); assert.doesNotThrow(() => model.validateWorkSettings(settings));
  const day = model.createWorkDay('2026-10-26', settings, policy); assert.equal(day.tasks.length, 44);
  const goods = day.tasks.filter(t => t.id.includes('boh-goods-')); assert.equal(goods.length, 0); assert.ok(goods.every(t => t.category && t.station === 'Back of house' && t.checkpoint === 'opening'));
  assert.equal(day.tasks.filter(model.isInventoryTask).length, 2);
  assert.ok(day.tasks.filter(model.isInventoryTask).every(t => t.title === 'Inventory Check'));
  assert.equal(goodsTemplates().filter(t => t.id === 'boh-goods-broccoli').length, 1);
});

test('Inventory Check cannot bypass goods decisions or complete using stale checks', async () => {
  const { repository, records } = fixture(), date = '2026-10-23';
  const board = await repository.getWorkBoard(date), task = board.day.tasks.find(model.isInventoryTask);
  const input = { action: 'complete', date, taskId: task.id, version: 0, memberId: '' };
  await assert.rejects(repository.changeWork(input, 'session'), /every item first/);
  assert.equal(records.has(`workDays/${date}`), false);
  const items = Object.fromEntries(workGoods.map(g => [g.id, { checkedOn: '2026-10-22', decision: 'sufficient' }]));
  records.set('inventory/current', { items });
  await assert.rejects(repository.changeWork(input, 'session'), /every item first/);
  for (const item of Object.values(items)) item.checkedOn = date;
  records.set('inventory/current', { items });
  const result = await repository.changeWork(input, 'session');
  assert.equal(result.day.tasks.find(model.isInventoryTask).completedBy, 'BOH-Team');
  assert.ok(result.day.tasks.find(model.isInventoryTask).completedAt);
});
