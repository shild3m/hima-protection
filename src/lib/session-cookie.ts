// Shared, edge-safe parser for the @supabase/ssr session cookie.
//
// Supabase SSR v0.12 writes the session cookie as:
//   value = "base64-" + base64url(JSON.stringify(session))
// and, when the encoded value is large, splits it across chunk cookies named
// `<key>.0`, `<key>.1`, ... (the main cookie absent/empty).
// This module decodes either form and returns the access-token fingerprint
// plus expiry so callers can gate on a real, unexpired session without any
// network round-trip.

const BASE64_PREFIX = "base64-"

function base64UrlToUtf8(encoded: string): string {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function decodeCookieValue(value: string): string | null {
  try {
    if (value.startsWith(BASE64_PREFIX)) return base64UrlToUtf8(value.slice(BASE64_PREFIX.length))
    return value
  } catch {
    return null
  }
}

interface ParsedSession {
  accessToken: string | null
  expMs: number | null
}

function parseSessionValue(value: string): ParsedSession {
  try {
    const decoded = decodeCookieValue(value)
    if (!decoded) return { accessToken: null, expMs: null }
    const parsed = JSON.parse(decoded) as {
      access_token?: unknown
      refresh_token?: unknown
      expires_at?: unknown
      user?: unknown
    }
    let accessToken: string | null = typeof parsed?.access_token === "string" ? parsed.access_token : null
    if (!accessToken) {
      // Older/raw format: the value itself is the JWT.
      const candidate = String(decoded)
      if (candidate.split(".").length === 3) accessToken = candidate
    }
    const expMs =
      typeof parsed?.expires_at === "number" && parsed.expires_at > 0
        ? parsed.expires_at * 1000
        : null
    return { accessToken, expMs }
  } catch {
    return { accessToken: null, expMs: null }
  }
}

export interface SessionCookieInfo {
  sub: string
  tokenFp: string
  expMs: number | null
}

export interface CookieLike {
  name: string
  value: string
}

// Combine Supabase session-cookie chunks the same way @supabase/ssr does:
// prefer the main cookie, otherwise join `key.0`, `key.1`, ... in order.
export function readSessionCookie(cookies: CookieLike[]): SessionCookieInfo | null {
  const authCookies = cookies.filter(
    (c) => c.name.includes("auth-token") && !c.name.includes("code-verifier")
  )
  if (authCookies.length === 0) return null

  // Find the base key (strip ".N" chunk suffixes) and its cookies, ordered.
  const byKey = new Map<string, CookieLike[]>()
  for (const c of authCookies) {
    const base = c.name.replace(/\.\d+$/, "")
    const list = byKey.get(base) ?? []
    list.push(c)
    byKey.set(base, list)
  }

  for (const [key, list] of byKey) {
    const main = list.find((c) => c.name === key)
    const raw = main?.value?.trim()
      ? main.value
      : list
          .filter((c) => c.name.startsWith(key + "."))
          .sort((a, b) => {
            const na = parseInt(a.name.slice(key.length + 1), 10)
            const nb = parseInt(b.name.slice(key.length + 1), 10)
            return na - nb
          })
          .map((c) => c.value)
          .join("")
    if (!raw) continue

    const { accessToken, expMs } = parseSessionValue(raw)
    if (!accessToken) continue

    const parts = String(accessToken).split(".")
    if (parts.length < 3) continue
    try {
      const payload = JSON.parse(base64UrlToUtf8(parts[1]))
      if (typeof payload?.sub !== "string") continue
      // When expires_at is absent, fall back to the JWT exp.
      const jwtExpMs =
        typeof payload.exp === "number" && payload.exp > 0 ? payload.exp * 1000 : null
      return {
        sub: payload.sub,
        tokenFp: parts[2].slice(-8),
        expMs: expMs ?? jwtExpMs,
      }
    } catch {
      continue
    }
  }

  return null
}

export function isSessionCookieFresh(info: { expMs: number | null } | null): boolean {
  if (!info) return false
  if (info.expMs === null) return true // unknown expiry: let the layout decide
  return info.expMs > Date.now()
}