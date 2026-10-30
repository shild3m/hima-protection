const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

// Official Saudi plate letter transliteration (Arabic → Latin).
const ARABIC_TO_LATIN: Record<string, string> = {
  'ا': 'A',
  'أ': 'A',
  'إ': 'A',
  'آ': 'A',
  'ب': 'B',
  'ج': 'J',
  'ح': 'J',
  'د': 'D',
  'ر': 'R',
  'س': 'S',
  'ص': 'X',
  'ط': 'T',
  'ع': 'E',
  'ق': 'G',
  'ك': 'K',
  'ل': 'L',
  'م': 'M',
  'ن': 'N',
  'ه': 'H',
  'و': 'U',
  'ى': 'V',
  'ي': 'V',
}

const LATIN_TO_ARABIC: Record<string, string> = Object.fromEntries(
  Object.entries(ARABIC_TO_LATIN).map(([arabic, latin]) => [latin, arabic])
)

function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

function toArabicDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)])
}

function parsePlate(raw: string) {
  // Remove diacritics before splitting the plate into letters and digits.
  const clean = raw.replace(/[\u064B-\u065F\u0670]/g, '')

  const digits = toWesternDigits(clean.match(/[0-9٠-٩]/g)?.join('') || '').slice(0, 4)
  const arabicLetters = clean.match(/[\u0621-\u064A]/g)?.slice(0, 3) || []
  const latinLetters = clean.match(/[A-Za-z]/g)?.slice(0, 3).map((letter) => letter.toUpperCase()) || []

  const hasArabicLetters = arabicLetters.length > 0
  const topLetters = hasArabicLetters
    ? arabicLetters.join('')
    : latinLetters.map((letter) => LATIN_TO_ARABIC[letter] || letter).join('')
  const bottomLetters = hasArabicLetters
    ? arabicLetters.map((letter) => ARABIC_TO_LATIN[letter] || '').join('')
    : latinLetters.join('')

  return {
    arabicDigits: toArabicDigits(digits),
    latinDigits: digits,
    arabicLetters: topLetters,
    latinLetters: bottomLetters,
  }
}

function SaudiEmblem({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* Palm trunk */}
      <path
        d="M23.3 31c-.2-4.7-.2-9.5.1-14.2h1.3c.3 4.7.3 9.5.1 14.2z"
        fill="currentColor"
      />
      {/* Palm fronds */}
      <path
        d="M24 16.5C19.8 12 14.4 9.8 8.6 10.8c5 1 9.4 3.4 13 7.2z"
        fill="currentColor"
      />
      <path
        d="M24 16.5C28.2 12 33.6 9.8 39.4 10.8c-5 1-9.4 3.4-13 7.2z"
        fill="currentColor"
      />
      <path
        d="M24 17.4c-5-1.8-10.6-1.5-14.8 1.6 4.6-.6 9 .4 12.6 2.5z"
        fill="currentColor"
      />
      <path
        d="M24 17.4c5-1.8 10.6-1.5 14.8 1.6-4.6-.6-9 .4-12.6 2.5z"
        fill="currentColor"
      />
      <path
        d="M23.8 16.5C22.6 10.8 23.4 5.8 26 2.3c.4 5-.3 9.7-1.4 14.2z"
        fill="currentColor"
      />
      {/* Crossed swords */}
      <path
        d="M8.8 37.6c9.4-1.8 18.2-7.7 26.2-16.4l1.7 1.6C28.6 31.7 19.4 38 9.6 40.3z"
        fill="currentColor"
      />
      <path
        d="M39.2 37.6c-9.4-1.8-18.2-7.7-26.2-16.4l-1.7 1.6C19.4 31.7 28.6 38 38.4 40.3z"
        fill="currentColor"
      />
      <path
        d="M6.8 36.6l6.1 6.1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M41.2 36.6l-6.1 6.1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface SaudiPlateProps {
  plate: string | null | undefined
  className?: string
}

export default function SaudiPlate({ plate, className = '' }: SaudiPlateProps) {
  if (!plate || !plate.trim()) return null

  const { arabicDigits, latinDigits, arabicLetters, latinLetters } = parsePlate(plate)
  if (!arabicDigits && !arabicLetters) return null

  return (
    <div
      className={`inline-flex h-[58px] w-[160px] shrink-0 select-none items-center justify-between rounded-[7px] border-[1.5px] border-[#111214] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.04)] sm:h-[64px] sm:w-[178px] ${className}`}
      dir="ltr"
      aria-label={`لوحة السيارة ${plate}`}
    >
      <div className="flex w-[48px] flex-col items-center justify-center leading-none sm:w-[54px]">
        <span className="text-[16px] font-black tracking-[0.06em] text-[#111214] sm:text-[17px]" dir="ltr">
          {arabicDigits || '—'}
        </span>
        <span className="mt-1 text-[9px] font-bold tracking-[0.12em] text-[#111214] sm:text-[10px]">
          {latinDigits || '—'}
        </span>
      </div>

      <div className="flex items-center justify-center px-0.5 text-[#111214]">
        <SaudiEmblem className="h-8 w-8 sm:h-9 sm:w-9" />
      </div>

      <div className="flex w-[48px] flex-col items-center justify-center leading-none sm:w-[54px]">
        <span className="text-[16px] font-black tracking-[0.06em] text-[#111214] sm:text-[17px]" dir="rtl">
          {arabicLetters || '—'}
        </span>
        <span className="mt-1 text-[9px] font-bold tracking-[0.12em] text-[#111214] sm:text-[10px]">
          {latinLetters || '—'}
        </span>
      </div>
    </div>
  )
}
