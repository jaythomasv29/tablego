import { bookingState } from './domain.ts';
import { restaurantClock, timeMinutes } from './availability.ts';
import { getLocalDateString } from '../../utils/dateUtils.ts';
import { timestampString } from './service.ts';
export const feedbackSentiments = ['good', 'neutral', 'bad', 'did-not-attend'] as const;
export type FeedbackSentiment = typeof feedbackSentiments[number];
export function feedbackSettings(value: Record<string, unknown> = {}) {
  const delay = value.followUpDelayMinutes === undefined ? 90 : value.followUpDelayMinutes;
  if (!Number.isInteger(delay) || Number(delay) < 0 || Number(delay) > 10080) throw new Error('Follow-up delay must be 0–10,080 minutes');
  const reviewUrl = value.reviewUrl === undefined ? '' : value.reviewUrl;
  if (typeof reviewUrl !== 'string' || reviewUrl.length > 500) throw new Error('Invalid review link');
  if (reviewUrl) {
    try { const url = new URL(reviewUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
    catch { throw new Error('Review link must be an HTTPS URL'); }
  }
  return { followUpDelayMinutes: Number(delay), reviewUrl };
}
export function followUpEligibility(record: Record<string, unknown>, timezone: string, delay: number, now = new Date()) {
  if (bookingState(record) !== 'completed') return { eligible: false, reason: 'Complete the visit before sending a follow-up.' };
  if (record.followUpSent === true) return { eligible: false, reason: 'A follow-up has already been sent.' };
  if (record.feedbackSubmissionHash || record.feedbackRespondedAt || record.privateFeedbackAt || record.privateFeedback) return { eligible: false, reason: 'Feedback has already been recorded.' };
  if (typeof record.email !== 'string' || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(record.email)) return { eligible: false, reason: 'A valid saved guest email is required.' };
  try {
    const date = getLocalDateString(record.date, timezone), clock = restaurantClock(timezone, now), minutes = timeMinutes(record.time);
    if (minutes === null) return { eligible: false, reason: 'Reservation time needs staff review.' };
    if (date > clock.date || (date === clock.date && minutes > clock.minutes)) return { eligible: false, reason: 'The scheduled arrival has not occurred in the restaurant timezone.' };
  }
  catch { return { eligible: false, reason: 'Reservation date needs staff review.' }; }
  const completedAt = timestampString(record.completedAt);
  if (record.completedAt && !completedAt) return { eligible: false, reason: 'Completion time needs staff review.' };
  if (completedAt && now.getTime() < new Date(completedAt).getTime() + delay * 60_000) return { eligible: false, reason: 'The follow-up delay has not elapsed.' };
  return { eligible: true, reason: completedAt ? '' : 'Legacy completion has no timestamp; review the visit before sending.' };
}
export function feedbackInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Feedback is required');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !['sentiment', 'comment', 'stopFollowUps'].includes(key))) throw new Error('Unknown feedback field');
  if (!feedbackSentiments.includes(body.sentiment as FeedbackSentiment)) throw new Error('Choose how your visit went');
  if (typeof body.comment !== 'string' || body.comment.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.comment)) throw new Error('Feedback must be at most 2,000 characters');
  if (body.stopFollowUps !== undefined && typeof body.stopFollowUps !== 'boolean') throw new Error('Invalid follow-up preference');
  return { sentiment: body.sentiment as FeedbackSentiment, comment: body.comment.trim(), stopFollowUps: body.stopFollowUps === true };
}
