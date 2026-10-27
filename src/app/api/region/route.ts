import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    env: process.env.VERCEL_ENV ?? null,
    now: new Date().toISOString(),
  })
}
