'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { FaShieldAlt, FaEye, FaEyeSlash } from 'react-icons/fa'

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetch('/api/check-staff', { method: 'POST' })
          .then(r => r.json())
          .then(d => {
            if (d.isStaff) {
              router.replace(d.role === 'dealer' ? '/dealer' : '/admin')
            } else {
              setCheckingSession(false)
            }
          })
          .catch(() => setCheckingSession(false))
      } else {
        setCheckingSession(false)
      }
    }).catch(() => setCheckingSession(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }

      const res = await fetch('/api/check-staff', { method: 'POST' })
      const data = await res.json()

      if (!data.isStaff) {
        setError('هذا الحساب غير مصرح له بالدخول')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      if (data.role === 'dealer') {
        router.replace('/dealer')
      } else {
        router.replace('/admin')
      }
    } catch {
      setError('حدث خطأ غير متوقع')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-[#A0A0B8] text-lg font-semibold">جاري التحقق...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex">
      {/* Left: Visual Side (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C4121A]/20 via-[#0A0A0B] to-[#0A0A0B]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#C4121A]/10 rounded-full blur-[100px]" />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 bg-[#C4121A] rounded-2xl flex items-center justify-center mx-auto mb-8">
            <FaShieldAlt className="text-white text-4xl" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4">عنوان الحماية</h2>
          <p className="text-[#A0A0B8] text-lg leading-relaxed">
            نظام إدارة الحماية والطلاء للسيارات
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-14 h-14 bg-[#C4121A] rounded-xl flex items-center justify-center mx-auto mb-4">
              <FaShieldAlt className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-black text-white">عنوان الحماية</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-white mb-2">لوحة التحكم</h1>
            <p className="text-[#A0A0B8]">تسجيل الدخول للموظفين والشركاء</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] text-sm rounded-xl px-4 py-3 text-center font-semibold">
                {error}
              </div>
            )}

            <div>
              <label className="label">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B80] hover:text-[#A0A0B8] transition-colors"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-md w-full text-center"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
