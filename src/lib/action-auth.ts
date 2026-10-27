import { getCurrentUser } from './auth'

/**
 * Non-redirecting permission check for server actions that prefer to return an
 * empty/error result instead of navigating the user away.
 *
 * It reuses the same short-lived user cache as `requireAuth()`, so after the
 * first auth check of a request it costs no extra Supabase round trips - which
 * is what the old `supabase.auth.getUser()` + `has_permission` RPC pair did
 * (two network hops on every call).
 *
 * Keep using `requirePermission()` from `@/lib/auth` when a redirect is the
 * desired behaviour (pages / guards).
 */
export async function userCan(perm: string): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user && user.permissions.includes(perm)
}

export async function getActionUser(): Promise<{ id: string; email?: string; permissions: string[] } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { id: user.auth_user_id, email: user.email, permissions: user.permissions }
}
