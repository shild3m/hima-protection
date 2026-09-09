const { execSync, spawn } = require('child_process');
const http = require('http');

process.env.NODE_ENV = 'development';

// Start the dev server using node directly
const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next',
  'dev', '--webpack', '-p', '3000'
], {
  cwd: 'C:\\Users\\aaaa1\\OneDrive\\Desktop\\hima-protection',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let ready = false;

server.stdout.on('data', (data) => {
  const msg = data.toString();
  process.stdout.write(data);
  if ((msg.includes('Ready') || msg.includes('Local:')) && !ready) {
    ready = true;
    setTimeout(runTests, 5000);
  }
});

server.stderr.on('data', (data) => process.stderr.write(data));

function fetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  const results = [];

  try {
    const r = await fetch('/staff-login');
    const ok = r.status === 200 && r.body.includes('تسجيل الدخول');
    results.push({ name: '1. /staff-login loads with login form', pass: ok, detail: `status=${r.status}` });
  } catch (e) { results.push({ name: '1. /staff-login loads', pass: false, detail: e.message }); }

  try {
    const r = await fetch('/admin');
    const ok = (r.status === 307 || r.status === 302) && (r.headers.location || '').includes('staff-login');
    results.push({ name: '2. /admin redirects unauth user', pass: ok, detail: `status=${r.status} loc=${r.headers.location || 'none'}` });
  } catch (e) { results.push({ name: '2. /admin redirects', pass: false, detail: e.message }); }

  try {
    const r = await fetch('/dealer');
    const ok = (r.status === 307 || r.status === 302) && (r.headers.location || '').includes('staff-login');
    results.push({ name: '3. /dealer redirects unauth user', pass: ok, detail: `status=${r.status} loc=${r.headers.location || 'none'}` });
  } catch (e) { results.push({ name: '3. /dealer redirects', pass: false, detail: e.message }); }

  try {
    const r = await postJSON('/api/check-staff', {});
    const data = JSON.parse(r.body);
    const ok = data.isStaff === false;
    results.push({ name: '4. check-staff without session = not staff', pass: ok, detail: JSON.stringify(data) });
  } catch (e) { results.push({ name: '4. check-staff', pass: false, detail: e.message }); }

  console.log('\n=== STAFF-LOGIN TEST RESULTS ===');
  results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.name} (${r.detail})`));
  const passed = results.filter(r => r.pass).length;
  console.log(`${passed}/${results.length} passed`);

  server.kill();
  process.exit(0);
}

setTimeout(() => { console.error('TIMEOUT'); server.kill(); process.exit(1); }, 50000);
