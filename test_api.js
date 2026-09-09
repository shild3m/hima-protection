const https = require('https');

const HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co").hostname;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";

function api(method, path, body) {
  const data = body != null ? JSON.stringify(body) : null;
  const isPost = method === 'POST' || method === 'PUT' || method === 'PATCH';
  return new Promise((resolve) => {
    const opts = {
      hostname: HOST, port: 443, path, method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        ...(isPost ? { 'Content-Profile': 'public' } : { 'Accept-Profile': 'public' }),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(d); } catch { parsed = d; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Waiting 30s for Data API config propagation...');
  await new Promise(r => setTimeout(r, 30000));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  PostgREST API Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  let pass = 0, fail = 0;

  function report(name, status, body) {
    const is404 = status === 404 && body?.code?.startsWith('PGRST20');
    if (is404) {
      fail++;
      console.log(`FAIL | ${name}`);
      console.log(`  HTTP ${status} | ${body.code}: ${body.message}\n`);
    } else {
      pass++;
      console.log(`PASS | ${name}`);
      console.log(`  HTTP ${status} | Found in schema cache`);
      console.log(`  Body: ${JSON.stringify(body).substring(0, 150)}\n`);
    }
  }

  // TABLE
  const t1 = await api('GET', '/rest/v1/materials?select=id&limit=1');
  report('TABLE: materials', t1.status, t1.body);

  // RPCs
  const tests = [
    ['generate_invoice_number', {}],
    ['record_stock_adjustment', { p_material_id:'00000000-0000-0000-0000-000000000000', p_quantity:1, p_direction:'in', p_notes:'verify', p_idempotency_key:'v-'+Date.now() }],
    ['receive_purchase', { p_purchase_id:'00000000-0000-0000-0000-000000000000', p_items:[] }],
    ['record_inventory_usage', { p_material_id:'00000000-0000-0000-0000-000000000000', p_quantity:1, p_booking_id:'00000000-0000-0000-0000-000000000000', p_service_id:'00000000-0000-0000-0000-000000000000', p_vehicle_id:'00000000-0000-0000-0000-000000000000', p_notes:'verify', p_idempotency_key:'v-'+Date.now() }],
    ['complete_booking', { p_booking_id:'00000000-0000-0000-0000-000000000000', p_materials:[], p_notes:'verify' }],
    ['create_guest_booking', { p_customer_name:'API Test', p_customer_phone:'+966500000000', p_car_make:'Test', p_car_model:'Model', p_service_id:'00000000-0000-0000-0000-000000000000' }],
    ['create_invoice', { p_customer_id:'00000000-0000-0000-0000-000000000000', p_discount:0, p_tax_rate:15, p_items:[] }],
    ['record_payment', { p_invoice_id:'00000000-0000-0000-0000-000000000000', p_amount:100, p_payment_method:'cash' }],
    ['update_invoice', { p_invoice_id:'00000000-0000-0000-0000-000000000000', p_discount:0, p_tax_rate:15 }],
    ['create_commission', { p_referral_id:'00000000-0000-0000-0000-000000000000' }],
  ];

  for (const [name, params] of tests) {
    const res = await api('POST', `/rest/v1/rpc/${name}`, params);
    report(`RPC: ${name}`, res.status, res.body);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} PASS / ${fail} FAIL out of ${pass + fail}`);
  if (fail === 0) console.log('  ALL PASS — 404 schema cache issue RESOLVED');
  else console.log(`  ${fail} still 404 — schema cache issue PERSISTS`);
  console.log('═══════════════════════════════════════════════════════════');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
