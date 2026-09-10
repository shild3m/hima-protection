'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { FaSpinner } from 'react-icons/fa'

interface AdminPageGuardProps {
  resource: string
  action?: string
  children: React.ReactNode
}

export default function AdminPageGuard({ resource, action = 'read', children }: AdminPageGuardProps) {
  const { hasPermission, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !hasPermission(resource, action)) {
      router.replace('/admin/unauthorized')
    }
  }, [loading, hasPermission, resource, action, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FaSpinner className="animate-spin text-2xl text-[#DC2626]" />
      </div>
    )
  }

  if (!hasPermission(resource, action)) {
    return null
  }

  return <>{children}</>
}
