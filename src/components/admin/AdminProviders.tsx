'use client'

import { AuthProvider } from '@/components/AuthProvider'

export default function AdminProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
