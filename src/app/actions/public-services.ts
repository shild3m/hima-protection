'use server'

import { createClient } from '@/utils/supabase/server'

export async function getPublicServices() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('services')
      .select('id, name, slug, short_description, base_price, duration_minutes, image_url')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Get public services error:', error)
      return { success: false as const, error: 'تعذر جلب الخدمات' }
    }

    return { success: true as const, data: data || [] }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getPublicService(id: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('services')
      .select('id, name, slug, short_description, description, base_price, duration_minutes, image_url')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}


