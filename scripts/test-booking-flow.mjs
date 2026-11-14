/**
 * Pure flow tests (no DB / no network).
 * Run with: node scripts/test-booking-flow.mjs
 */
import {
  decideBookingFlow,
  pickLiveInvoice,
  computeInvoicePayment,
  isLiveInvoiceStatus,
  availableBookingStatuses,
  isValidBookingTransition,
  BOOKING_STATUSES,
} from '../src/lib/booking-flow.ts'

let passed = 0
let failed = 0
const failures = []

function eq(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failed++
    failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`)
  }
}

function section(title) {
  console.log(`\n— ${title}`)
}

const ALL_STATUSES = ['new', 'contacted', 'in_progress', 'completed', 'cancelled']

section('Every target status that is not in_progress/completed → status only')
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    if (to === 'in_progress' || to === 'completed') continue
    eq(`from ${from} to ${to}`, decideBookingFlow({ targetStatus: to, linkedInvoice: null }), { type: 'apply_status' })
    eq(
      `from ${from} to ${to} (with live invoice)`,
      decideBookingFlow({ targetStatus: to, linkedInvoice: { status: 'paid', total: 100, paid_amount: 100 } }),
      { type: 'apply_status' },
    )
  }
}

section('Booking transition matrix (normal rules)')
const EXPECTED_TRANSITIONS = {
  new: ['contacted', 'cancelled'],
  contacted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}
for (const from of BOOKING_STATUSES) {
  eq(`available statuses from ${from}`, availableBookingStatuses(from), EXPECTED_TRANSITIONS[from])
  for (const to of BOOKING_STATUSES) {
    const allowed = EXPECTED_TRANSITIONS[from].includes(to)
    eq(`${from} → ${to}`, isValidBookingTransition(from, to), allowed)
  }
}
eq('unknown status has no transitions', availableBookingStatuses('weird'), [])
eq('unknown status cannot transition', isValidBookingTransition('weird', 'new'), false)

section('Booking transition matrix (super admin)')
for (const from of BOOKING_STATUSES) {
  for (const to of BOOKING_STATUSES) {
    // Super admin may jump anywhere except out of `completed` (terminal) and
    // onto its own current status.
    const allowed = from !== 'completed' && from !== to
    eq(`super admin ${from} → ${to}`, isValidBookingTransition(from, to, true), allowed)
  }
}

section('Every offered transition has a decision, every blocked one is not offered')
const INVOICE_STATES = [
  null,
  { status: 'refunded', total: 800, paid_amount: 100 },
  { status: 'partially_paid', total: 800, paid_amount: 100 },
  { status: 'paid', total: 800, paid_amount: 800 },
]
for (const from of BOOKING_STATUSES) {
  for (const to of BOOKING_STATUSES) {
    const offered = isValidBookingTransition(from, to)
    for (const linkedInvoice of INVOICE_STATES) {
      const decision = decideBookingFlow({ targetStatus: to, linkedInvoice })
      const types = ['apply_status', 'complete_prompt', 'invoice_prompt', 'payment_prompt']
      eq(`decision exists for ${from} → ${to}`, types.includes(decision.type), true)
      if (!offered) continue
      // A transition the server would reject must never be asked about as a
      // plain status change with no payment/warranty step.
      if (to !== 'in_progress' && to !== 'completed') {
        eq(`${from} → ${to} is a plain status change`, decision.type, 'apply_status')
      }
    }
  }
}

section('→ in_progress')
const inProgressCases = [
  ['no invoice', null, { type: 'payment_prompt', completeAfterPayment: false }],
  ['refunded invoice', { status: 'refunded', total: 800, paid_amount: 100 }, { type: 'payment_prompt', completeAfterPayment: false }],
  ['cancelled invoice', { status: 'cancelled', total: 800, paid_amount: 0 }, { type: 'payment_prompt', completeAfterPayment: false }],
  ['draft invoice', { status: 'draft', total: 800, paid_amount: 0 }, { type: 'invoice_prompt', mode: 'new_to_progress' }],
  ['issued invoice', { status: 'issued', total: 800, paid_amount: 0 }, { type: 'invoice_prompt', mode: 'new_to_progress' }],
  ['partially paid invoice', { status: 'partially_paid', total: 800, paid_amount: 100 }, { type: 'invoice_prompt', mode: 'new_to_progress' }],
  ['paid invoice', { status: 'paid', total: 800, paid_amount: 800 }, { type: 'invoice_prompt', mode: 'new_to_progress' }],
]
for (const [name, linkedInvoice, expected] of inProgressCases) {
  for (const from of ['new', 'contacted', 'cancelled']) {
    eq(`${name} from ${from}`, decideBookingFlow({ targetStatus: 'in_progress', linkedInvoice }), expected)
  }
}

section('→ completed')
const completedCases = [
  ['no invoice', null, { type: 'payment_prompt', completeAfterPayment: true }],
  ['refunded invoice', { status: 'refunded', total: 800, paid_amount: 800 }, { type: 'payment_prompt', completeAfterPayment: true }],
  ['cancelled invoice', { status: 'cancelled', total: 800, paid_amount: 0 }, { type: 'payment_prompt', completeAfterPayment: true }],
  ['draft invoice', { status: 'draft', total: 800, paid_amount: 0 }, { type: 'invoice_prompt', mode: 'completed' }],
  ['issued invoice', { status: 'issued', total: 800, paid_amount: 0 }, { type: 'invoice_prompt', mode: 'completed' }],
  ['partially paid invoice', { status: 'partially_paid', total: 800, paid_amount: 100 }, { type: 'invoice_prompt', mode: 'completed' }],
  ['fully paid invoice', { status: 'paid', total: 800, paid_amount: 800 }, { type: 'complete_prompt' }],
]
for (const [name, linkedInvoice, expected] of completedCases) {
  eq(`${name} from in_progress`, decideBookingFlow({ targetStatus: 'completed', linkedInvoice }), expected)
}
eq(
  'paid amount above total still counts as fully paid',
  decideBookingFlow({ targetStatus: 'completed', linkedInvoice: { status: 'paid', total: 800, paid_amount: 900 } }),
  { type: 'complete_prompt' },
)
eq(
  'free invoice (0 total) counts as fully paid',
  decideBookingFlow({ targetStatus: 'completed', linkedInvoice: { status: 'paid', total: 0, paid_amount: 0 } }),
  { type: 'complete_prompt' },
)

section('isLiveInvoiceStatus')
for (const status of ['draft', 'issued', 'partially_paid', 'paid']) eq(`live: ${status}`, isLiveInvoiceStatus(status), true)
for (const status of ['cancelled', 'refunded', null, undefined, '', 'weird']) eq(`not live: ${String(status)}`, isLiveInvoiceStatus(status), false)

section('pickLiveInvoice')
eq('empty', pickLiveInvoice([]), null)
eq('null', pickLiveInvoice(null), null)
eq(
  'only refunded → falls back to refunded',
  pickLiveInvoice([{ status: 'refunded', total: 800, paid_amount: 100, created_at: '2026-01-01' }]),
  { status: 'refunded', total: 800, paid_amount: 100, created_at: '2026-01-01' },
)
eq(
  'refunded + live → picks live',
  pickLiveInvoice([
    { status: 'refunded', total: 800, paid_amount: 100, created_at: '2026-01-01' },
    { status: 'issued', total: 900, paid_amount: 0, created_at: '2026-02-01' },
  ]),
  { status: 'issued', total: 900, paid_amount: 0, created_at: '2026-02-01' },
)
eq(
  'two live → newest wins',
  pickLiveInvoice([
    { status: 'partially_paid', total: 800, paid_amount: 100, created_at: '2026-01-01' },
    { status: 'issued', total: 900, paid_amount: 0, created_at: '2026-02-01' },
  ]),
  { status: 'issued', total: 900, paid_amount: 0, created_at: '2026-02-01' },
)
eq(
  'two history invoices → newest history wins',
  pickLiveInvoice([
    { status: 'refunded', total: 800, paid_amount: 100, created_at: '2026-01-01' },
    { status: 'cancelled', total: 900, paid_amount: 0, created_at: '2026-02-01' },
  ]),
  { status: 'cancelled', total: 900, paid_amount: 0, created_at: '2026-02-01' },
)

section('computeInvoicePayment')
eq('full records total', computeInvoicePayment(800, 'full'), { ok: true, amount: 800, status: 'paid' })
eq('deposit 100', computeInvoicePayment(800, 'deposit', 100), { ok: true, amount: 100, status: 'partially_paid' })
eq('deposit equal to total → paid', computeInvoicePayment(800, 'deposit', 800), { ok: true, amount: 800, status: 'paid' })
eq('deposit above total → rejected', computeInvoicePayment(800, 'deposit', 801), {
  ok: false,
  error: 'المبلغ (801) أكبر من إجمالي الفاتورة (800)',
})
eq('deposit zero → rejected', computeInvoicePayment(800, 'deposit', 0), { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' })
eq('deposit negative → rejected', computeInvoicePayment(800, 'deposit', -5), { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' })
eq('deposit missing → rejected', computeInvoicePayment(800, 'deposit'), { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' })
eq('full on zero-total invoice → rejected', computeInvoicePayment(0, 'full'), { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' })

console.log(`\n=== ${passed} passed, ${failed} failed ===`)
if (failed) {
  console.log(failures.join('\n\n'))
  process.exit(1)
}
