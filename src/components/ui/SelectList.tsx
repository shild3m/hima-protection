'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaCheck, FaChevronDown, FaSearch } from 'react-icons/fa'

export type SelectOption = { value: string; label: string }

interface SelectListProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: React.ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  ariaLabel?: string
  /** Render the panel in a body portal (use inside modals / scroll containers). */
  portal?: boolean
}

export default function SelectList({
  value,
  onChange,
  options,
  placeholder = 'اختر',
  icon,
  searchable = false,
  searchPlaceholder = 'بحث...',
  emptyText = 'لا توجد نتائج',
  className = '',
  disabled = false,
  ariaLabel,
  portal = false,
}: SelectListProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null)
  const [listMaxH, setListMaxH] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  const activeIndex = Math.min(highlight, Math.max(0, filtered.length - 1))

  // close when clicking outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // portal panel: keep it attached to the trigger, close on scroll/resize
  useEffect(() => {
    if (!open || !portal) return
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, portal])

  // focus the search box right after opening
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus()
  }, [open, searchable])

  // keep highlighted option visible
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const openPanel = () => {
    setQuery('')
    const idx = options.findIndex(o => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)

    if (portal && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect()
      // Always open downwards; shrink the list instead of flipping above the trigger.
      const top = r.bottom + 8
      const available = window.innerHeight - top - 12
      setPanelStyle({
        position: 'fixed',
        right: Math.max(8, window.innerWidth - r.right),
        width: Math.max(r.width, 220),
        zIndex: 60,
        top,
      })
      setListMaxH(Math.max(72, available - (searchable ? 66 : 14)))
    } else {
      setListMaxH(null)
    }

    setOpen(true)
  }

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openPanel()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt) choose(opt.value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const panel = (
    <>
      {searchable && (
        <div className="p-2 border-b border-[#F1F2F3]">
          <div className="relative">
            <FaSearch className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9DA3] text-[11px]" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0) }}
              placeholder={searchPlaceholder}
              className="w-full h-9 pr-8 pl-3 rounded-lg bg-[#F7F7F5] border border-transparent text-[#111214] text-xs transition-colors focus:outline-none focus:border-[#DC2626] focus:bg-white"
            />
          </div>
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        style={listMaxH ? { maxHeight: listMaxH } : undefined}
        className="max-h-64 overflow-y-auto p-1.5"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-[#9A9DA3] text-xs">{emptyText}</p>
        ) : (
          filtered.map((o, i) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={i}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(o.value)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-right transition-colors ${
                  isSelected
                    ? 'bg-[#FEF2F2] text-[#DC2626] font-bold'
                    : i === activeIndex
                      ? 'bg-[#F7F7F5] text-[#111214]'
                      : 'text-[#111214]'
                }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {isSelected && <FaCheck className="text-[10px] text-[#DC2626] shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </>
  )

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full h-11 flex items-center gap-2 px-3 bg-white border rounded-xl text-sm shadow-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-[#DC2626] ring-4 ring-[#DC2626]/10'
            : 'border-[#E7E8EA] hover:border-[#DC2626]/40'
        }`}
      >
        {icon && <span className="text-[#9A9DA3] shrink-0 text-sm">{icon}</span>}
        <span className={`flex-1 truncate text-right ${selected ? 'text-[#111214] font-medium' : 'text-[#9A9DA3]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <FaChevronDown className={`text-[10px] text-[#62666D] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && portal
        ? createPortal(
            <div
              ref={panelRef}
              style={panelStyle ?? undefined}
              onKeyDown={onKeyDown}
              className="rounded-2xl border border-[#E7E8EA] bg-white shadow-xl overflow-hidden"
            >
              {panel}
            </div>,
            document.body,
          )
        : open && (
            <div className="absolute z-40 mt-2 w-full min-w-[220px] rounded-2xl border border-[#E7E8EA] bg-white shadow-xl overflow-hidden">
              {panel}
            </div>
          )}
    </div>
  )
}
