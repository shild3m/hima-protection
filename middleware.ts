import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
    // ─── BLOCK test endpoints in production ──────────────────────────
    if (process.env.NODE_ENV === 'production' && request.nextUrl.pathname.startsWith('/api/test/')) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    // ─── Force HTTPS ────────────────────────────────────────────────
    if (request.nextUrl.protocol === 'http:' && !request.nextUrl.hostname.includes('localhost')) {
        const httpsUrl = request.nextUrl.clone()
        httpsUrl.protocol = 'https:'
        return NextResponse.redirect(httpsUrl)
    }

    // ─── Security Headers ───────────────────────────────────────────
    const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
    const isPublicApi = request.nextUrl.pathname.startsWith('/api/otp/') ||
        request.nextUrl.pathname.startsWith('/api/settings/public') ||
        request.nextUrl.pathname === '/api/server-time' ||
        request.nextUrl.pathname === '/api/maintenance-check'

    const response = await (async () => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
        }
        return await updateSession(request)
    })()

    // ─── CORS (restrict to configured origin for API routes) ─────────
    if (isApiRoute) {
        const isWebhookOrCallback =
            request.nextUrl.pathname === '/api/otp/sms-webhook'

        if (!isWebhookOrCallback) {
            const origin = request.headers.get('origin')
            const referer = request.headers.get('referer')
            const allowedOrigins = [
                process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app'),
                'https://hima-protection.vercel.app',
                'https://www.shantatravel.com',
            ].filter(Boolean) as string[]
            const host = request.headers.get('host')
            if (host) {
                allowedOrigins.push(`https://${host}`)
            }
            const refererHost = referer ? new URL(referer).origin : null
            const isAllowedOrigin = origin && allowedOrigins.includes(origin)
            const isAllowedReferer = refererHost && allowedOrigins.includes(refererHost)
            const isInternalNavigation = !origin && referer && isAllowedReferer

            if (!isAllowedOrigin && !isInternalNavigation) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            const responseOrigin = isAllowedOrigin ? origin : allowedOrigins[0]
            response.headers.set('Access-Control-Allow-Origin', responseOrigin!)
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            response.headers.set('Access-Control-Allow-Credentials', 'true')
            response.headers.set('Access-Control-Max-Age', '86400')

            if (request.method === 'OPTIONS') {
                return new Response(null, { status: 204, headers: response.headers })
            }
        }
    }

    // ─── Content Security Policy ────────────────────────────────────
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://flagcdn.com https://cf.bstatic.com https://*.googleusercontent.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://graph.facebook.com",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ')

    response.headers.set('Content-Security-Policy', cspDirectives)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '0')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|opengraph-image.png|robots.txt|sitemap.xml|manifest.webmanifest).*)',
    ],
}
