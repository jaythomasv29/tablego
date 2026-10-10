import { NextResponse, type NextRequest } from 'next/server';
import { verifySignedToken } from './src/lib/auth/signedToken';

export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
        // Check for company password cookie
        const companyAuth = request.cookies.get('company-auth');

        if (!await verifySignedToken(companyAuth?.value, 'admin')) {
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
