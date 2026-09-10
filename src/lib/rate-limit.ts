'use server'

import { createClient } from '@/utils/supabase/server'

interface RateLimitResult {
  allowed: boolean
  current: number
  limit: number
}

// Client-side allowlist for early fail-fast.
// SQL is the source of truth — unknown actions raise EXCEPTION.
const ALLOWED_ACTIONS = new Set([
  'staff:create',
  'staff:update',
  'bookings:create',
  'bookings:update',
  'bookings:delete',
  'invoices:create',
  'invoices:update',
  'payments:create',
  'purchases:create',
  'purchases:update',
  'materials:create',
  'materials:update',
])

export async function checkRateLimit(
  action: string
): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_ACTIONS.has(action)) {
    console.error('Unknown rate limit action:', action)
    return { ok: false, error: 'حدث خطأ في التحقق. يرجى المحاولة لاحقاً' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_action: action,
    })

    if (error) {
      console.error('Rate limit check failed:', error.message)
      return { ok: false, error: 'حدث خطأ في التحقق. يرجى المحاولة لاحقاً' }
    }

    const result = data as RateLimitResult
    if (!result?.allowed) {
      return { ok: false, error: 'تم تجاوز الحد المسموح. يرجى المحاولة لاحقاً' }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'حدث خطأ في التحقق. يرجى المحاولة لاحقاً' }
  }
}
