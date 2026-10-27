import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  let servicesCount: number | string = 'n/a'
  try {
    const res = await fetch(`${url}/rest/v1/services?select=id`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    })
    const range = res.headers.get('content-range')
    servicesCount = range ? range.split('/')[1] : 'no-range'
  } catch (e) {
    servicesCount = 'error'
  }

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    env: process.env.VERCEL_ENV ?? null,
    dbHost: url ? new URL(url).host : null,
    servicesCount,
  })
}
