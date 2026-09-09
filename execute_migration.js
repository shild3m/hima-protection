const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SQL = fs.readFileSync(
  path.join(__dirname, 'supabase', 'migrations', '004_phase05_hardening.sql'),
  'utf8'
);

function parseSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.substring(i);

    if (rest.substring(0, 2) === '$$') {
      current += '$$';
      i += 2;
      inDollarQuote = !inDollarQuote;
      continue;
    }

    if (ch === ';' && !inDollarQuote) {
      current += ';';
      const trimmed = current.trim();
      if (trimmed) {
        const stripped = trimmed.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
        if (stripped) {
          statements.push(stripped);
        }
      }
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  if (current.trim()) {
    const stripped = current.trim().split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
    if (stripped) {
      statements.push(stripped);
    }
  }

  return statements;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  await client.connect();
  console.log('Connected to database\n');

  const statements = parseSQL(SQL);
  console.log('Parsed ' + statements.length + ' statements\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n')[0].substring(0, 100);

    if (stmt.match(/^\s*SELECT\s/i)) {
      console.log('--- VERIFY: ' + firstLine.substring(0, 80));
      try {
        const result = await client.query(stmt);
        if (result.rows && result.rows.length > 0) {
          result.rows.forEach(r => console.log('  ' + JSON.stringify(r)));
        }
      } catch (e) {
        console.log('  ERROR: ' + e.message);
      }
      continue;
    }

    console.log('[' + (i + 1) + '/' + statements.length + '] ' + firstLine.substring(0, 90));
    try {
      await client.query(stmt);
      console.log('  OK');
      successCount++;
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('does not exist')) {
        console.log('  SKIP (idempotent): ' + e.message.substring(0, 80));
        skipCount++;
      } else {
        console.error('  ERROR: ' + e.message);
        errorCount++;
      }
    }
  }

  console.log('\n=== RESULTS ===');
  console.log('Success: ' + successCount);
  console.log('Skipped: ' + skipCount);
  console.log('Errors:  ' + errorCount);
  console.log('=== MIGRATION COMPLETE ===');

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
