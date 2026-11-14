// Temporary live smoke test for the non-destructive payment replacement used by
// createInvoiceWithPayment: insert the new payment first, then drop the old ones.
// Creates its own throwaway service/customer/vehicle/booking/invoice and removes
// all of them afterwards.
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TAG = Date.now()
let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`) }
}

const created = { paymentIds: [], invoiceIds: [], bookingId: null, vehicleId: null, customerId: null, serviceId: null }

const cleanup = async () => {
  for (const invId of created.invoiceIds) {
    await sb.from('payments').delete().eq('invoice_id', invId)
  }
  if (created.paymentIds.length) await sb.from('payments').delete().in('id', created.paymentIds)
  if (created.invoiceIds.length) await sb.from('invoices').delete().in('id', created.invoiceIds)
  if (created.bookingId) await sb.from('bookings').delete().eq('id', created.bookingId)
  if (created.vehicleId) await sb.from('vehicles').delete().eq('id', created.vehicleId)
  if (created.customerId) await sb.from('customers').delete().eq('id', created.customerId)
  if (created.serviceId) await sb.from('services').delete().eq('id', created.serviceId)
}

try {
  const { data: service, error: se } = await sb.from('services')
    .insert({ name: `SMOKE Service ${TAG}`, base_price: 800, is_active: false })
    .select('id').single()
  if (se) throw new Error(`service: ${se.message}`)
  created.serviceId = service.id

  const { data: customer, error: ce } = await sb.from('customers')
    .insert({ full_name: `SMOKE Customer ${TAG}`, phone: `05${String(TAG).slice(-8)}` })
    .select('id').single()
  if (ce) throw new Error(`customer: ${ce.message}`)
  created.customerId = customer.id

  const { data: vehicle, error: ve } = await sb.from('vehicles')
    .insert({ customer_id: customer.id, make: 'SMOKE', model: 'TEST' })
    .select('id').single()
  if (ve) throw new Error(`vehicle: ${ve.message}`)
  created.vehicleId = vehicle.id

  const { data: booking, error: be } = await sb.from('bookings')
    .insert({ customer_id: customer.id, vehicle_id: vehicle.id, service_id: service.id, status: 'new' })
    .select('id').single()
  if (be) throw new Error(`booking: ${be.message}`)
  created.bookingId = booking.id

  const { data: inv, error: ie } = await sb.from('invoices').insert({
    invoice_number: `SMOKE-${TAG}`,
    customer_id: customer.id,
    vehicle_id: vehicle.id,
    booking_id: booking.id,
    subtotal: 800,
    total: 800,
    paid_amount: 0,
    status: 'draft',
  }).select('id, status, total, paid_amount').single()
  if (ie) throw new Error(`invoice: ${ie.message}`)
  created.invoiceIds.push(inv.id)

  console.log('\n1) first payment (deposit 100)')
  const { data: p1, error: p1e } = await sb.from('payments')
    .insert({ invoice_id: inv.id, amount: 100, payment_method: 'cash' })
    .select('id').single()
  check('deposit insert', !p1e, p1e?.message)
  if (p1) created.paymentIds.push(p1.id)
  const { error: u1 } = await sb.from('invoices')
    .update({ paid_amount: 100, status: 'partially_paid' }).eq('id', inv.id)
  check('invoice -> partially_paid', !u1, u1?.message)

  console.log('\n2) replace with full payment 800 (new payment inserted FIRST)')
  const { data: p2, error: p2e } = await sb.from('payments')
    .insert({ invoice_id: inv.id, amount: 800, payment_method: 'card' })
    .select('id').single()
  check('replacement insert happens before any delete', !p2e, p2e?.message)
  if (p2) created.paymentIds.push(p2.id)
  const { error: resetErr } = await sb.from('invoices')
    .update({ status: 'issued', paid_amount: 0 }).eq('id', inv.id)
  check('reset to issued', !resetErr, resetErr?.message)
  const { error: u2 } = await sb.from('invoices')
    .update({ paid_amount: 800, status: 'paid' }).eq('id', inv.id)
  check('invoice -> paid 800', !u2, u2?.message)
  const { error: delErr } = await sb.from('payments')
    .delete().eq('invoice_id', inv.id).neq('id', p2.id)
  check('old payments removed with .neq()', !delErr, delErr?.message)

  const { data: pays } = await sb.from('payments').select('id, amount').eq('invoice_id', inv.id)
  check('exactly one payment left', pays?.length === 1, JSON.stringify(pays))
  check('it is the 800 one', pays?.[0]?.amount === 800, JSON.stringify(pays))
  const { data: after } = await sb.from('invoices').select('status, paid_amount').eq('id', inv.id).single()
  check('invoice paid_amount 800', after?.paid_amount === 800, JSON.stringify(after))
  check('invoice status paid', after?.status === 'paid', JSON.stringify(after))

  console.log('\n3) a failed insert must NOT wipe the existing payments')
  const { error: bad } = await sb.from('payments')
    .insert({ invoice_id: inv.id, amount: null, payment_method: 'cash' })
  check('bad insert rejected', !!bad, 'expected an error')
  const { data: stillThere } = await sb.from('payments').select('id, amount').eq('invoice_id', inv.id)
  check('existing payment survived the failure', stillThere?.length === 1, JSON.stringify(stillThere))
  const { data: unchanged } = await sb.from('invoices').select('status, paid_amount').eq('id', inv.id).single()
  check('invoice untouched by the failure', unchanged?.paid_amount === 800 && unchanged?.status === 'paid', JSON.stringify(unchanged))

  console.log('\n4) payment methods tabby/tamara accepted (migration 041)')
  const { error: tabbyErr } = await sb.from('payments')
    .insert({ invoice_id: inv.id, amount: 1, payment_method: 'tabby' })
  check('tabby accepted', !tabbyErr, tabbyErr?.message)
  if (!tabbyErr) {
    await sb.from('payments').delete().eq('invoice_id', inv.id)
    await sb.from('payments').insert({ invoice_id: inv.id, amount: 800, payment_method: 'card' })
  }

  console.log('\n5) invoice-per-booking unique index (is migration 052 applied?)')
  const { error: refundedErr } = await sb.from('invoices').insert({
    invoice_number: `SMOKE-OLD-${TAG}`,
    customer_id: customer.id,
    vehicle_id: vehicle.id,
    booking_id: booking.id,
    subtotal: 100, total: 100, paid_amount: 100, status: 'refunded',
  })
  if (refundedErr && (refundedErr.message.includes('duplicate') || refundedErr.code === '23505')) {
    console.log('  INFO  052 NOT applied → the old index blocks ANY second invoice (the "amount does not update" bug)')
  } else if (refundedErr) {
    console.log(`  INFO  refunded insert failed for another reason: ${refundedErr.message}`)
  } else {
    console.log('  INFO  052 applied → refunded invoice coexists with the live one')
    const { data: liveNow } = await sb.from('invoices')
      .select('id').eq('booking_id', booking.id).in('status', ['draft', 'issued', 'partially_paid', 'paid'])
    check('exactly one live invoice for the booking', liveNow?.length === 1, JSON.stringify(liveNow))
  }
} catch (e) {
  failed++
  console.log(`  FAIL  ${e.message}`)
} finally {
  await cleanup()
  console.log('\ncleanup done (service, customer, vehicle, booking, invoices, payments)')
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`)
process.exit(failed ? 1 : 0)
