import { NextResponse } from 'next/server';

export async function GET() {
    return new NextResponse(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
} 