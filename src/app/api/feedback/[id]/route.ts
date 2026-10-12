import { validMutationOrigin } from '@/lib/auth/admin';
import { readFeedback, submitFeedback } from '@/lib/reservations/feedbackRepository';
import { privateJson, reservationError } from '@/lib/reservations/http';
type Context = { params: Promise<{ id: string }> };
const token = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer /, '');
export async function GET(request: Request, context: Context) {
  const id = (await context.params).id;
  // Old emailed GET links remain readable but can never change attendance.
  if (new URL(request.url).searchParams.has('s')) return new Response(null, { status: 303, headers: { Location: '/feedback/' + encodeURIComponent(id), 'Cache-Control': 'private, no-store' } });
  try { return privateJson(await readFeedback(id, token(request))); } catch (error) { return reservationError(error); }
}
export async function POST(request: Request, context: Context) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try { return privateJson(await submitFeedback((await context.params).id, token(request), await request.json())); }
  catch (error) { return reservationError(error); }
}
