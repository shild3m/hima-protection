export default function AdminLoading() {
  return (
    <div className="animate-pulse" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-[#E7E8EA]" />
          <div className="h-4 w-56 rounded bg-[#EDEEEF]" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-[#E7E8EA]" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E7E8EA] rounded-2xl p-5">
            <div className="h-4 w-24 rounded bg-[#EDEEEF] mb-3" />
            <div className="h-7 w-16 rounded bg-[#E7E8EA]" />
          </div>
        ))}
      </div>

      {/* List / table */}
      <div className="bg-white border border-[#E7E8EA] rounded-2xl overflow-hidden">
        <div className="h-12 bg-[#F7F7F5] border-b border-[#E7E8EA]" />
        <div className="divide-y divide-[#F1F2F3]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-4 flex-1 rounded bg-[#EDEEEF]" />
              <div className="h-4 w-28 rounded bg-[#EDEEEF]" />
              <div className="h-4 w-20 rounded bg-[#EDEEEF]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
