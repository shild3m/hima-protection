import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/auth'

/**
 * Org-wide read-only lookups that change rarely (materials / suppliers / services).
 *
 * These are cached in the Next.js Data Cache and invalidated explicitly from the
 * server actions that mutate the underlying tables (`updateTag`).
 *
 * SECURITY: every cached loader below is only reachable after the calling server
 * action has verified `requireAuth()` + the required permission. The cached
 * functions themselves never read cookies/headers, so the cache key can never
 * mix users or sessions.
 */

export const CACHE_TAGS = {
  materials: 'materials',
  suppliers: 'suppliers',
  services: 'services',
  publicServices: 'public-services',
} as const

/** Cache lifetime is only a safety net — mutations invalidate the tag immediately. */
const TTL_SECONDS = 300
const MAX_OPTION_ROWS = 1000

export type CachedList<T> =
  | { ok: true; data: T[]; count: number }
  | { ok: false; error: string }

/**
 * Row shapes come straight from Postgres. This project has no generated DB
 * types, so cached payloads stay loosely typed exactly like the direct
 * Supabase queries they replace.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type MaterialRow = any
export type SupplierRow = any
export type ServiceRow = any
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface MaterialOption {
  id: string
  name: string
  sku: string
  unit: string
  min_stock: number
  current_stock: number
  is_active: boolean
}

function sanitizeSearch(input: string): string {
  return input
    .trim()
    .replace(/,/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\./g, '')
    .replace(/\*/g, '')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

// ─────────────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────────────

export const getMaterialsPageCached = unstable_cache(
  async (search: string, from: number, to: number): Promise<CachedList<MaterialRow>> => {
    let query = getSupabaseAdmin()
      .from('materials')
      .select('*, supplier:suppliers(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get materials error:', error)
      return { ok: false, error: 'تعذر جلب المواد' }
    }

    return { ok: true, data: (data || []) as MaterialRow[], count: count || 0 }
  },
  ['materials-page'],
  { tags: [CACHE_TAGS.materials], revalidate: TTL_SECONDS },
)

/** Full active-material list used by dropdowns (no 50-row page cap). */
export const getMaterialOptionsCached = unstable_cache(
  async (): Promise<CachedList<MaterialOption>> => {
    const { data, error } = await getSupabaseAdmin()
      .from('materials')
      .select('id, name, sku, unit, min_stock, current_stock, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(MAX_OPTION_ROWS)

    if (error) {
      console.error('Get material options error:', error)
      return { ok: false, error: 'تعذر جلب المواد' }
    }

    const rows = (data || []) as MaterialOption[]
    return { ok: true, data: rows, count: rows.length }
  },
  ['material-options'],
  { tags: [CACHE_TAGS.materials], revalidate: TTL_SECONDS },
)

// ─────────────────────────────────────────────────────────────
// Suppliers
// ─────────────────────────────────────────────────────────────

export const getSuppliersPageCached = unstable_cache(
  async (search: string, from: number, to: number): Promise<CachedList<SupplierRow>> => {
    let query = getSupabaseAdmin()
      .from('suppliers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      const sanitized = sanitizeSearch(search)
      query = query.or(
        `name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,email.ilike.%${sanitized}%`,
      )
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get suppliers error:', error)
      return { ok: false, error: 'تعذر جلب الموردين' }
    }

    return { ok: true, data: (data || []) as SupplierRow[], count: count || 0 }
  },
  ['suppliers-page'],
  { tags: [CACHE_TAGS.suppliers], revalidate: TTL_SECONDS },
)

export const getSupplierOptionsCached = unstable_cache(
  async (): Promise<CachedList<SupplierRow>> => {
    const { data, error } = await getSupabaseAdmin()
      .from('suppliers')
      .select('id, name, phone, email, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(MAX_OPTION_ROWS)

    if (error) {
      console.error('Get supplier options error:', error)
      return { ok: false, error: 'تعذر جلب الموردين' }
    }

    const rows = (data || []) as SupplierRow[]
    return { ok: true, data: rows, count: rows.length }
  },
  ['supplier-options'],
  { tags: [CACHE_TAGS.suppliers], revalidate: TTL_SECONDS },
)

// ─────────────────────────────────────────────────────────────
// Services (admin)
// ─────────────────────────────────────────────────────────────

export const getServicesListCached = unstable_cache(
  async (search: string): Promise<CachedList<ServiceRow>> => {
    let query = getSupabaseAdmin()
      .from('services')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (search) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`name.ilike.%${sanitized}%,short_description.ilike.%${sanitized}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get services error:', error)
      return { ok: false, error: 'تعذر جلب الخدمات' }
    }

    const rows = (data || []) as ServiceRow[]
    return { ok: true, data: rows, count: rows.length }
  },
  ['services-list'],
  { tags: [CACHE_TAGS.services], revalidate: TTL_SECONDS },
)

// ─────────────────────────────────────────────────────────────
// Public services (anon key → RLS still enforced)
// ─────────────────────────────────────────────────────────────

export const getPublicServicesCached = unstable_cache(
  async () => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data, error } = await supabase
      .from('services')
      .select(
        'id, name, icon_key, short_description, description, base_price, duration_minutes, image_url, is_active, display_order, created_at, updated_at',
      )
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Get public services error:', error)
      return []
    }

    return data || []
  },
  ['public-services'],
  { tags: [CACHE_TAGS.publicServices], revalidate: TTL_SECONDS },
)
