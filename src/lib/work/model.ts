import { validateHours } from '../restaurant/hours.ts';
import { restaurantClock, timeMinutes, validDate, closureDate, type AvailabilityPolicy } from '../reservations/availability.ts';

export const shifts = ['lunch', 'dinner'] as const;
export const checkpoints = ['opening', 'service', 'closing'] as const;
export type Shift = typeof shifts[number];
export type Checkpoint = typeof checkpoints[number];
export const checkpointLabels = { opening: 'Opening', service: 'During service', closing: 'Closing' };
export interface WorkTemplate { id: string; title: string; category?: string; detail?: string; station: string; shift: Shift | 'both'; checkpoint: Checkpoint; offset: number; assignee: string; enabled: boolean }
export interface WorkSettings { version: number; templates: WorkTemplate[]; emailEnabled: boolean; hoursSource: 'work' | 'restaurant'; hours: AvailabilityPolicy['businessHours']; stationCrews: Record<string, WorkCrew>; crew: WorkCrewMember[] }
export interface WorkTask { id: string; title: string; category?: string; detail?: string; station: string; shift: Shift; range: number; checkpoint: Checkpoint; due: number; assignee: string; completedAt: string | null; completedBy: string; completedById?: string | null; completedCrew?: WorkCrew | null; completionIdentity?: 'team' | 'person'; note: string; source: 'recurring' | 'assigned' }
export interface WorkShift { id: string; shift: Shift; range: number; open: number; close: number }
export interface WorkDay { date: string; timezone: string; version: number; settingsVersion: number; tasks: WorkTask[]; shifts: WorkShift[]; notified: Record<string, string> }
export interface WorkBoard { day: WorkDay; settings: WorkSettings; crew: WorkCrewMember[]; today: string; nowMinutes: number; initialized: boolean; emailConfigured: boolean; emailCapture: boolean; emailRecipient: string; hoursSource: string }
const front = ['Set up patio', 'Check soft drinks', 'Check bar liquor', 'Stock to-go essentials', 'Refill hot sauce and condiments', 'Set plates and silverware'];
export function defaultWorkSettings(): WorkSettings {
  const make = (id: string, title: string, station: string, checkpoint: Checkpoint, offset = 0): WorkTemplate => ({ id, title, station, checkpoint, offset, shift: 'both', assignee: '', enabled: true });
  return { version: 0, emailEnabled: true, stationCrews: {}, crew: [], hoursSource: 'work', hours: defaultWorkHours(), templates: [
    ...front.map((title, i) => make(`foh-open-${i}`, title, 'Front of house', 'opening')),
    make('foh-service', 'Check dining room, restrooms, and service supplies', 'Front of house', 'service', 60),
    make('foh-close', 'Reset dining room and put away patio', 'Front of house', 'closing', 30),
    make('foh-open-sweep', 'Sweep dining area', 'Front of house', 'opening'),
    make('foh-open-sanitization', 'Set up sanitization bucket', 'Front of house', 'opening'),
    make('foh-close-sweep', 'Sweep dining area (closing)', 'Front of house', 'closing', 30),
    make('foh-close-bathrooms', 'Sanitize and check bathrooms', 'Front of house', 'closing', 30),
    make('foh-close-bathroom-trash', 'Take out bathroom trash', 'Front of house', 'closing', 30),
    make('foh-close-bar-trash', 'Empty bar trash', 'Front of house', 'closing', 30),
    make('foh-close-third-party-tablets', 'Charge third-party tablets', 'Front of house', 'closing', 30),
    make('foh-close-pos-ipads', 'Charge server POS iPads', 'Front of house', 'closing', 30),
    make('foh-close-account', 'Close account', 'Front of house', 'closing', 30),
    make('boh-open', 'Check station readiness and service supplies', 'Back of house', 'opening'),
    make('boh-service', 'Check stock and communicate low items', 'Back of house', 'service', 60),
    make('boh-close', 'Finish station cleaning and closing checks', 'Back of house', 'closing', 30),
    make('prep-open', 'Review prep list and confirm quantities with the kitchen', 'Prep', 'opening'),
    make('boh-inventory', 'Inventory Check', 'Back of house', 'opening'),
  ] };
}
export function workText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Enter ${label} (${required ? '1–' : 'up to '}${max} characters)`);
  return value.trim();
}
export function validateTemplate(value: unknown): WorkTemplate {
  if (!value || typeof value !== 'object') throw new Error('Enter a valid task');
  const v = value as WorkTemplate;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(v.id) || ![...shifts, 'both'].includes(v.shift) || !checkpoints.includes(v.checkpoint) || !Number.isInteger(v.offset) || v.offset < -120 || v.offset > 240 || typeof v.enabled !== 'boolean') throw new Error('Check the task shift, checkpoint, and timing (−120 to 240 minutes)');
  const category = workText(v.category ?? '', 'a goods group', 50, false);
  const detail = workText(v.detail ?? '', 'item details', 200, false);
  return { ...(category ? { category } : {}), ...(detail ? { detail } : {}), id: v.id, title: workText(v.title, 'a task title', 160), station: workText(v.station, 'a station', 50), shift: v.shift, checkpoint: v.checkpoint, offset: v.offset, assignee: workText(v.assignee, 'an assignee', 80, false), enabled: v.enabled };
}
export function validateWorkSettings(value: unknown): WorkSettings {
  const v = value as WorkSettings;
  if (!v || !Number.isInteger(v.version) || v.version < 0 || !Array.isArray(v.templates) || v.templates.length > 160 || typeof v.emailEnabled !== 'boolean') throw new Error('Use up to 160 recurring tasks and a valid settings version');
  const templates = v.templates.map(validateTemplate);
  if (new Set(templates.map(t => t.id)).size !== templates.length) throw new Error('Task IDs must be unique');
  if (!['work', 'restaurant'].includes(v.hoursSource)) throw new Error('Choose Work hours or restaurant hours');
  return { version: v.version, templates, emailEnabled: v.emailEnabled, hoursSource: v.hoursSource, hours: validateHours(v.hours), stationCrews: validateStationCrews(v.stationCrews), crew: validateWorkCrew(v.crew) };
}
export function defaultWorkHours(): AvailabilityPolicy['businessHours'] {
  return Object.fromEntries(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day, i) => [day, {
    lunch: { open: '11:00', close: '14:00', isOpen: i > 0 && i < 6 },
    dinner: { open: '16:00', close: i === 5 ? '22:00' : [3, 4, 6].includes(i) ? '21:30' : '21:00', isOpen: true },
  }]));
}
export function createWorkDay(date: string, settings: WorkSettings, policy: Pick<AvailabilityPolicy, 'businessHours' | 'specialDates' | 'timezone'>): WorkDay {
  if (!validDate(date)) throw new Error('Choose a valid date');
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
  const hours = policy.businessHours[weekday], closures = policy.specialDates.filter(s => closureDate(s.date) === date);
  if (!hours) throw new Error('Work hours are missing');
  const day: WorkDay = { date, timezone: policy.timezone, version: 0, settingsVersion: settings.version, tasks: [], shifts: [], notified: {} };
  if (closures.some(c => !c.closureType || c.closureType === 'full')) return day;
  for (const shift of shifts) {
    const config = hours[shift];
    if (!config?.isOpen || closures.some(c => c.closureType === shift)) continue;
    const ranges = config.customRanges?.length ? config.customRanges : [{ start: config.open, end: config.close }];
    ranges.forEach((range, index) => {
      const open = timeMinutes(range.start), close = timeMinutes(range.end);
      if (open === null || close === null || close <= open) throw new Error('Work requires valid same-day shift hours');
      day.shifts.push({ id: `${shift}-${index}`, shift, range: index, open, close });
      for (const task of settings.templates.filter(t => t.enabled && (t.shift === 'both' || t.shift === shift))) {
        day.tasks.push({ id: `${shift}-${index}-${task.id}`, title: task.title, ...workTaskDetails(task), station: task.station, shift, range: index, checkpoint: task.checkpoint, due: Math.max(0, Math.min(1439, (task.checkpoint === 'closing' ? close : open) + task.offset)), assignee: task.assignee, completedAt: null, completedBy: '', note: '', source: 'recurring' });
      }
    });
  }
  if (day.tasks.length > 500) throw new Error('Too many tasks for one day; reduce recurring tasks or custom hour ranges');
  return day;
}
export function groupKey(task: Pick<WorkTask, 'shift' | 'range' | 'station' | 'checkpoint'>): string { return JSON.stringify([task.shift, task.range, task.station, task.checkpoint]); }
export function taskState(task: WorkTask, date: string, timezone: string, now = new Date()): 'completed' | 'upcoming' | 'due' | 'overdue' {
  if (task.completedAt) return 'completed';
  const clock = restaurantClock(timezone, now);
  if (date < clock.date) return 'overdue';
  if (date > clock.date || task.due > clock.minutes) return 'upcoming';
  return clock.minutes > task.due + 30 ? 'overdue' : 'due';
}

export type WorkCrew = 'front' | 'kitchen';
export interface WorkCrewMember { id: string; name: string; role: WorkCrew | 'both' }
export function crewForStation(station: string, assignments: Record<string, WorkCrew> = {}): WorkCrew {
  const key = station.trim().toLowerCase();
  const configured = Object.prototype.hasOwnProperty.call(assignments, key) ? assignments[key] : undefined;
  return configured || (['back of house', 'boh', 'kitchen', 'prep'].includes(key) ? 'kitchen' : 'front');
}
export function eligibleCrew(members: WorkCrewMember[], station: string, assignments: Record<string, WorkCrew> = {}) {
  const crew = crewForStation(station, assignments);
  return members.filter(m => m.role === crew || m.role === 'both');
}
export function validateStationCrews(value: unknown): Record<string, WorkCrew> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 80) throw new Error('Enter valid station crew assignments');
  const result: Record<string, WorkCrew> = {};
  for (const [key, crew] of Object.entries(value)) {
    const station = workText(key, 'a station', 50).toLowerCase();
    if (!['front', 'kitchen'].includes(String(crew)) || ['__proto__', 'constructor', 'prototype'].includes(station)) throw new Error('Choose front of house or kitchen for each station');
    result[station] = crew as WorkCrew;
  }
  return result;
}

export function validateWorkCrew(value: unknown): WorkCrewMember[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use up to 100 crew members');
  const members = value.map(member => {
    if (!member || typeof member !== 'object' || typeof member.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(member.id) || !['front', 'kitchen', 'both'].includes(member.role)) throw new Error('Enter a valid crew member and role');
    return { id: member.id, name: workText(member.name, 'a crew name', 80), role: member.role as WorkCrewMember['role'] };
  });
  if (new Set(members.map(m => m.id)).size !== members.length || new Set(members.map(m => m.name.toLowerCase())).size !== members.length) throw new Error('Crew names and IDs must be unique');
  return members;
}

export function workTaskDetails(task: Pick<WorkTemplate, 'category' | 'detail'>) { return { ...(task.category ? { category: task.category } : {}), ...(task.detail ? { detail: task.detail } : {}) }; }
export function teamForStation(station: string, assignments: Record<string, WorkCrew> = {}) { return crewForStation(station, assignments) === 'kitchen' ? 'BOH-Team' : 'FOH-Team'; }

export function isInventoryTask(task: Pick<WorkTask, 'id' | 'title'>) { return task.id.endsWith('boh-inventory') || task.title.trim().toLowerCase() === 'inventory check'; }
