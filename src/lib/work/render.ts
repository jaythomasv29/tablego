import { escapeHtml } from '../formatting/html.ts';
import { checkpointLabels, type WorkTask } from './model.ts';
import { displayTime } from '../reservations/availability.ts';
import type { RestaurantIdentity } from '../restaurant/config.ts';
export interface WorkNotification { date: string; timezone: string; completedAt: string; completedBy: string; tasks: WorkTask[]; to: string }
export function renderWorkNotification(job: WorkNotification, restaurant: RestaurantIdentity) {
  const task = job.tasks[0];
  if (!task) throw new Error('A completed checkpoint is required');
  const label = `${task.shift === 'lunch' ? 'Lunch' : 'Dinner'} · ${task.station} · ${checkpointLabels[task.checkpoint]}`;
  const url = new URL(`/admin/work?date=${job.date}`, process.env.NEXT_PUBLIC_BASE_URL).toString();
  const identityLabel = job.tasks.every(t => t.completionIdentity === 'team') ? 'team check-in' : job.tasks.some(t => t.completionIdentity) ? 'team or crew selection on the staff device' : job.tasks.every(t => t.completedById) ? 'crew selection on the staff device' : 'staff-entered name';
  const completed = new Date(job.completedAt).toLocaleString('en-US', { timeZone: job.timezone });
  const subject = `Work checkpoint completed: ${label} — ${job.date}`;
  const text = `${restaurant.name}\n${label}\nDate: ${job.date}\nCompleted at ${completed} (${job.timezone}).\nReported by: ${job.completedBy} (${identityLabel})\n\n${job.tasks.map(t => `${t.title}${t.detail ? ` (${t.detail})` : ''} — ${t.completedBy}, due ${displayTime(t.due)}${t.note ? `; note: ${t.note}` : ''}`).join('\n')}\n\nThis records completion at that time. See the current checklist and any later changes: ${url}`;
  const e = escapeHtml;
  return { from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to: job.to, subject, text,
    html: `<html><body style="margin:0;background:#F9F7F2;color:#121212;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:white;border:1px solid #EAE0D5" cellspacing="0" cellpadding="28"><tr><td><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase">${e(restaurant.name)} · Work</p><h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400">Ready for what’s next.</h1><p style="font-size:18px">${e(label)}</p><p>${e(job.date)} · Completed ${e(completed)} (${e(job.timezone)})</p><p>Reported by ${e(job.completedBy)} <small>(${e(identityLabel)})</small></p><table width="100%" cellpadding="12" cellspacing="0" style="border-collapse:collapse">${job.tasks.map(t => `<tr><td style="border-top:1px solid #EAE0D5"><strong>${e(t.title)}</strong>${t.detail ? `<br>${e(t.detail)}` : ''}<br><span style="color:#595959">${e(t.completedBy)} · Due ${e(displayTime(t.due))}${t.note ? `<br>${e(t.note)}` : ''}</span></td></tr>`).join('')}</table><p style="margin:28px 0"><a href="${e(url)}" style="display:inline-block;background:#121212;color:white;padding:16px 24px;text-decoration:none;border-radius:6px">View Work checklist</a></p><p style="color:#595959;font-size:13px">This records completion at that time. The Work board shows any later changes.</p></td></tr></table></td></tr></table></body></html>` };
}
