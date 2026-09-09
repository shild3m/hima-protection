const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

function splitSql(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    
    if (ch === '$') {
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        tag += sql[j];
        j++;
      }
      if (j < sql.length) {
        tag += '$';
        if (!inDollarQuote) {
          dollarTag = tag;
          inDollarQuote = true;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        current += sql.substring(i, j + 1);
        i = j;
        continue;
      }
    }
    
    if (ch === ';' && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  
  const last = current.trim();
  if (last.length > 0) {
    statements.push(last);
  }
  
  return statements;
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('CONNECTED to Supabase database');
    console.log('=== EXECUTING MIGRATION 003 ===\n');
    
    const sqlFile = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '003_fix_security_migration.sql'), 'utf8');
    const statements = splitSql(sqlFile);
    console.log('Total statements to execute: ' + statements.length + '\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      
      // Skip comment-only statements
      const lines = stmt.split('\n');
      const nonCommentLines = lines.filter(l => !l.trim().startsWith('--'));
      const stripped = nonCommentLines.join(' ').trim();
      if (stripped.length === 0) continue;
      
      // Extract section comment for progress
      const sectionMatch = stmt.match(/--\s*=\s*$/m);
      const firstLine = stmt.split('\n')[0].substring(0, 80);
      
      try {
        await client.query(stmt);
        successCount++;
        // Log progress for non-trivial statements
        if (!stripped.startsWith('--')) {
          const preview = stripped.substring(0, 100).replace(/\s+/g, ' ');
          console.log('  OK [' + (idx+1) + ']: ' + preview + (preview.length >= 100 ? '...' : ''));
        }
      } catch (e) {
        errorCount++;
        const preview = stripped.substring(0, 200).replace(/\s+/g, ' ');
        console.error('  ERR [' + (idx+1) + ']: ' + e.message.substring(0, 200));
        console.error('  SQL: ' + preview + '...');
        errors.push({ idx: idx+1, error: e.message, sql: preview });
      }
    }
    
    console.log('\n=== MIGRATION RESULT ===');
    console.log('Statements executed: ' + (successCount + errorCount));
    console.log('Successful: ' + successCount);
    console.log('Errors: ' + errorCount);
    
    if (errors.length > 0) {
      console.log('\nERROR DETAILS:');
      for (const e of errors) {
        console.log('  Statement ' + e.idx + ': ' + e.error.substring(0, 200));
      }
    }
    
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await client.end();
  }
}

main();
