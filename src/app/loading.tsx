export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#E7E8EA] border-t-[#C4121A] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#62666D]">جاري التحميل...</p>
      </div>
    </div>
  );
}
