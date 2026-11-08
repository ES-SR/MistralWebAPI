// Zero-dependency smoke test: syntax-checks all JS/TS and boots server.ts on a
// test port to verify static serving, security headers, and basic hardening.
// Run: npm run smoke   (requires Node >= 22.18 for server.ts type-stripping)
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 3199;
let failures = 0;
const ok = (name, cond) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
};

const jsFiles = ['server.ts'];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) jsFiles.push(p);
  }
})(join(ROOT, 'public', 'js'));

for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { cwd: ROOT, stdio: 'pipe' });
    ok('syntax ' + f, true);
  } catch {
    ok('syntax ' + f, false);
  }
}

ok('server.ts binds 127.0.0.1 by default', readFileSync(join(ROOT, 'server.ts'), 'utf8').includes("|| '127.0.0.1'"));

const srv = spawn(process.execPath, ['server.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((r) => setTimeout(r, 1200));

const base = `http://127.0.0.1:${PORT}`;
const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, ct: r.headers.get('content-type'), csp: r.headers.get('content-security-policy'), nosniff: r.headers.get('x-content-type-options'), cache: r.headers.get('cache-control'), body: await r.text() };
};

try {
  let r = await get('/');
  ok('GET / → 200 html', r.status === 200 && (r.ct ?? '').includes('text/html'));
  ok('CSP script-src self', !!r.csp && r.csp.includes("script-src 'self'"));
  ok('nosniff + no-store headers', r.nosniff === 'nosniff' && (r.cache ?? '').includes('no-store'));

  for (const p of ['/styles.css', '/js/app.js', '/js/executor.js', '/js/store.js', '/js/providers/mistral.js', '/js/openapi.js']) {
    r = await get(p);
    ok(`GET ${p} → 200`, r.status === 200 && r.body.length > 0);
  }

  r = await get('/api/call');
  ok('GET /api/call → 404 (no server-side API)', r.status === 404);
  r = await get('/%2e%2e/%2e%2e/server.ts');
  ok('path traversal blocked', r.status !== 200);
  r = await get('/does-not-exist');
  ok('GET unknown → 404', r.status === 404);
} catch (e) {
  ok('server reachable: ' + e.message, false);
} finally {
  srv.kill();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
