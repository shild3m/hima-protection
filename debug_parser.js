const fs = require('fs');
const SQL = fs.readFileSync('supabase/migrations/004_phase05_hardening.sql', 'utf8');

// Debug: find first few $$ positions
let pos = 0;
let count = 0;
while (count < 10) {
  const idx = SQL.indexOf('$$', pos);
  if (idx === -1) break;
  const context = SQL.substring(Math.max(0, idx - 20), idx + 20);
  console.log(`Found $$ at position ${idx}: ${JSON.stringify(context)}`);
  count++;
  pos = idx + 2;
}

console.log('\nTotal $$ count:', (SQL.match(/\$\$/g) || []).length);

// Debug: trace the parser
let current = '';
let inDollarQuote = false;
let statements = [];
let charCount = 0;

for (let i = 0; i < SQL.length; i++) {
  const ch = SQL[i];

  if (ch === '$' && i + 1 < SQL.length && SQL[i + 1] === '$') {
    inDollarQuote = !inDollarQuote;
    current += '$$';
    i += 1;
    charCount += 2;
    if (statements.length === 0 || inDollarQuote) {
      console.log(`At char ${i}: $$ detected, inDollarQuote=${inDollarQuote}`);
    }
    continue;
  }

  if (ch === ';' && !inDollarQuote) {
    current += ';';
    const trimmed = current.trim();
    if (trimmed && !trimmed.match(/^--/)) {
      statements.push(trimmed);
    }
    current = '';
    charCount++;
    continue;
  }

  current += ch;
  charCount++;
}

console.log('\nFound ' + statements.length + ' statements');
statements.forEach((s, idx) => {
  const preview = s.split('\n')[0].substring(0, 80);
  console.log(`${idx + 1}: ${preview}`);
});
