import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import PrintButton from '@/components/PrintButton'

export const metadata = {
  title: 'طباعة الفاتورة',
  robots: { index: false, follow: false },
}

const SIZE_LABELS: Record<string, string> = { small: 'صغيرة', medium: 'متوسطة', large: 'كبيرة' }
const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  online: 'أونلاين',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:read')) {
    notFound()
  }

  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, subtotal, discount, tax_rate, tax_amount, total, paid_amount,
      status, notes, issued_at, cancelled_at, created_at,
      customer:customers(id, full_name, phone),
      vehicle:vehicles(id, make, model, plate_number, size),
      payments:payments(id, amount, payment_method, reference_number, paid_at),
      items:invoice_items(id, description, quantity, unit_price, discount, tax_rate, total)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!invoice) {
    notFound()
  }

  const customer = Array.isArray(invoice.customer) ? invoice.customer?.[0] : invoice.customer
  const vehicle = Array.isArray(invoice.vehicle) ? invoice.vehicle?.[0] : invoice.vehicle
  const payments = invoice.payments as { id: string; amount: number; payment_method: string; reference_number: string | null; paid_at: string | null }[] | undefined
  const paid = payments?.reduce((acc: number, p: { amount: number }) => acc + Number(p.amount), 0) || 0
  const remaining = Number(invoice.total) - paid
  const lastPayment = payments?.[payments.length - 1]

  return (
    <>
      <style>{`
        @media print {
          header, footer { display: none !important; }
          body { background: #fff !important; }
          .print-action-bar { display: none !important; }
          .invoice-paper { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>
      <div className="min-h-screen bg-[#F7F7F5] py-6 print:bg-white print:py-0" dir="rtl">
        <PrintButton />

        <div className="invoice-paper max-w-[720px] mx-auto bg-white text-[#111214] shadow-xl border border-[#E7E8EA] rounded-2xl overflow-hidden print:rounded-none">
          <div className="flex items-center justify-between px-8 py-6 border-b-[3px] border-[#C4121A]">
            <div>
              <h1 className="text-2xl font-black text-[#C4121A]">عنوان الحماية</h1>
              <p className="text-xs text-[#62666D] mt-1">حماية السيارات والتظليل والنانو سيراميك</p>
            </div>
            <div className="text-left">
              <div className="text-lg font-black">{invoice.status === 'paid' ? 'سند قبض' : 'فاتورة'}</div>
              <div className="text-xs text-[#62666D] mt-1 font-bold">رقم: {invoice.invoice_number}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-8 py-5 border-b border-[#E7E8EA] text-sm">
            <div>
              <div className="text-[10px] font-bold text-[#9CA3AF] mb-1">العميل</div>
              <div className="font-bold">{customer?.full_name || '—'}</div>
              <div className="text-xs text-[#62666D] mt-0.5" dir="ltr">{customer?.phone || ''}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#9CA3AF] mb-1">المركبة</div>
              {vehicle ? (
                <div className="font-bold">
                  {vehicle.make} {vehicle.model}
                  {vehicle.size && <span className="text-xs text-[#62666D]"> ({SIZE_LABELS[vehicle.size] || vehicle.size})</span>}
                </div>
              ) : (
                <div>—</div>
              )}
              {vehicle?.plate_number && (
                <div className="text-xs text-[#62666D] mt-0.5">لوحة: {vehicle.plate_number}</div>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FA0F20] text-white text-xs">
                <th className="text-right px-8 py-2.5 font-bold">الخدمة</th>
                <th className="px-4 py-2.5 font-bold w-16">الكمية</th>
                <th className="px-4 py-2.5 font-bold w-28">سعر الوحدة</th>
                <th className="px-8 py-2.5 font-bold w-28">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map(item => (
                <tr key={item.id} className="border-b border-[#F1F2F3]">
                  <td className="px-8 py-3 font-bold">{item.description}</td>
                  <td className="px-4 py-3 text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-left">{fmt(Number(item.unit_price))} ر.س</td>
                  <td className="px-8 py-3 font-bold text-left">{fmt(Number(item.total))} ر.س</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-6 px-8 py-6">
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-[#9CA3AF] mb-1.5">الدفعات</div>
              {payments && payments.length > 0 ? (
                payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
                    <span className="font-bold text-[#059669]">{METHOD_LABELS[p.payment_method] || p.payment_method}{p.reference_number ? ` (${p.reference_number})` : ''}</span>
                    <span className="font-bold">{fmt(Number(p.amount))} ر.س</span>
                  </div>
                ))
              ) : (
                <div className="text-[#9CA3AF]">لا توجد دفعات</div>
              )}
              {invoice.notes && <div className="pt-2 text-[#62666D]">ملاحظات: {invoice.notes}</div>}
              <div className="pt-2 text-[#9CA3AF]">بتاريخ: {new Date(invoice.created_at).toLocaleDateString('ar-SA')}</div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between border-b border-[#F1F2F3] pb-1.5">
                <span className="text-[#62666D]">الإجمالي الفرعي</span>
                <span className="font-bold">{fmt(Number(invoice.subtotal))} ر.س</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between border-b border-[#F1F2F3] pb-1.5">
                  <span className="text-[#62666D]">الخصم</span>
                  <span className="font-bold">-{fmt(Number(invoice.discount))} ر.س</span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between border-b border-[#F1F2F3] pb-1.5">
                  <span className="text-[#62666D]">الضريبة ({fmt(Number(invoice.tax_rate))}%)</span>
                  <span className="font-bold">{fmt(Number(invoice.tax_amount))} ر.س</span>
                </div>
              )}
              <div className="flex justify-between border-b-2 border-[#111214] pb-1.5 pt-1">
                <span className="font-black">الإجمالي</span>
                <span className="font-black text-[#C4121A]">{fmt(Number(invoice.total))} ر.س</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between pt-1.5">
                  <span className="text-[#D97706] font-bold">المتبقي</span>
                  <span className="text-[#D97706] font-bold">{fmt(remaining)} ر.س</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#F9FAFB] border-t border-[#E7E8EA] px-8 py-4 flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>شكراً لثقتكم بنا — عنوان الحماية</span>
            <span>{lastPayment ? 'تم الدفع ' + METHOD_LABELS[lastPayment.payment_method] : 'مسودة'}</span>
          </div>
        </div>
      </div>
    </>
  )
}