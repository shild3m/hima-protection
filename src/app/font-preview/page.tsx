const SAMPLE = {
  heading: "معرض الخطوط العربية",
  body: "السلام عليكم، معكم فريق عنوان الحماية. نقدم خدمات تظليل وحماية الطلاء ونانو سيراميك بأعلى جودة وأفضل الأسعار. تواصل معنا اليوم: 0555555555 — رقم اللوحة: أ ب ج 123",
};

const FONTS: { name: string; family: string; url?: string; style?: React.CSSProperties }[] = [
  { name: "1. Dubai (خط البنوك — الحالي)", family: "Dubai" },
  { name: "2. El Messiri", family: "'El Messiri', sans-serif", url: "https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;500;600;700&display=swap" },
  { name: "3. Scheherazade New", family: "'Scheherazade New', serif", url: "https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&display=swap" },
  { name: "4. Amiri", family: "Amiri, serif", url: "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700&display=swap" },
  { name: "5. Noto Sans Arabic", family: "'Noto Sans Arabic', sans-serif", url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap" },
  { name: "6. Tajawal", family: "Tajawal, sans-serif", url: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" },
  { name: "7. Almarai", family: "Almarai, sans-serif", url: "https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&display=swap" },
  { name: "8. IBM Plex Sans Arabic", family: "'IBM Plex Sans Arabic', sans-serif", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" },
  { name: "9. Rubik", family: "Rubik, sans-serif", url: "https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700&display=swap" },
  { name: "10. Readex Pro", family: "'Readex Pro', sans-serif", url: "https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap" },
  { name: "11. Cairo", family: "Cairo, sans-serif", url: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" },
  { name: "12. Lalezar", family: "Lalezar, system-ui", url: "https://fonts.googleapis.com/css2?family=Lalezar&display=swap" },
  { name: "13. Aref Ruqaa", family: "'Aref Ruqaa', serif", url: "https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap" },
  { name: "14. Zain", family: "Zain, sans-serif", url: "https://fonts.googleapis.com/css2?family=Zain:wght@400;700;900&display=swap" },
  { name: "15. Alexandria", family: "Alexandria, sans-serif", url: "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700&display=swap" },
  { name: "16. Marhey", family: "Marhey, system-ui", url: "https://fonts.googleapis.com/css2?family=Marhey:wght@400;700&display=swap" },
];

export default function FontPreviewPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F7F5] py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {FONTS.filter((f) => f.url).map((f) => (
          <link key={f.name} rel="stylesheet" href={f.url} />
        ))}
        <h1 className="text-center text-3xl font-black text-[#111214] mb-2">{SAMPLE.heading}</h1>
        <p className="text-center text-[#62666D] mb-10">
          اختر رقم الخط الذي يعجبك وقله لي — سأثبته على كامل الموقع مباشرة.
        </p>
        <div className="grid gap-5">
          {FONTS.map((f) => (
            <div key={f.name} className="bg-white border border-[#E7E8EA] rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#C4121A] bg-red-50 px-2 py-1 rounded-lg">{f.name}</span>
              </div>
              <div style={{ fontFamily: f.family }}>
                <h2 className="text-2xl font-bold text-[#111214] mb-2">{SAMPLE.heading}</h2>
                <p className="text-[17px] leading-8 text-[#111214] max-w-2xl">{SAMPLE.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}