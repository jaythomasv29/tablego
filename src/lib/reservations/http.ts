import { NextResponse } from 'next/server';
export class ReservationError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function reservationError(error: unknown) {
  if (error instanceof SyntaxError) error = new ReservationError('Enter a valid JSON request');
  return NextResponse.json({ success: false, error: error instanceof ReservationError ? error.message : 'Unable to complete this request. Please try again or call the restaurant.' },
    { status: error instanceof ReservationError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
