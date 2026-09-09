import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ isStaff: false })
  }

  return NextResponse.json({
    isStaff: true,
    role: currentUser.role_name,
    permissions: currentUser.permissions,
  })
}
