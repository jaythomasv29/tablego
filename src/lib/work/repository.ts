import { inventoryReady, mergeInventoryGoods, type CheckGood } from '../inventory/model';
import { starterWorkCrew } from './crew';
import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { getServerDatabase } from '../serverFirebase';
import { businessTimezone } from '../reservations/policy';
import { restaurantClock, validDate } from '../reservations/availability';
import { ReservationError } from '../reservations/http';
import { isInventoryTask, createWorkDay, defaultWorkHours, defaultWorkSettings, groupKey, teamForStation, workTaskDetails, eligibleCrew, crewForStation, validateTemplate, validateWorkSettings, workText, type WorkDay, type WorkTask, type WorkBoard } from './model';

function dateInput(date: unknown): string {
  if (!validDate(date)) throw new ReservationError('Choose a valid date');
  return date;
}
async function context(tx: Transaction, date?: string) {
  const db = getServerDatabase();
  const [settings, general, hours, special, saved] = await Promise.all([
    tx.get(db.doc('workSettings/current')), tx.get(db.doc('settings/general')), tx.get(db.doc('settings/businessHours')),
    tx.get(db.collection('specialDates')), date ? tx.get(db.doc(`workDays/${date}`)) : Promise.resolve(null),
  ]);
  const raw = settings.exists ? settings.data()! : defaultWorkSettings();
  const config = validateWorkSettings({ ...raw, crew: raw.crew !== undefined && settings.exists ? raw.crew : starterWorkCrew() });
  const timezone = businessTimezone(general.data());
  const policy = { timezone, businessHours: config.hoursSource === 'work' ? config.hours : hours.exists ? hours.data() as ReturnType<typeof defaultWorkHours> : defaultWorkHours(), specialDates: special.docs.map(d => d.data()) as { date: string; closureType?: 'full' | 'lunch' | 'dinner' }[] };
  const day = date ? saved?.exists ? saved.data() as WorkDay : createWorkDay(date, config, policy) : undefined;
  const crew = config.crew;
  return { config, day, crew, initialized: Boolean(saved?.exists), timezone, hoursSource: config.hoursSource === 'work' ? 'Work shift hours' : hours.exists ? 'Restaurant hours' : 'Starter hours supplied for Work' };
}
function board(ctx: Awaited<ReturnType<typeof context>>): WorkBoard {
  const day = ctx.day!;
  const clock = restaurantClock(day.timezone);
  return { day, settings: ctx.config, crew: ctx.crew, today: clock.date, nowMinutes: clock.minutes, initialized: ctx.initialized,
    emailCapture: process.env.TABLEGO_NOTIFICATION_MODE === 'capture', emailConfigured: process.env.TABLEGO_NOTIFICATION_MODE === 'capture' || Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS), emailRecipient: process.env.EMAIL_USER || '', hoursSource: ctx.hoursSource };
}
export async function getWorkBoard(date?: string | null) {
  const selected = date ? dateInput(date) : undefined;
  return getServerDatabase().runTransaction(async tx => {
    const initial = await context(tx, selected);
    if (selected) return board(initial);
    return board(await context(tx, restaurantClock(initial.timezone).date));
  });
}
export async function saveWorkSettings(input: unknown, actor: string) {
  let settings;
  try { settings = validateWorkSettings(input); } catch (error) { throw new ReservationError((error as Error).message); }
  const db = getServerDatabase();
  return db.runTransaction(async tx => {
    const current = await tx.get(db.doc('workSettings/current'));
    if ((current.data()?.version || 0) !== settings.version) throw new ReservationError('Recurring tasks changed on another device. Reload before saving.', 409);
    const supplied = input as Record<string, unknown>;
    const previous = current.data();
    const next = { ...settings, ...(supplied.crew === undefined ? { crew: previous?.crew ?? starterWorkCrew() } : {}), ...(supplied.stationCrews === undefined ? { stationCrews: previous?.stationCrews ?? {} } : {}), version: settings.version + 1 };
    tx.set(db.doc('workSettings/current'), next);
    tx.create(db.doc(`workSettings/current/events/${randomUUID()}`), { action: 'settings.updated', actor, at: new Date().toISOString(), version: next.version, settings: next });
    return { settings: next };
  });
}
export async function changeWork(input: unknown, actor: string) {
  if (!input || typeof input !== 'object') throw new ReservationError('Enter a valid Work action');
  const v = input as Record<string, unknown>, date = dateInput(v.date);
  if (!Number.isInteger(v.version) || Number(v.version) < 0 || !['complete', 'reopen', 'add', 'update'].includes(String(v.action))) throw new ReservationError('Enter a valid action and checklist version');
  const db = getServerDatabase();
  return db.runTransaction(async tx => {
    const ctx = await context(tx, date), day = ctx.day!;
    if (!ctx.initialized && v.settingsVersion !== undefined && v.settingsVersion !== ctx.config.version) throw new ReservationError('The recurring plan changed. Refresh before checking in.', 409);
    if (day.version !== v.version) throw new ReservationError('This checklist changed on another device. Refresh before trying again.', 409);
    const inventory = v.action === 'complete' && day.tasks.some(t => t.id === v.taskId && isInventoryTask(t)) ? await tx.get(db.doc('inventory/current')) : null;
    const catalog = inventory ? await tx.get(db.collection('inventoryOperations/goods/records').limit(1000)) : null;
    const goods = mergeInventoryGoods(catalog?.docs.map(d => ({ ...d.data(), id: d.id }) as CheckGood) || []);
    const before = JSON.parse(JSON.stringify(day)) as WorkDay;
    let task = day.tasks.find(t => t.id === v.taskId);
    try {
      let by = v.action === 'complete' ? '' : workText(v.by, 'your name', 80);
      if (v.action === 'add') {
        if (day.tasks.length >= 500) throw new Error('This day already has 500 tasks');
        const template = validateTemplate(v.task);
        const period = day.shifts.find(s => s.id === v.shiftId);
        if (!period) throw new Error('Choose an open shift. Closed days have no work shifts.');
        if (typeof v.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(v.requestId)) throw new Error('A task submission key is required');
        const id = `assigned-${v.requestId}`;
        if (day.tasks.some(t => t.id === id)) throw new Error('This task was already added. Refresh the checklist.');
        task = { id, title: template.title, ...workTaskDetails(template), station: template.station, shift: period.shift, range: period.range, checkpoint: template.checkpoint,
          due: Math.max(0, Math.min(1439, (template.checkpoint === 'closing' ? period.close : period.open) + template.offset)), assignee: template.assignee, completedAt: null, completedBy: '', note: '', source: 'assigned' };
        day.tasks.push(task);
      } else {
        if (!task) throw new Error('This task no longer exists');
        if (v.action === 'complete') {
          if (date > restaurantClock(day.timezone).date) throw new Error('Future checklists cannot be completed in advance');
          if (isInventoryTask(task) && !inventoryReady(inventory?.data()?.items || {}, date, goods)) throw new Error('Open Inventory Check and save a review decision for every item first');
          if (task.completedAt) throw new Error('This task is already complete');
          const personSelected = v.memberId !== undefined && v.memberId !== null && v.memberId !== '';
          const member = personSelected ? eligibleCrew(ctx.crew, task.station, ctx.config.stationCrews).find(m => m.id === v.memberId) : undefined;
          if (personSelected && !member) throw new Error('Choose a current crew member for this station. Refresh if the crew list has changed.');
          by = member?.name || teamForStation(task.station, ctx.config.stationCrews);
          task.completedAt = new Date().toISOString(); task.completedBy = by; task.completedById = member?.id || null; task.completedCrew = crewForStation(task.station, ctx.config.stationCrews); task.completionIdentity = member ? 'person' : 'team';
          task.note = workText(v.note ?? '', 'a note', 500, false);
        } else if (v.action === 'reopen') {
          if (!task.completedAt) throw new Error('This task is already open');
          task.completedAt = null; task.completedBy = ''; task.completedById = null; task.completedCrew = null; delete task.completionIdentity; task.note = '';
        } else {
          if (isInventoryTask(task) && !inventoryReady(inventory?.data()?.items || {}, date, goods)) throw new Error('Open Inventory Check and save a review decision for every item first');
          if (task.completedAt) throw new Error('Reopen this task before changing its assignment');
          task.station = workText(v.station, 'a station', 50);
          task.assignee = workText(v.assignee, 'an assignee', 80, false);
        }
      }
      const now = new Date().toISOString();
      const notificationIds: string[] = [];
      // Completion reports are immutable historical events: once per station/checkpoint/shift/day.
      // Reopening a task stays visible in the live board and audit trail, without repeating the email.
      const key = groupKey(task!);
      const members = day.tasks.filter(t => groupKey(t) === key);
      const previousMembers = before.tasks.filter(t => groupKey(t) === key);
      if (v.action === 'complete' && members.length && members.every(t => t.completedAt) && !previousMembers.every(t => t.completedAt) && !day.notified[key]) {
        day.notified[key] = now;
        if (ctx.config.emailEnabled) {
          const id = `work-${date}-${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
          notificationIds.push(id);
          tx.create(db.doc(`notificationOutbox/${id}`), { kind: 'work', date, timezone: day.timezone, completedAt: now, completedBy: by,
            tasks: members, to: process.env.EMAIL_USER || '', recipient: 'restaurant', channel: 'email', state: 'queued', attempts: 0, createdAt: new Date(), nextAttemptAt: new Date() });
        }
      }
      day.version += 1;
      tx.set(db.doc(`workDays/${date}`), day);
      tx.create(db.doc(`workDays/${date}/events/${randomUUID()}`), { action: v.action, taskId: task!.id, by, actor, at: now, version: day.version,
        before: before.tasks.find(t => t.id === task!.id) || null, after: task });
      return { ...board({ ...ctx, initialized: true }), notificationIds };
    } catch (error) {
      if (error instanceof ReservationError) throw error;
      throw new ReservationError((error as Error).message);
    }
  });
}

export async function getWorkHistory(date: string) {
  dateInput(date);
  const events = await getServerDatabase().collection(`workDays/${date}/events`).orderBy('at', 'desc').limit(80).get();
  return { events: events.docs.map(doc => { const v = doc.data(); return { action: v.action, at: v.at, by: v.by || '', title: v.after?.title || '', deliveryMode: v.deliveryMode || '' }; }) };
}
