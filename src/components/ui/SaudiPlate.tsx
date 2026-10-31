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

// Latin → Arabic for plates entered in English. Only the official set is
// mapped; anything else is omitted from the Arabic row.
const LATIN_TO_ARABIC: Record<string, string> = {
  A: 'أ',
  B: 'ب',
  J: 'ح',
  D: 'د',
  R: 'ر',
  S: 'س',
  X: 'ص',
  T: 'ط',
  E: 'ع',
  G: 'ق',
  K: 'ك',
  L: 'ل',
  M: 'م',
  N: 'ن',
  H: 'ه',
  U: 'و',
  V: 'ى',
}

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
    : latinLetters.map((letter) => LATIN_TO_ARABIC[letter] || '').join('')
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

// Each character is its own element so the visual order never depends on
// the document's bidi settings (Arabic-Indic digits stay ١ ٢ ٣ ٤, not ٤ ٣ ٢ ١).
function CharRow({
  value,
  reverse = false,
  gap = '0.32em',
}: {
  value: string
  reverse?: boolean
  gap?: string
}) {
  if (!value) return <span>—</span>

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ flexDirection: reverse ? 'row-reverse' : 'row', gap }}
    >
      {[...value].map((char, index) => (
        <span key={`${char}-${index}`} className="inline-block">
          {char}
        </span>
      ))}
    </span>
  )
}

function PlateEmblem({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/plate-emblem.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
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
      dir="ltr"
      aria-label={`لوحة السيارة ${plate}`}
      className={`relative inline-block w-[250px] max-w-full shrink-0 select-none overflow-hidden rounded-[4px] border border-[#0A0A0A] bg-[#E6E6E3] [container-type:inline-size] ${className}`}
      style={{ aspectRatio: '1629 / 345' }}
    >
      {/* Central emblem */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: '48.4cqi', top: '50.3%', width: '16.3cqi', height: '83.2%' }}
      >
        <PlateEmblem className="h-full w-full" />
      </div>

      {/* Numbers — left side, Arabic above and English below */}
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-black text-[#0A0A0A]"
        style={{ left: '20cqi', top: '6cqi', fontSize: '7cqi', lineHeight: 1.45 }}
      >
        <CharRow value={arabicDigits} gap="0.3em" />
      </span>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-normal text-[#0A0A0A]"
        style={{ left: '20cqi', top: '16cqi', fontSize: '7cqi', lineHeight: 1.45 }}
      >
        <CharRow value={latinDigits} gap="0.3em" />
      </span>

      {/* Letters — right side, Arabic above and English below */}
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-black text-[#0A0A0A]"
        style={{ left: '75cqi', top: '6cqi', fontSize: '7cqi', lineHeight: 1.45 }}
      >
        <CharRow value={arabicLetters} reverse gap="0.42em" />
      </span>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-bold text-[#0A0A0A]"
        style={{ left: '75cqi', top: '16cqi', fontSize: '7cqi', lineHeight: 1.45 }}
      >
        <CharRow value={latinLetters} gap="0.42em" />
      </span>

      {/* Right KSA strip */}
      <div
        className="absolute bottom-0 right-0 top-0 flex flex-col items-center border-l border-[#0A0A0A] text-[#0A0A0A]"
        style={{ width: '7.37cqi', paddingTop: '0.55cqi', borderLeftWidth: '0.68cqi' }}
      >
        <div style={{ width: '3.61cqi', height: '3.9cqi' }}>
          <PlateEmblem className="h-full w-full" />
        </div>
        <span
          className="whitespace-nowrap text-center font-bold"
          style={{
            display: 'inline-block',
            marginTop: '1.1cqi',
            fontSize: '2.1cqi',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            transform: 'scaleX(0.72)',
            transformOrigin: 'center',
          }}
        >
          السعودية
        </span>
        <div
          className="flex flex-col items-center font-bold"
          style={{ marginTop: '1.2cqi', fontSize: '3.6cqi', lineHeight: 1.05 }}
        >
          <span>K</span>
          <span>S</span>
          <span>A</span>
        </div>
      </div>
    </div>
  )
}
