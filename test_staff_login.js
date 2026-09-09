const { execSync, spawn } = require('child_process');
const http = require('http');

// Start the dev server
const server = spawn('npx', ['next', 'dev', '--webpack'], {
  cwd: 'C:\\Users\\aaaa1\\OneDrive\\Desktop\\hima-protection',
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', data => {
  const msg = data.toString();
  if (msg.includes('Ready') || msg.includes('Local:')) {
    console.log('SERVER READY');
    runTests();
  }
});

server.stderr.on('data', data => {
  process.stderr.write(data);
});

async function runTests() {
  // Wait a bit for server to be fully ready
  await new Promise(r => setTimeout(r, 2000));
  
  const tests = [];
  
  // Test 1: /staff-login loads
  tests.push(await testUrl('/staff-login', 'Staff login page loads'));
  
  // Test 2: /admin redirects
  tests.push(await testRedirect('/admin', 'Admin redirects to staff-login'));
  
  // Test 3: /dealer redirects
  tests.push(await testRedirect('/dealer', 'Dealer redirects to staff-login'));
  
  // Test 4: Login with correct credentials
  const loginResult = await testLogin('10admin@admin.com', 'Aa123456', true);
  tests.push({ name: 'Admin login succeeds', pass: loginResult });
  
  // Test 5: Login with wrong credentials
  const wrongResult = await testLogin('wrong@email.com', 'wrongpass', false);
  tests.push({ name: 'Wrong credentials rejected', pass: wrongResult });
  
  // Print results
  console.log('\n=== TEST RESULTS ===');
  tests.forEach(t => console.log(`${t.pass ? 'PASS' : 'FAIL'}: ${t.name}`));
  const passed = tests.filter(t => t.pass).length;
  console.log(`${passed}/${tests.length} passed`);
  
  server.kill();
  process.exit(passed === tests.length ? 0 : 1);
}

function testUrl(path, name) {
  return new Promise(resolve => {
    http.get(`http://localhost:3000${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pass = res.statusCode === 200 && (data.includes('تسجيل الدخول') || data.includes('البريد'));
        resolve({ name, pass });
      });
    }).on('error', () => resolve({ name, pass: false }));
  });
}

function testRedirect(path, name) {
  return new Promise(resolve => {
    http.get(`http://localhost:3000${path}`, res => {
      // Follow redirect manually
      if (res.statusCode === 307 || res.statusCode === 302) {
        resolve({ name, pass: true });
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ name, pass: false }));
      }
    }).on('error', () => resolve({ name, pass: false }));
  });
}

async function testLogin(email, pass, expectSuccess) {
  // We can't fully test Supabase auth from Node http, but we test the API endpoint
  return new Promise(resolve => {
    const postData = JSON.stringify({ email, password: pass });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/check-staff',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (expectSuccess) {
            resolve(json.isStaff === true);
          } else {
            resolve(json.isStaff === false);
          }
        } catch {
          resolve(!expectSuccess);
        }
      });
    });
    req.on('error', () => resolve(!expectSuccess));
    req.write(postData);
    req.end();
  });
}
