import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";

const supabase = createClient(URL, SERVICE_KEY);
const sql = readFileSync("supabase/migrations/026_phase17_fixes.sql", "utf-8");

// Split SQL into individual statements
const statements = sql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

console.log(`Found ${statements.length} SQL statements to execute`);

async function run() {
  // First try to create a temporary exec function
  const { data: test, error: testErr } = await supabase.rpc("exec_sql", { sql: "SELECT 1" });
  
  if (testErr) {
    console.log("exec_sql not available. Trying to execute via individual table queries...");
  }

  // Execute each statement using the Management API approach
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const stmtPreview = stmt.substring(0, 80).replace(/\n/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${stmtPreview}...`);
    
    // Try using the SQL endpoint for each statement
    try {
      const res = await fetch(`${URL}/sql`, {
        method: "POST",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: stmt + ";" }),
        signal: AbortSignal.timeout(30000),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log(`  OK: ${JSON.stringify(data).substring(0, 200)}`);
      } else {
        const body = await res.text();
        console.log(`  HTTP ${res.status}: ${body.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
}

run().catch(e => console.error("FATAL:", e.message));
