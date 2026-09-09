'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
}

function sanitizeSearch(input: string): string {
  return input.trim()
    .replace(/,/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\./g, '')
    .replace(/\*/g, '')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

function validatePage(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return 1
  return Math.floor(num)
}

function validatePageSize(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return PAGE_SIZE
  return Math.min(Math.floor(num), MAX_PAGE_SIZE)
}

const ExpenseSchema = z.object({
  title: z.string().min(1, 'عنوان المصروف مطلوب').max(200),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expense_date: z.string().min(1, 'التاريخ مطلوب').refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime())
  }, 'التاريخ غير صحيح'),
  notes: z.string().max(1000).optional().nullable(),
})

type ExpenseInput = z.infer<typeof ExpenseSchema>

export async function getExpenses(
  search?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('expenses:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(from, to)

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`title.ilike.%${sanitized}%,notes.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get expenses error:', error)
      return { success: false as const, error: 'تعذر جلب المصروفات' }
    }

    return {
      success: true as const,
      data: data || [],
      pagination: {
        page: currentPage,
        pageSize: size,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getExpense(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('expenses:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'المصروف غير موجود' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createExpense(input: ExpenseInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('expenses:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = ExpenseSchema.parse(input)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        title: validated.title.trim(),
        amount: validated.amount,
        expense_date: validated.expense_date,
        notes: validated.notes || null,
        created_by: user.auth_user_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Create expense error:', error)
      return { success: false as const, error: 'تعذر إنشاء المصروف' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'expense_created',
      resourceType: 'expenses',
      resourceId: data.id,
      newValues: { title: data.title, amount: data.amount },
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('expenses:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المصروف غير موجود' }
    }

    const updateData: Record<string, unknown> = {}
    if (input.title !== undefined) updateData.title = input.title.trim()
    if (input.amount !== undefined) updateData.amount = input.amount
    if (input.expense_date !== undefined) updateData.expense_date = input.expense_date
    if (input.notes !== undefined) updateData.notes = input.notes || null

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update expense error:', error)
      return { success: false as const, error: 'تعذر تحديث المصروف' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'expense_updated',
      resourceType: 'expenses',
      resourceId: id,
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function deleteExpense(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('expenses:delete')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('expenses')
      .select('id, title')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المصروف غير موجود' }
    }

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete expense error:', error)
      return { success: false as const, error: 'تعذر حذف المصروف' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'expense_deleted',
      resourceType: 'expenses',
      resourceId: id,
      oldValues: { title: existing.title },
    })

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
