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

  const canSearchAnything = permissions.some(p =>
    ['customers:read', 'vehicles:read', 'bookings:read', 'invoices:read'].includes(p)
  )
  const requestIdRef = useRef(0)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2 || !canSearchAnything) {
      setResults([])
      return
    }

    // Ignore responses that arrive after the query changed again.
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const { globalSearch } = await import('@/app/actions/global-search')
      const found = await globalSearch(q)
      if (requestId === requestIdRef.current) setResults(found)
    } catch {
      if (requestId === requestIdRef.current) setResults([])
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [canSearchAnything])

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
