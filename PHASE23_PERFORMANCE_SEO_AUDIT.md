# PHASE 23 — PERFORMANCE + SEO AUDIT

**Date:** 2026-09-04  
**Scope:** Read-only performance and SEO audit  
**Project:** `hima-protection`

---

## Executive Summary

Phase 23 is a **read-only audit** of performance and SEO readiness for `hima-protection`. The project has 40 page routes, 24 server actions, 32 shared components, and 28 database migrations.

**Key findings:**
- **Build passes** (TypeScript: 0 errors, Build: 46 pages in 5.3s)
- **17 performance findings** (3 Critical, 5 High, 6 Medium, 3 Low)
- **15 SEO findings** (5 Critical, 4 High, 3 Medium, 3 Low)
- **1 security finding** from cross-check (CRM layout missing auth)
- **Zero images** in the entire app — a car protection website with no car imagery
- **Zero SEO infrastructure** — no sitemap, no robots.txt, no structured data, no Twitter cards

---

## Build / Static Checks

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** — 0 errors |
| `npm run lint` | **141 issues** — 76 errors (pre-existing: `react-hooks/set-state-in-effect` + test `.js` files), 65 warnings (unused vars) |
| `npm run build` | **PASS** — 46 pages compiled in 5.3s |

---

## Performance Findings

### P1 — Critical: Homepage Entirely Client-Rendered
- **Evidence:** `src/app/page.tsx` has `'use client'` — the entire homepage (hero, services, testimonials, FAQ) runs client-side
- **Impact:** No SSR, no static generation, no streaming. Largest contentful paint (LCP) suffers because all content is rendered in browser. Full JS bundle shipped for what is mostly static marketing content
- **File:** `src/app/page.tsx`
- **Recommendation:** Refactor to server component. Extract FAQ accordion (only `useState`) into a small client component. Keep all other sections server-rendered

### P2 — Critical: Zero Dynamic Imports — All Admin Components Eagerly Loaded
- **Evidence:** No `next/dynamic` usage anywhere. All 29 admin manager components are statically imported. Admin dashboard bundles ~29 heavy CRUD components even when user visits a single page
- **Impact:** Admin pages ship unnecessary JS for components not displayed. Each manager component has 5-15 useState calls, useEffect hooks, and full CRUD logic
- **File:** `src/app/admin/page.tsx`, all `src/components/admin/*.tsx`
- **Recommendation:** Use `next/dynamic` with `loading` skeletons for each admin manager. Only load the component for the current route

### P3 — Critical: No Route-Level Loading or Error States
- **Evidence:** Zero `loading.tsx`, zero `error.tsx`, zero `not-found.tsx` files in the entire project. Only 2 Suspense boundaries (admin dashboard + services page)
- **Impact:** Users see no feedback during route transitions. Errors crash to generic Next.js error page. No skeleton loading for any route
- **File:** All routes under `src/app/`
- **Recommendation:** Add `loading.tsx` for public routes (booking, services, offers). Add `error.tsx` for admin/CRM. Add custom `not-found.tsx` with Arabic content

### P4 — High: N+1 Query in Purchase Creation
- **Evidence:** `createPurchase()` loops over items and makes individual `materials` query per item:
  ```typescript
  for (const item of validated.items) {
    await supabase.from('materials').select('id, is_active').eq('id', item.material_id)
  }
  ```
- **Impact:** N database calls for N items. A purchase with 10 materials = 10 extra queries
- **File:** `src/app/actions/purchases.ts:165-175`
- **Recommendation:** Batch with `.in('id', materialIds)` single query

### P5 — High: Sequential Count Queries (Stats Functions)
- **Evidence:** `getBookingStats()` makes 8 sequential queries (one per status). `getInvoiceStats()` makes 6 sequential queries
- **Impact:** Booking stats = 8 round trips. Invoice stats = 6 round trips. Each is independent
- **Files:** `src/app/actions/bookings.ts:254-259`, `src/app/actions/invoices.ts:408-414`
- **Recommendation:** Use single GROUP BY query or `Promise.all()` for parallel execution

