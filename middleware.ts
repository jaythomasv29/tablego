import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
        // Get the token using next-auth
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET
        })

        const isAuthenticated = !!token && token.role === 'admin' // Check for admin role

        if (!isAuthenticated) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }
    return NextResponse.next()
}

export const config = {
    matcher: '/admin/:path*',
}
