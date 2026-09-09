const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    // Total referrals
    const totalRef = await client.query('SELECT count(*) as total FROM public.referrals');
    console.log('Total referrals:', totalRef.rows[0].total);

    // Referrals with services
    const refWithServices = await client.query(`
      SELECT referral_id, count(*) as svc_count
      FROM public.referral_services
      GROUP BY referral_id
      ORDER BY svc_count DESC
    `);
    console.log('Referrals with services:', refWithServices.rows.length);
    for (const r of refWithServices.rows) {
      console.log('  referral_id=' + r.referral_id + ' services=' + r.svc_count);
    }

    // Referrals WITHOUT any service
    const refNoService = await client.query(`
      SELECT r.id, r.status, r.customer_name
      FROM public.referrals r
      LEFT JOIN public.referral_services rs ON rs.referral_id = r.id
      WHERE rs.id IS NULL
    `);
    console.log('\nReferrals WITHOUT any service:', refNoService.rows.length);
    for (const r of refNoService.rows) {
      console.log('  id=' + r.id + ' status=' + r.status + ' customer=' + r.customer_name);
    }

    // Total referral_services rows
    const totalRS = await client.query('SELECT count(*) as total FROM public.referral_services');
    console.log('\nTotal referral_services rows:', totalRS.rows[0].total);

    // All referral_services rows
    const allRS = await client.query('SELECT * FROM public.referral_services ORDER BY created_at');
    console.log('\nAll referral_services:');
    for (const r of allRS.rows) {
      console.log('  id=' + r.id + ' referral_id=' + r.referral_id + ' service_id=' + r.service_id);
    }

    // Referral status distribution
    const statusDist = await client.query('SELECT status, count(*) as cnt FROM public.referrals GROUP BY status ORDER BY cnt DESC');
    console.log('\nReferral status distribution:');
    for (const r of statusDist.rows) {
      console.log('  ' + r.status + ': ' + r.cnt);
    }

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}
main();