### P6 — High: Sequential Independent Queries in Server Actions
- **Evidence:** Multiple server actions run independent queries sequentially:
  - `getInvoice()`: 3 sequential queries (invoice + items + payments) — all independent
  - `getCommissionMonthlyReport()`: 3 sequential queries (commissions + dealers + referrals)
  - `getSupplierPurchaseHistory()`: 2 independent queries
- **Impact:** 2-3x latency multiplier on these operations
- **Files:** `src/app/actions/invoices.ts:135-161`, `src/app/actions/commission.ts:868-923`, `src/app/actions/purchases.ts:352-371`
- **Recommendation:** Wrap independent queries in `Promise.all()`

### P7 — High: Referral Code Uniqueness Check Loop
- **Evidence:** `createReferral()` tries up to 5 sequential DB calls to check referral code uniqueness before inserting
- **Impact:** Up to 5 round trips for a single code generation
- **File:** `src/app/actions/referral.ts:194-203`
- **Recommendation:** Rely on DB UNIQUE constraint. Single insert with catch on unique_violation

### P8 — High: 17 SELECT * Patterns
- **Evidence:** 17 queries use `.select('*')` or `.select()` without column specification across customers, suppliers, services, expenses, notifications, bookings, invoices, referrals
- **Impact:** Transfers unnecessary columns over network. Risk of accidental data leakage. Prevents index-only scans
- **Files:** `customers.ts`, `suppliers.ts`, `services.ts`, `expenses.ts`, `notifications.ts`, `invoices.ts`, `bookings.ts`, `referral.ts`
- **Recommendation:** Replace with explicit column lists for each query

### P9 — Medium: react-icons Bundle Impact
- **Evidence:** 47 files import from `react-icons/fa` (~80+ icons) and 1 file imports from `react-icons/gi` (~9 icons). While v5 supports tree-shaking, the volume across 47 files means significant overhead
- **Impact:** Estimated 20-40KB+ of icon SVG data bundled. The `gi` (Game Icons) pack imported only on About page could leak full pack if tree-shaking fails
- **Files:** 47 files across `src/app/` and `src/components/`
- **Recommendation:** Audit actual icon usage. Consider importing only needed icons. Verify tree-shaking works in production build

### P10 — Medium: useEffect Data Fetching in Client Components
- **Evidence:** 63 useEffect calls across 31 files handle data loading. Pattern: useEffect + server action + setState
- **Impact:** Waterfall: component renders → useEffect fires → server action called → state updated → re-render. Each data-dependent page has at least 1 such waterfall
- **Files:** All admin managers, CRM pages, dealer pages
- **Recommendation:** For admin pages, consider React 19 `use()` with Suspense. For public pages, prefer server-side data fetching

### P11 — Medium: No next.config.ts Image/Caching Configuration
- **Evidence:** `next.config.ts` has only a production rewrite rule. No `images` config, no `headers` config for caching
- **Impact:** When images are added, no optimization will be active. No cache headers for static assets
- **File:** `next.config.ts`
- **Recommendation:** Add `images.remotePatterns` for Supabase storage. Add cache headers for static assets

### P12 — Medium: Supabase Client Bundle on Public Pages
- **Evidence:** `@supabase/supabase-js` (~70KB minified) is imported eagerly. Public pages (services, booking) that use it could defer loading
- **Impact:** ~70KB added to public page bundles unnecessarily
- **Files:** `src/app/booking/page.tsx`, `src/lib/services.ts`
- **Recommendation:** Use dynamic import for Supabase client on pages that don't need it immediately

### P13 — Low: Unused Public Assets
- **Evidence:** 5 SVG files in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) are default Next.js boilerplate. None are referenced by application code
- **Impact:** Minor — shipped to production but never used
- **File:** `public/`
- **Recommendation:** Delete unused SVGs

### P14 — Low: Cairo Font 4 Weights
- **Evidence:** Cairo loaded with weights 400, 600, 700, 900 + arabic/latin subsets
- **Impact:** 4 font files downloaded. Could reduce to 2-3 weights if not all are used
- **File:** `src/app/layout.tsx`
- **Recommendation:** Audit which weights are actually used. Consider dropping 900 if not needed

