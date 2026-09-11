'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FaBell, FaCheck, FaCheckDouble, FaTimes, FaSpinner, FaInbox } from 'react-icons/fa'
import type { Notification } from '@/lib/types'

interface NotificationDropdownProps {
  className?: string
}

export default function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadUnreadCount = useCallback(async () => {
    try {
      const { getUnreadCount } = await import('@/app/actions/notifications')
      const res = await getUnreadCount()
      if (res.success) setUnreadCount(res.count)
    } catch { /* ignore */ }
  }, [])

  const loadNotifications = useCallback(async (p: number, append = false) => {
    setLoading(true)
    try {
      const { getNotifications } = await import('@/app/actions/notifications')
      const res = await getNotifications(p, 20)
      if (res.success) {
        if (append) {
          setNotifications(prev => [...prev, ...res.data])
        } else {
          setNotifications(res.data)
        }
        setHasMore(res.pagination.page < res.pagination.totalPages)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadUnreadCount() }, [loadUnreadCount])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpen = () => {
    if (!isOpen) {
      setPage(1)
      loadNotifications(1)
    }
    setIsOpen(!isOpen)
  }

  const handleMarkRead = async (id: string) => {
    try {
      const { markNotificationRead } = await import('@/app/actions/notifications')
      await markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  const handleMarkAllRead = async () => {
    try {
      const { markAllNotificationsRead } = await import('@/app/actions/notifications')
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadNotifications(nextPage, true)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214] transition-colors"
        title="الإشعارات"
      >
        <FaBell className="text-sm" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#C4121A] text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#E7E8EA] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E8EA]">
            <h3 className="text-[#111214] font-black text-sm">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-[#C4121A] hover:text-[#970E14] text-xs font-bold flex items-center gap-1">
                  <FaCheckDouble className="text-[10px]" /> قراءة الكل
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]">
                <FaTimes className="text-xs" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && !loading ? (
              <div className="p-8 text-center">
                <FaInbox className="text-[#E7E8EA] text-2xl mx-auto mb-2" />
                <p className="text-[#62666D] text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              <>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-[#F1F2F3] hover:bg-[#F1F2F3] transition-colors ${
                      !n.is_read ? 'bg-[#C4121A]/[0.03]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {!n.is_read ? (
                          <div className="w-2 h-2 rounded-full bg-[#C4121A]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-[#E7E8EA]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${!n.is_read ? 'text-[#111214]' : 'text-[#62666D]'}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-[#62666D] text-xs mt-0.5 truncate">{n.message}</p>
                        )}
                        <p className="text-[#62666D] text-[10px] mt-1">
                          {new Date(n.created_at).toLocaleDateString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="p-1 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#059669]"
                          title="تم القراءة"
                        >
                          <FaCheck className="text-[10px]" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full p-3 text-center text-[#C4121A] hover:text-[#970E14] text-xs font-bold"
                  >
                    {loading ? <FaSpinner className="animate-spin inline" /> : 'تحميل المزيد'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
