import { privateJson } from '@/lib/reservations/http';
export async function POST() {
  return privateJson({ error: 'Submit feedback using your secure feedback link.' }, 410);
}
