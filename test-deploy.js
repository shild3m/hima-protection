const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
async function main() {
  const sql = fs.readFileSync("supabase/migrations/023_phase16_receive_purchase.sql", "utf8");
  
  // Try Supabase SQL API (graphiql endpoint)
  const res = await fetch(URL + "/pg/postgres", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SERVICE,
      "apikey": SERVICE,
    },
    body: JSON.stringify({ query: sql }),
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.substring(0, 500));
}
main().catch(e => console.error(e));
