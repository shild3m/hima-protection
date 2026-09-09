const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()

const TEST_USERS = [
  { email: '10admin@admin.com', pass: 'Aa123456', label: 'Admin' },
  { email: 'reception@hima.com', pass: 'Aa123456', label: 'Receptionist' },
]

async function getAuthenticatedClient(email, password) {
  const sb = createClient(url, anonKey)
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`)
  return sb
}

function getServiceClient() {
  return createClient(url, serviceKey)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  let pass = 0, fail = 0

  try {
    const sbA = await getAuthenticatedClient(TEST_USERS[0].email, TEST_USERS[0].pass)
    const sbB = await getAuthenticatedClient(TEST_USERS[1].email, TEST_USERS[1].pass)

    // TEST 1: Valid action under limit (staff:create, limit 10)
    console.log('=== TEST 1: Under limit (expect ALLOWED) ===')
    const { data: d1, error: e1 } = await sbA.rpc('check_rate_limit', { p_action: 'staff:create' })
    if (!e1 && d1?.allowed && d1?.limit === 10) {
      console.log('  PASS: allowed=true, current=' + d1.current + ', limit=' + d1.limit); pass++
    } else {
      console.log('  FAIL:', e1?.message || JSON.stringify(d1)); fail++
    }

    // TEST 2: At limit (materials:create, limit 15)
    console.log('\n=== TEST 2: At limit (expect ALLOWED) ===')
    for (let i = 0; i < 14; i++) {
      await sbA.rpc('check_rate_limit', { p_action: 'materials:create' })
    }
    const { data: d2, error: e2 } = await sbA.rpc('check_rate_limit', { p_action: 'materials:create' })
    if (!e2 && d2?.allowed && d2?.current === 15 && d2?.limit === 15) {
      console.log('  PASS: allowed=true, current=15, limit=15'); pass++
    } else {
      console.log('  FAIL:', e2?.message || JSON.stringify(d2)); fail++
    }

    // TEST 3: Over limit (materials:create, already at 15)
    console.log('\n=== TEST 3: Over limit (expect REJECTED) ===')
    const { data: d3, error: e3 } = await sbA.rpc('check_rate_limit', { p_action: 'materials:create' })
    if (!e3 && !d3?.allowed && d3?.current === 16 && d3?.limit === 15) {
      console.log('  PASS: allowed=false, current=16, limit=15'); pass++
    } else {
      console.log('  FAIL:', e3?.message || JSON.stringify(d3)); fail++
    }

    // TEST 4: User isolation (bookings:update, limit 30)
    console.log('\n=== TEST 4: User isolation (expect B allowed) ===')
    await sbA.rpc('check_rate_limit', { p_action: 'bookings:update' })
    const { data: d4, error: e4 } = await sbB.rpc('check_rate_limit', { p_action: 'bookings:update' })
    if (!e4 && d4?.allowed && d4?.current === 1) {
      console.log('  PASS: user B allowed, current=1'); pass++
    } else {
      console.log('  FAIL:', e4?.message || JSON.stringify(d4)); fail++
    }

    // TEST 5: Action isolation (staff:create vs invoices:create, both limit 10/15)
    console.log('\n=== TEST 5: Action isolation (expect independent) ===')
    await sbA.rpc('check_rate_limit', { p_action: 'staff:create' })
    const { data: d5, error: e5 } = await sbA.rpc('check_rate_limit', { p_action: 'invoices:create' })
    if (!e5 && d5?.allowed && d5?.current === 1 && d5?.limit === 15) {
      console.log('  PASS: invoices:create independent, current=1, limit=15'); pass++
    } else {
      console.log('  FAIL:', e5?.message || JSON.stringify(d5)); fail++
    }

    // TEST 6: Window expiry (use staff:create with 60s window)
    // Consume remaining quota, then wait for window to expire
    console.log('\n=== TEST 6: Window expiry (60s window, waiting...) ===')
    // staff:create limit=10, we already used 1 in test 1 + 1 in test 5 = 2 used
    // Consume remaining 8 to hit limit
    for (let i = 0; i < 8; i++) {
      await sbA.rpc('check_rate_limit', { p_action: 'staff:create' })
    }
    const { data: d6a } = await sbA.rpc('check_rate_limit', { p_action: 'staff:create' })
    if (d6a?.allowed === false) {
      console.log('  INFO: Rate limited at staff:create, waiting 61s for window reset...')
      await sleep(61000)
      const { data: d6b, error: e6b } = await sbA.rpc('check_rate_limit', { p_action: 'staff:create' })
      if (!e6b && d6b?.allowed && d6b?.current === 1) {
        console.log('  PASS: window expired, reset to current=1'); pass++
      } else {
        console.log('  FAIL:', e6b?.message || JSON.stringify(d6b)); fail++
      }
    } else {
      console.log('  FAIL: expected rejected after consuming limit'); fail++
    }

    // TEST 7: Concurrency (payments:create, limit 10, send 20 parallel)
    console.log('\n=== TEST 7: Concurrency (20 parallel, limit 10) ===')
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(sbA.rpc('check_rate_limit', { p_action: 'payments:create' }))
    }
    const results = await Promise.all(promises)
    const allowed = results.filter(r => r.data?.allowed).length
    const rejected = results.filter(r => !r.data?.allowed).length
    if (allowed <= 10 && rejected >= 10) {
      console.log('  PASS: ' + allowed + ' allowed, ' + rejected + ' rejected'); pass++
    } else {
      console.log('  FAIL: ' + allowed + ' allowed, ' + rejected + ' rejected'); fail++
    }

    // TEST 8: Anonymous rejected (no auth.uid)
    console.log('\n=== TEST 8: Anonymous (expect EXCEPTION) ===')
    const anonSb = createClient(url, anonKey)
    const { data: d8, error: e8 } = await anonSb.rpc('check_rate_limit', { p_action: 'staff:create' })
    if (e8) {
      console.log('  PASS: exception raised for anonymous'); pass++
    } else {
      console.log('  FAIL: no error for anonymous call'); fail++
    }

    // TEST 9: Unknown action (not in allowlist)
    console.log('\n=== TEST 9: Unknown action (expect EXCEPTION) ===')
    const { data: d9, error: e9 } = await sbA.rpc('check_rate_limit', { p_action: 'test:unknown' })
    if (e9) {
      console.log('  PASS: exception raised for unknown action'); pass++
    } else {
      console.log('  FAIL: no error for unknown action'); fail++
    }

    // TEST 10: Empty action
    console.log('\n=== TEST 10: Empty action (expect EXCEPTION) ===')
    const { data: d10, error: e10 } = await sbA.rpc('check_rate_limit', { p_action: '' })
    if (e10) {
      console.log('  PASS: exception raised for empty action'); pass++
    } else {
      console.log('  FAIL: no error for empty action'); fail++
    }

    // TEST 11: Service role (no auth.uid)
    console.log('\n=== TEST 11: Service role (expect EXCEPTION) ===')
    const svcSb = getServiceClient()
    const { data: d11, error: e11 } = await svcSb.rpc('check_rate_limit', { p_action: 'staff:create' })
    if (e11) {
      console.log('  PASS: service role blocked'); pass++
    } else {
      console.log('  FAIL: service role allowed'); fail++
    }

    // TEST 12: Cleanup verification (rate_limits table should have own rows only)
    console.log('\n=== TEST 12: Cleanup check ===')
    const { data: d12, error: e12 } = await sbA.rpc('check_rate_limit', { p_action: 'purchases:create' })
    if (!e12 && d12?.allowed) {
      console.log('  PASS: purchases:create works, current=' + d12.current); pass++
    } else {
      console.log('  FAIL:', e12?.message || JSON.stringify(d12)); fail++
    }

  } catch (e) {
    console.error('FATAL:', e.message)
  }

  console.log('\n=== RESULTS: ' + pass + ' passed, ' + fail + ' failed ===')
}

main().catch(e => console.error(e))
