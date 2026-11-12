// Zero-dependency smoke & unit test suite:
// 1. Syntax-checks server.ts and all public/js/**/*.js modules
// 2. Unit-tests provider catalogs, request/cURL building, SSE delta extraction, and OpenAPI 3.x import
// 3. Boots server.ts on an ephemeral port (--port 0), waits for stdout readiness (no fixed sleep),
//    and probes all static assets, security headers, method restrictions, and path traversal protections.
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildRequest, extractTextFromChunk, extractReadableOutput } from '../public/js/executor.js';
import { parseOpenApiSpec } from '../public/js/openapi.js';
import { BUILTIN_PROVIDERS, BUILTIN_PROVIDER_MAP } from '../public/js/providers/index.js';
import { DEFAULT_SETTINGS, serializeSettingsConf, parseSettingsConf } from '../public/js/store.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_DIR = join(ROOT, 'public');
let failures = 0;

const ok = (name, cond) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
};

// ── 1. Syntax checks ────────────────────────────────────────────────────────
const jsFiles = ['server.ts'];
const publicJsRoutes = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.js')) {
      jsFiles.push(p);
      publicJsRoutes.push('/' + relative(PUBLIC_DIR, p).replace(/\\/g, '/'));
    }
  }
})(join(PUBLIC_DIR, 'js'));

for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { cwd: ROOT, stdio: 'pipe' });
    ok('syntax ' + relative(ROOT, f), true);
  } catch {
    ok('syntax ' + relative(ROOT, f), false);
  }
}

// ── 2. Server CLI & config.conf checks ──────────────────────────────────────
const serverSrc = readFileSync(join(ROOT, 'server.ts'), 'utf8');
ok('server.ts binds 127.0.0.1 by default', serverSrc.includes("|| '127.0.0.1'"));

const defaultConf = readFileSync(join(ROOT, 'config.conf'), 'utf8');
ok('config.conf defines safe Key = Value defaults (127.0.0.1:3000)', defaultConf.includes('Host = 127.0.0.1') && defaultConf.includes('Port = 3000'));

const helpOut = execFileSync(process.execPath, ['server.ts', 'Help'], { cwd: ROOT, encoding: 'utf8' });
ok('server.ts accepts flexible Help flag and prints usage', helpOut.includes('--port') && helpOut.includes('--configuration-file'));

let invalidPortFailed = false;
try {
  execFileSync(process.execPath, ['server.ts', 'Port=99999'], { cwd: ROOT, stdio: 'pipe' });
} catch {
  invalidPortFailed = true;
}
ok('server.ts rejects out-of-range port (Port=99999)', invalidPortFailed);

let missingConfigFailed = false;
try {
  execFileSync(process.execPath, ['server.ts', '--configuration-file', '/nonexistent/config.conf'], { cwd: ROOT, stdio: 'pipe' });
} catch {
  missingConfigFailed = true;
}
ok('server.ts rejects missing explicit --configuration-file', missingConfigFailed);

{
  const confText = serializeSettingsConf({ ...structuredClone(DEFAULT_SETTINGS), fontSize: 18, responsePosition: 'right' });
  const parsed = parseSettingsConf(confText, structuredClone(DEFAULT_SETTINGS));
  ok(
    'settings Key = Value (.conf) round-trip preserves values',
    confText.includes('FontSize = 18') &&
      confText.includes('ResponsePosition = right') &&
      parsed.fontSize === 18 &&
      parsed.responsePosition === 'right',
  );
}

// ── 3. Unit tests for providers, executor, and OpenAPI importer ─────────────
ok('built-in providers registered (mistral, openai, anthropic, gemini)', BUILTIN_PROVIDERS.length === 4);
for (const p of BUILTIN_PROVIDERS) {
  ok(
    `provider "${p.id}" has valid operations (${p.operations.length})`,
    Array.isArray(p.operations) &&
      p.operations.length > 0 &&
      p.operations.every((op) => op.id && op.method && op.path && Array.isArray(op.fields)),
  );
}

