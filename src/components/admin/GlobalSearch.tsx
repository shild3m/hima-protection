'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FaSearch, FaTimes, FaSpinner, FaUser, FaCar, FaCalendarCheck, FaFileInvoiceDollar } from 'react-icons/fa'

interface SearchResult {
  id: string
  type: 'customer' | 'vehicle' | 'booking' | 'invoice'
  title: string
  subtitle: string
  href: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  customer: <FaUser />,
  vehicle: <FaCar />,
  booking: <FaCalendarCheck />,
  invoice: <FaFileInvoiceDollar />,
}

const TYPE_LABELS: Record<string, string> = {
  customer: 'عميل',
  vehicle: 'سيارة',
  booking: 'حجز',
  invoice: 'فاتورة',
}

interface GlobalSearchProps {
  permissions: string[]
}

export default function GlobalSearch({ permissions }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canSearchCustomers = permissions.includes('customers:read')
  const canSearchVehicles = permissions.includes('vehicles:read')
  const canSearchBookings = permissions.includes('bookings:read')
  const canSearchInvoices = permissions.includes('invoices:read')

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const found: SearchResult[] = []

      if (canSearchCustomers) {
        try {
          const { getCustomers } = await import('@/app/actions/customers')
          const res = await getCustomers(q, 1, 3)
          if (res.success && res.data) {
            for (const c of res.data) {
              found.push({
                id: c.id,
                type: 'customer',
                title: c.full_name,
                subtitle: c.phone,
                href: `/admin/customers?id=${c.id}`,
              })
            }
          }
        } catch { /* ignore */ }
      }

      if (canSearchVehicles) {
        try {
          const { getVehicles } = await import('@/app/actions/vehicles')
          const res = await getVehicles(q, 1, 3)
          if (res.success && res.data) {
            for (const v of res.data) {
              found.push({
                id: v.id,
                type: 'vehicle',
                title: `${v.make} ${v.model}`,
                subtitle: v.plate_number || v.vin || '',
                href: `/admin/vehicles?id=${v.id}`,
              })
            }
          }
        } catch { /* ignore */ }
      }

      if (canSearchBookings) {
        try {
          const { getBookings } = await import('@/app/actions/bookings')
          const res = await getBookings(q, undefined, 1, 3)
          if (res.success && res.data) {
            for (const b of res.data) {
              found.push({
                id: b.id,
                type: 'booking',
                title: `حجز ${b.id.slice(0, 8)}`,
                subtitle: b.status,
                href: `/admin/bookings?id=${b.id}`,
              })
            }
          }
        } catch { /* ignore */ }
      }

      if (canSearchInvoices) {
        try {
          const { getInvoices } = await import('@/app/actions/invoices')
          const res = await getInvoices(q, undefined, 1, 3)
          if (res.success && res.data) {
            for (const inv of res.data) {
              found.push({
                id: inv.id,
                type: 'invoice',
                title: inv.invoice_number,
                subtitle: `${inv.total.toLocaleString('en-GB')} ر.س — ${inv.status}`,
                href: `/admin/invoices?id=${inv.id}`,
              })
            }
          }
        } catch { /* ignore */ }
      }

      setResults(found)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [canSearchCustomers, canSearchVehicles, canSearchBookings, canSearchInvoices])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214] transition-colors"
        aria-label="فتح البحث"
        aria-expanded={isOpen}
      >
        <FaSearch className="text-sm" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setIsOpen(false); setQuery('') }} />
          <div
            className="relative w-full max-w-lg mx-4 bg-white border border-[#E7E8EA] rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="بحث شامل"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E7E8EA]">
              <FaSearch className="text-[#62666D] text-sm" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="بحث عن عملاء، سيارات، حجوزات، فواتير..."
                className="flex-1 bg-transparent text-[#111214] text-sm outline-none placeholder-[#62666D]"
                aria-label="بحث"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-autocomplete="list"
                aria-controls="search-results"
              />
              {loading && <FaSpinner className="text-[#62666D] text-sm animate-spin" aria-label="جاري البحث" />}
              <button onClick={() => { setIsOpen(false); setQuery('') }} className="text-[#62666D] hover:text-[#111214]" aria-label="إغلاق البحث">
                <FaTimes className="text-sm" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto" id="search-results" role="listbox" aria-label="نتائج البحث">
              {query.length < 2 ? (
                <div className="p-6 text-center">
                  <p className="text-[#62666D] text-xs">اكتب حرفين على الأقل للبحث</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="p-6 text-center">
                  <p className="text-[#62666D] text-xs">لا توجد نتائج</p>
                </div>
              ) : (
                <div className="py-2">
                  {results.map(r => (
                    <a
                      key={`${r.type}-${r.id}`}
                      href={r.href}
                      role="option"
                      aria-selected={false}
                      onClick={() => { setIsOpen(false); setQuery('') }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F1F2F3] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#F1F2F3] flex items-center justify-center text-[#62666D] text-xs" aria-hidden="true">
                        {TYPE_ICONS[r.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#111214] text-xs font-bold truncate">{r.title}</p>
                        <p className="text-[#62666D] text-[10px] truncate">{r.subtitle}</p>
                      </div>
                      <span className="text-[#62666D] text-[10px] bg-[#F1F2F3] px-2 py-0.5 rounded-md flex-shrink-0">
                        {TYPE_LABELS[r.type]}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