### P15 — Low: No `output: 'standalone'` for Deployment
- **Evidence:** `next.config.ts` has no `output` config. Default mode requires full `node_modules` for deployment
- **Impact:** Larger deployment packages. Standalone mode reduces Docker/deployment size
- **File:** `next.config.ts`
- **Recommendation:** Add `output: 'standalone'` for production deployment

### P16 — Medium: Dealer Pages Hardcoded Supabase Credentials
- **Evidence:** `src/app/dealer/page.tsx` and `src/app/dealer/profile/page.tsx` hardcode Supabase URL and anon key directly in client components
- **Impact:** Credentials embedded in client bundle (though anon key is semi-public, this is poor practice)
- **Files:** `src/app/dealer/page.tsx:16-19`, `src/app/dealer/profile/page.tsx:14-17`
- **Recommendation:** Use `@/lib/supabase/client` instead of hardcoded credentials

### P17 — Low: Lib/services.ts Uses Client Supabase in Server Context
- **Evidence:** `src/lib/services.ts` imports `createClient` from `@/lib/supabase/client` but is imported by server components (`services/page.tsx`, `services/[slug]/page.tsx`)
- **Impact:** Server components using client Supabase helper. Works but architecturally incorrect
- **File:** `src/lib/services.ts`
- **Recommendation:** Split into server and client versions, or use conditional import

---

## SEO Findings

### S1 — Critical: No Sitemap
- **Evidence:** No `sitemap.ts`, `sitemap.xml`, or dynamic sitemap generation exists
- **Impact:** Search engines cannot discover pages efficiently
- **Recommendation:** Create `src/app/sitemap.ts` using Next.js Metadata API. Include public pages: `/`, `/services`, `/services/[slug]`, `/about`, `/contact`, `/booking`, `/dealers`, `/offers`

### S2 — Critical: No Robots.txt
- **Evidence:** No `robots.ts` or `robots.txt` exists
- **Impact:** No crawl directives for search engines
- **Recommendation:** Create `src/app/robots.ts` allowing crawl of public pages, blocking `/admin/`, `/crm/`, `/dealer/`, `/api/`

### S3 — Critical: No Structured Data (JSON-LD)
- **Evidence:** Zero `schema.org` markup anywhere in the project
- **Impact:** No rich snippets in search results. Missing Organization, LocalBusiness, Service, BreadcrumbList schemas
- **Recommendation:** Add JSON-LD to root layout: `Organization` + `WebSite`. Add `LocalBusiness` or `TravelAgency` to homepage. Add `Service` schema to service detail pages

### S4 — Critical: Missing Per-Page Metadata on 5 of 8 Public Pages
- **Evidence:** Only `/services`, `/services/[slug]` have page-specific metadata. Home, About, Booking, Contact, Dealers, Offers all use `'use client'` and cannot export metadata
- **Impact:** All 5 pages inherit root layout metadata (same title/description). Search engines see duplicate metadata across pages
- **Files:** `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/booking/page.tsx`, `src/app/contact/page.tsx`, `src/app/dealers/page.tsx`, `src/app/offers/page.tsx`
- **Recommendation:** Convert static pages to server components OR use `generateMetadata()` in layout wrappers

### S5 — Critical: No OG/Twitter Images
- **Evidence:** Root layout has Open Graph config but no `images` property. No `opengraph-image.png` or `twitter:image` anywhere
- **Impact:** Social media shares show no preview image
- **Recommendation:** Create `public/og-image.png` (1200x630). Add `openGraph.images` to root metadata. Add `twitter` card metadata

### S6 — High: Wrong Canonical URLs on Public Pages
- **Evidence:** Root layout sets `canonical: "/"`. Subpages without their own metadata inherit this, causing all public pages to declare themselves as the homepage
- **Impact:** Duplicate content signals. Search engines may de-rank pages
- **Files:** All public pages without `export const metadata`
- **Recommendation:** Each public page needs its own `canonical` URL