{
  const mistral = BUILTIN_PROVIDER_MAP.mistral;
  const chatOp = mistral.operations.find((o) => o.id === 'chat.stream');
  const req = buildRequest(
    mistral,
    chatOp,
    {
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 128,
      topP: 0.9,
    },
    { apiKey: 'sk-testsecretkey12345' },
  );
  const parsedBody = JSON.parse(req.body);
  ok(
    'buildRequest converts camelCase to snake_case + adds stream=true',
    req.url === 'https://api.mistral.ai/v1/chat/completions' &&
      parsedBody.max_tokens === 128 &&
      parsedBody.top_p === 0.9 &&
      parsedBody.stream === true &&
      req.headers.Accept === 'text/event-stream',
  );
  ok(
    'buildRequest masks API key in generated cURL',
    req.curl.includes('Bearer sk-t…45') && !req.curl.includes('sk-testsecretkey12345'),
  );

  const modelUpdateOp = mistral.operations.find((o) => o.id === 'models.update');
  const patchReq = buildRequest(
    mistral,
    modelUpdateOp,
    {
      modelId: 'ft:model:123',
      updateFTModelIn: { name: 'renamed', description: 'desc' },
    },
    { apiKey: 'sk-testsecretkey12345' },
  );
  ok(
    'buildRequest interpolates {model_id} path & flattens bodyRoot',
    patchReq.url === 'https://api.mistral.ai/v1/models/ft%3Amodel%3A123' &&
      JSON.parse(patchReq.body).name === 'renamed',
  );
}

{
  const gemini = BUILTIN_PROVIDER_MAP.gemini;
  const streamOp = gemini.operations.find((o) => o.id === 'models.streamGenerateContent');
  const req = buildRequest(
    gemini,
    streamOp,
    {
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    },
    { apiKey: 'AIzaSyTestKey99' },
  );
  ok(
    'buildRequest handles Gemini path, extraQuery (?alt=sse), and x-goog-api-key header',
    req.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse' &&
      req.headers['x-goog-api-key'] === 'AIzaSyTestKey99',
  );
}

ok(
  'extractTextFromChunk extracts deltas across OpenAI/Mistral, Responses, Anthropic, and Gemini',
  extractTextFromChunk({ choices: [{ delta: { content: 'A' } }] }) === 'A' &&
    extractTextFromChunk({ type: 'response.output_text.delta', delta: 'B' }) === 'B' &&
    extractTextFromChunk({ type: 'content_block_delta', delta: { text: 'C' } }) === 'C' &&
    extractTextFromChunk({ candidates: [{ content: { parts: [{ text: 'D' }] } }] }) === 'D',
);

ok(
  'extractReadableOutput extracts non-streaming text across providers',
  extractReadableOutput({ choices: [{ message: { content: 'Chat reply' } }] }) === 'Chat reply' &&
    extractReadableOutput({ content: [{ type: 'text', text: 'Claude reply' }] }) === 'Claude reply' &&
    extractReadableOutput({ pages: [{ markdown: '# Page 1' }] }).includes('# Page 1'),
);

{
  const sampleSpec = {
    openapi: '3.0.3',
    info: { title: 'Widget API' },
    servers: [{ url: 'https://widgets.example.com/v1' }],
    components: {
      schemas: {
        CreateWidget: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', default: 'sprocket' },
            size: { type: 'string', enum: ['S', 'M', 'L'], default: 'M' },
          },
        },
      },
    },
    paths: {
      '/widgets/{widget_id}': {
        post: {
          tags: ['Widgets'],
          operationId: 'createWidget',
          summary: 'Create a widget',
          parameters: [{ name: 'widget_id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateWidget' },
              },
            },
          },
        },
      },
    },
  };
  const imported = parseOpenApiSpec(sampleSpec);
  const op = imported.operations[0];
  ok(
    'parseOpenApiSpec resolves $ref schemas, path params, and enum selects',
    imported.id === 'widget-api' &&
      imported.baseUrl === 'https://widgets.example.com/v1' &&
      op?.id === 'createWidget' &&
      op?.fields.some((f) => f.name === 'widget_id' && f.in === 'path' && f.required) &&
      op?.fields.some((f) => f.name === 'size' && f.type === 'select' && f.options.includes('M')),
  );
}

