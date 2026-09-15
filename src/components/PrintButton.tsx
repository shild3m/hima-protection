'use client'

import { useEffect, useState } from 'react'
import { FaPrint } from 'react-icons/fa'

export default function PrintButton() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <div className="print-action-bar max-w-[720px] mx-auto flex justify-end pb-4">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-[#C4121A] text-white rounded-xl text-sm font-bold hover:bg-red-700 transition flex items-center gap-2 shadow-lg"
      >
        <FaPrint />
        طباعة / حفظ PDF
      </button>
    </div>
  )
}