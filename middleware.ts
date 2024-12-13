import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
        // Check for company password cookie
        const companyAuth = request.cookies.get('company-auth');

        if (!companyAuth) {
            // Store the original URL they were trying to access
            const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', callbackUrl);

            return NextResponse.redirect(loginUrl);
        }
    }
    return NextResponse.next();
}

export const config = {
    matcher: '/admin/:path*',
}
