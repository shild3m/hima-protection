import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function countRows(url: string, key: string, table: string) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    })
    const range = res.headers.get('content-range')
    return { status: res.status, count: range ? range.split('/')[1] : null }
  } catch {
    return { status: 0, count: null }
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    dbHost: url ? new URL(url).host : null,
    anonServices: await countRows(url, anon, 'services'),
    adminBookings: await countRows(url, secret, 'bookings'),
  })
}
