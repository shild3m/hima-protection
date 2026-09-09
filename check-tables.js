const {createClient}=require('@supabase/supabase-js');
const a=createClient('https://nzspowfxwntxfievmmxq.supabase.co',process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {data:d}=await a.from('dealers').select('id').limit(1);
  console.log('dealers:',JSON.stringify(d));
  const {data:r}=await a.from('referrals').select('id').limit(1);
  console.log('referrals:',JSON.stringify(r));
  const {data:c}=await a.from('commissions').select('id, status').limit(3);
  console.log('commissions:',JSON.stringify(c));
  const {data:s}=await a.from('services').select('id').limit(1);
  console.log('services:',JSON.stringify(s));
})()
