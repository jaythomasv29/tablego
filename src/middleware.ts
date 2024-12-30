import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add your admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export function middleware(request: NextRequest) {
    // Only protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const authHeader = request.headers.get('authorization');

        if (!authHeader) {
            return new NextResponse(null, {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Basic realm="Secure Area"'
                }
            });
        }

        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        if (user !== ADMIN_USERNAME || pass !== ADMIN_PASSWORD) {
            return new NextResponse(null, {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Basic realm="Secure Area"'
                }
            });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/admin/:path*'
}; 