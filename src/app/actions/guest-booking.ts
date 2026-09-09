'use server'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkGuestRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

const GuestBookingSchema = z.object({
  customerName: z.string().min(2, 'الاسم مطلوب').max(200),
  customerPhone: z.string().min(5, 'رقم الجوال مطلوب').max(20),
  customerEmail: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  carMake: z.string().min(1, 'شركة صنع السيارة مطلوبة').max(100),
  carModel: z.string().min(1, 'موديل السيارة مطلوب').max(100),
  carYear: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  carColor: z.string().max(50).optional(),
  carPlate: z.string().max(20).optional(),
  serviceId: z.string().uuid('معرف الخدمة غير صحيح'),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid().optional(),
  honeypot: z.string().max(0).optional(),
})

export type GuestBookingInput = z.infer<typeof GuestBookingSchema>

export async function createGuestBooking(input: GuestBookingInput) {
  if (input.honeypot && input.honeypot.length > 0) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء الحجز' }
  }

  const rateKey = `guest_booking:${input.customerPhone}`
  if (!checkGuestRateLimit(rateKey, 3, 300000)) {
    return { success: false, error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد قليل.' }
  }

  try {
    const validated = GuestBookingSchema.parse(input)

    const { data, error } = await supabaseAdmin.rpc('create_guest_booking', {
      p_customer_name: validated.customerName,
      p_customer_phone: validated.customerPhone,
      p_customer_email: validated.customerEmail || null,
      p_car_make: validated.carMake,
      p_car_model: validated.carModel,
      p_car_year: validated.carYear || null,
      p_car_color: validated.carColor || null,
      p_car_plate: validated.carPlate || null,
      p_service_id: validated.serviceId,
      p_preferred_date: validated.preferredDate || null,
      p_preferred_time: validated.preferredTime || null,
      p_notes: validated.notes || null,
      p_idempotency_key: validated.idempotencyKey || null,
    })

    if (error) {
      console.error('Guest booking error:', error)
      return { success: false, error: 'حدث خطأ أثناء إنشاء الحجز' }
    }

    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        return {
          success: true,
          message: 'تم استلام طلب حجزك بنجاح. سيتواصل معك فريقنا قريباً لتأكيد الحجز.',
          bookingId: data.booking_id,
        }
      } else {
        return { success: false, error: (data as Record<string, unknown>).error as string || 'حدث خطأ أثناء إنشاء الحجز' }
      }
    }

    return { success: false, error: 'حدث خطأ غير متوقع' }
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0].message }
    }
    console.error('Unexpected error:', err)
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