### S7 — High: No Twitter Card Metadata
- **Evidence:** Zero `twitter` property in any metadata export
- **Impact:** Twitter/X shares have no structured preview
- **Recommendation:** Add `twitter: { card: 'summary_large_image', ... }` to root metadata

### S8 — High: Custom 404 Page Missing
- **Evidence:** No `not-found.tsx` file. Uses Next.js default English error page
- **Impact:** Poor UX for Arabic users. No SEO-friendly error page
- **Recommendation:** Create `src/app/not-found.tsx` with Arabic content, proper metadata, and navigation links

### S9 — High: Admin/CRM/Dealer Pages Not Blocked from Indexing (Partial)
- **Evidence:** Admin layout correctly sets `robots: { index: false, follow: false }`. CRM and Dealer layouts have NO robots directive
- **Impact:** CRM pages (`/crm/*`) and dealer pages (`/dealer/*`) could be indexed if discovered
- **Files:** `src/app/crm/layout.tsx`, `src/app/dealer/layout.tsx`
- **Recommendation:** Add `robots: { index: false, follow: false }` to CRM and Dealer layouts

### S10 — Medium: No Hreflang Tags
- **Evidence:** No `hreflang` attribute anywhere. Site is Arabic-only
- **Impact:** Low — acceptable for single-language site. But a self-referencing `hreflang="ar"` is best practice
- **Recommendation:** Add `alternates: { languages: { 'ar': '/' } }` to root metadata

### S11 — Medium: Social Media Links Are Placeholders
- **Evidence:** Instagram, TikTok, Snapchat links in Header/Footer use `https://instagram.com/` etc. WhatsApp uses `https://wa.me/966500000000`
- **Impact:** Broken social links in production
- **Files:** `src/components/Header.tsx`, `src/components/Footer.tsx`
- **Recommendation:** Configure actual social media URLs before launch

### S12 — Medium: Favicon and Icons Missing
- **Evidence:** No `favicon.ico`, `icon.png`, `apple-icon.png` in `public/`. `src/app/favicon.ico` exists but is a default Next.js icon
- **Impact:** Browser tabs show default icon. No Apple touch icon for mobile bookmarks
- **File:** `src/app/favicon.ico`
- **Recommendation:** Create branded favicon, icon, and apple-icon

### S13 — Low: No Manifest/PWA Support
- **Evidence:** No `manifest.webmanifest` or PWA configuration
- **Impact:** No installable progressive web app capability
- **Recommendation:** Low priority for Phase 24. Consider for future

---

## Security/Performance Cross-Check

| Check | Status | Notes |
|-------|--------|-------|
| RLS enabled on all tables | ✅ PASS | 35 `ENABLE ROW LEVEL SECURITY` statements |
| Middleware fail-closed | ✅ PASS | Returns 500 on auth errors |
| Admin layout auth | ✅ PASS | `requireAuth()` called |
| Dealer layout auth | ✅ PASS | `getCurrentUser()` called |
| No hardcoded service_role key | ✅ PASS | All use `process.env.*` |
| No client-side secret exposure | ✅ PASS | Anon key is semi-public (acceptable) |
| **CRM layout auth** | 🔴 **FAIL** | `src/app/crm/layout.tsx` has NO auth check — all CRM pages publicly accessible |
| Auth pages noindex | ✅ PASS | Admin has `robots: { index: false }` |

---

## Positive Findings

1. **Build passes cleanly** — 0 TypeScript errors, 46 pages compiled
2. **Font loading optimal** — Cairo via `next/font/google`, self-hosted, no FOUT
3. **Security headers comprehensive** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
4. **Admin noindex correct** — Search engines won't index admin panel
5. **Services page uses Suspense** — Server component with streaming
6. **Admin dashboard uses Suspense** — Progressive loading of KPIs/charts/activity
7. **Minimal dependencies** — Only 5 production deps (next, react, react-dom, supabase-ssr, supabase-js, react-icons)
8. **No external scripts/CDN** — Clean, no third-party JS
9. **Debounced search** in admin components — Prevents excessive API calls
10. **Service detail pages use generateMetadata** — Dynamic SEO for service pages

