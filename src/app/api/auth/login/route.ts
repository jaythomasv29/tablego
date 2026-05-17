import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { username, password, remember } = await request.json();

    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {
        const maxAge = remember
            ? 60 * 60 * 24 * 365  // 1 year
            : 60 * 60 * 24;       // 24 hours

        const response = NextResponse.json({ success: true });
        response.cookies.set('company-auth', 'true', {
            path: '/',
            maxAge,
            secure: true,
            sameSite: 'strict',
            httpOnly: true,
        });
        return response;
    }

    return NextResponse.json({ success: false }, { status: 401 });
}
