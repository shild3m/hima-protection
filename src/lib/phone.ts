/**
 * Saudi mobile numbers are stored locally as 05XXXXXXXX:
 * exactly 10 digits, starting with 0.
 */

/** Convert a stored/typed number to local digits without forcing or truncating. */
export function normalizeSaudiPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00966')) digits = digits.slice(2)
  if (digits.startsWith('966')) digits = '0' + digits.slice(3)
  if (digits.length === 9 && digits.startsWith('5')) digits = '0' + digits
  return digits
}

/** Input mask: always starts with 0 and never exceeds 10 digits. */
export function formatSaudiPhoneInput(raw: string): string {
  const digits = normalizeSaudiPhone(raw)
  if (!digits) return ''
  const local = digits.startsWith('0') ? digits : '0' + digits
  return local.slice(0, 10)
}

export function isValidSaudiPhone(value: string): boolean {
  return /^0\d{9}$/.test(value.trim())
}