// ── 4. Live HTTP server checks (event-driven startup on ephemeral port 0) ──
function startTestServer() {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, ['server.ts', '--port', '0', '--host', '127.0.0.1'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      srv.kill();
      reject(new Error('Timed out waiting for server.ts to report listening URL'));
    }, 5000);

    let out = '';
    srv.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
      const match = out.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ srv, base: `http://127.0.0.1:${match[1]}` });
      }
    });
    srv.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    srv.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server.ts exited early with code ${code}`));
    });
  });
}

const { srv, base } = await startTestServer();

const get = async (p, method = 'GET') => {
  const r = await fetch(base + p, { method });
  return {
    status: r.status,
    ct: r.headers.get('content-type'),
    csp: r.headers.get('content-security-policy'),
    nosniff: r.headers.get('x-content-type-options'),
    cache: r.headers.get('cache-control'),
    body: await r.text(),
  };
};

try {
  let r = await get('/');
  ok('GET / → 200 html', r.status === 200 && (r.ct ?? '').includes('text/html'));
  ok('CSP script-src self', !!r.csp && r.csp.includes("script-src 'self'"));
  ok('nosniff + no-store headers', r.nosniff === 'nosniff' && (r.cache ?? '').includes('no-store'));

  for (const p of ['/styles.css', ...publicJsRoutes]) {
    r = await get(p);
    ok(`GET ${p} → 200`, r.status === 200 && r.body.length > 0);
  }

  r = await get('/', 'POST');
  ok('POST / → 405 Method Not Allowed', r.status === 405);
  r = await get('/api/call');
  ok('GET /api/call → 404 (no server-side API)', r.status === 404);
  r = await get('/%2e%2e/%2e%2e/server.ts');
  ok('path traversal blocked', r.status !== 200);
  r = await get('/does-not-exist');
  ok('GET unknown → 404', r.status === 404);

  // Bridge endpoints
  const bState0 = await fetch(base + '/bridge/state').then((res) => res.json());
  ok('GET /bridge/state → 200 ok', bState0.ok === true && typeof bState0.connectedClients === 'number');

  const bCmd = await fetch(base + '/bridge/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: 'test_req_1',
      action: 'fill',
      provider: 'mistral',
      operation: 'chat.complete',
      params: { model: 'mistral-small-latest', apiKey: 'should-be-stripped' },
    }),
  }).then((res) => res.json());
  ok(
    'POST /bridge/command dispatches and strips apiKey from params',
    bCmd.ok === true &&
      bCmd.command?.provider === 'mistral' &&
      bCmd.command?.params?.model === 'mistral-small-latest' &&
      !('apiKey' in (bCmd.command?.params ?? {})),
  );

  const bResp = await fetch(base + '/bridge/response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: 'test_req_1',
      provider: 'mistral',
      operation: 'chat.complete',
      status: 'OK (200)',
      ok: true,
      readable: 'Hello from bridge',
      raw: '{"id":"cmpl-1","content":"Hello from bridge"}',
    }),
  }).then((res) => res.json());
  const bState1 = await fetch(base + '/bridge/state').then((res) => res.json());
  ok(
    'POST /bridge/response updates bridgeState.lastResponse',
    bResp.ok === true &&
      bState1.activeProvider === 'mistral' &&
      bState1.lastResponse?.readable === 'Hello from bridge',
  );
} catch (e) {
  ok('server reachable: ' + e.message, false);
} finally {
  srv.kill();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
