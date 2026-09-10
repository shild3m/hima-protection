'use client'

import { AuthProvider } from '@/components/AuthProvider'
import type { CurrentUser } from '@/types/rbac'

export default function AdminProviders({ children, serverUser }: { children: React.ReactNode; serverUser: CurrentUser | null }) {
  return <AuthProvider initialStaffInfo={serverUser ? { role: serverUser.role_name, permissions: serverUser.permissions, name: serverUser.name } : null}>{children}</AuthProvider>
}