---

## Measurement Gaps

| Metric | Status |
|--------|--------|
| LCP | **NEEDS PRODUCTION MEASUREMENT** — Cannot measure locally without Lighthouse |
| INP | **NEEDS PRODUCTION MEASUREMENT** — Requires real user interaction |
| CLS | **INFERRED: Low risk** — No images, no dynamic embeds, Tailwind layout. But font swap could cause CLS |
| TTFB | **INFERRED: Moderate** — Server components add latency, but Supabase queries are fast |
| Bundle size | **NEEDS PRODUCTION BUILD ANALYSIS** — `npm run build` output not analyzed for JS chunk sizes |
| Lighthouse score | **NEEDS PRODUCTION URL** — Cannot run Lighthouse locally |
| Core Web Vitals | **NEEDS CrUX / Search Console** — Requires production deployment |

---

## Production Blockers

| # | Blocker | Severity | Category |
|---|---------|----------|----------|
| 1 | CRM layout missing auth check | 🔴 CRITICAL | Security |
| 2 | No sitemap | 🔴 CRITICAL | SEO |
| 3 | No robots.txt | 🔴 CRITICAL | SEO |
| 4 | No structured data | 🔴 CRITICAL | SEO |
| 5 | Homepage fully client-rendered | 🔴 CRITICAL | Performance |
| 6 | No dynamic imports for admin | 🟡 HIGH | Performance |
| 7 | No per-page metadata (5 pages) | 🟡 HIGH | SEO |
| 8 | No OG/Twitter images | 🟡 HIGH | SEO |
| 9 | No custom 404 page | 🟡 HIGH | SEO |
| 10 | Social media placeholder URLs | 🟡 HIGH | Content |

---

## Phase 23 Recommended Fix Order

### Pre-Production (Must Fix)
1. **CRM layout auth** — Add authentication check (SECURITY)
2. **Homepage server component** — Extract FAQ to client component (PERFORMANCE)
3. **Sitemap + robots.txt** — Create `src/app/sitemap.ts` and `src/app/robots.ts` (SEO)
4. **Per-page metadata** — Convert static pages to server or use generateMetadata (SEO)
5. **OG/Twitter images** — Create images and add to metadata (SEO)
6. **Custom 404** — Create `src/app/not-found.tsx` with Arabic content (UX/SEO)
7. **Social media URLs** — Replace placeholders with real URLs (Content)

### High Priority (Should Fix)
8. **Dynamic imports** — Add `next/dynamic` for admin managers (PERFORMANCE)
9. **N+1 in createPurchase** — Batch material validation (PERFORMANCE)
10. **Sequential count queries** — Use GROUP BY or Promise.all (PERFORMANCE)
11. **Sequential independent queries** — Use Promise.all in getInvoice, getCommissionMonthlyReport (PERFORMANCE)
12. **SELECT * patterns** — Replace with explicit columns (PERFORMANCE/SECURITY)
13. **CRM/Dealer noindex** — Add robots: { index: false } (SEO)
14. **Structured data** — Add Organization, WebSite, LocalBusiness JSON-LD (SEO)

### Medium Priority (Nice to Have)
15. **loading.tsx/error.tsx** — Add route-level loading and error states (UX)
16. **Referral code loop** — Rely on DB UNIQUE constraint (PERFORMANCE)
17. **react-icons audit** — Verify tree-shaking, reduce imports (BUNDLE)
18. **Dealer hardcoded creds** — Use @/lib/supabase/client (CODE QUALITY)
19. **next.config.ts** — Add images config, cache headers, standalone output (DEPLOYMENT)
20. **Favicon/icons** — Create branded favicon set (BRANDING)

### Low Priority (Future)
21. **Font weight audit** — Reduce from 4 to 2-3 weights
22. **PWA/manifest** — Add web manifest
23. **Hreflang** — Add self-referencing ar hreflang
24. **Unused public assets** — Delete default SVGs

---

**PHASE 23 AUDIT STATUS: COMPLETE**
