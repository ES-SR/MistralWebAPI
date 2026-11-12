import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_CONFIG_PATH = join(ROOT_DIR, 'config.conf');
const PUBLIC_DIR = join(ROOT_DIR, 'public') + sep;

// Flexible, case-insensitive flag patterns (matching @args:parse DSL style:
// Help, Conf.ig.uration.File:1, Port:1, Host.Addr.ess:1)
const FLAG_SPECS = [
  { key: 'help', takesValue: false, re: /^(?:(?:-|--)?help|(?:-|--)?h)$/i },
  { key: 'config', takesValue: true, re: /^(?:(?:-|--)?conf(?:ig(?:uration)?)?(?:[-_.]?file)?|(?:-|--)?c(?:[-_.]?f)?)$/i },
  { key: 'port', takesValue: true, re: /^(?:(?:-|--)?ports?|(?:-|--)?p)$/i },
  { key: 'host', takesValue: true, re: /^(?:(?:-|--)?host(?:[-_.]?addr(?:ess)?)?|(?:-|--)?addr(?:ess)?|(?:-|--)?h[-_.]?a|-H)$/i },
];

function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = String(argv[i]);
    const eqIdx = raw.indexOf('=');
    const flagPart = eqIdx !== -1 ? raw.slice(0, eqIdx) : raw;
    const inlineVal = eqIdx !== -1 ? raw.slice(eqIdx + 1) : undefined;

    const spec = FLAG_SPECS.find((s) => s.re.test(flagPart));
    if (!spec) continue;

    if (!spec.takesValue) {
      out[spec.key] = true;
    } else if (inlineVal !== undefined) {
      out[spec.key] = inlineVal;
    } else if (i + 1 < argv.length) {
      out[spec.key] = String(argv[++i]);
    }
  }
  return out;
}

function parseKeyValueConfig(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Config root must be an object.');
    }
    return {
      host: parsed.Host ?? parsed.host,
      port: parsed.Port ?? parsed.port,
    };
  }
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').replace(/\s+/g, '');
    if (!line) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(`Invalid config line: "${rawLine}" (expected Key = Value)`);
    }
    const key = line.slice(0, eqIdx).toLowerCase();
    const val = line.slice(eqIdx + 1);
    if (key === 'host' || key === 'hostaddress' || key === 'address') out.host = val;
    if (key === 'port') out.port = val;
  }
  return out;
}

function loadConfigFile(configPath, explicit) {
  try {
    const text = readFileSync(configPath, 'utf8');
    return parseKeyValueConfig(text);
  } catch (err) {
    if (explicit) {
      console.error(`Failed to load config file "${configPath}": ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return {};
  }
}

const cli = parseCliArgs(process.argv.slice(2));

if (cli.help) {
  console.log(`Usage: node server.ts [options]

Options (case-insensitive, supports --flag val, flag=val, or short flags):
  -h, --help                         Show this help message
  -cf, --configuration-file <path>   Path to Key=Value config file (default: ./config.conf)
  -p, --port <0-65535>               Port to listen on (overrides config.conf; 0 = random free port)
  -ha, --host-address <addr>         Address to bind to (overrides config.conf; default: 127.0.0.1)`);
  process.exit(0);
}

const configPath = cli.config ? resolve(cli.config) : DEFAULT_CONFIG_PATH;
const fileConfig = loadConfigFile(configPath, Boolean(cli.config));

const rawPort = cli.port ?? fileConfig.port ?? 3000;
const parsedPort = Number(rawPort);
if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
  console.error(`Invalid port: "${rawPort}". Expected an integer between 0 and 65535.`);
  process.exit(1);
}

const PORT = parsedPort;
const HOST = String(cli.host || fileConfig.host || '127.0.0.1').trim();

const isLoopback = (h) => h === '127.0.0.1' || h === 'localhost' || h === '::1' || h.startsWith('127.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function send(res, status, body, type) {
  res.writeHead(status, { ...HEADERS, 'Content-Type': type });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return;
    }
    const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
    const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    const fp = normalize(join(PUBLIC_DIR, rel));
    if (!fp.startsWith(PUBLIC_DIR)) {
      send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
      return;
    }
    try {
      const data = await readFile(fp);
      res.writeHead(200, {
        ...HEADERS,
        'Content-Type': MIME[extname(fp)] ?? 'application/octet-stream',
      });
      res.end(data);
    } catch {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
  } catch {
    send(res, 500, 'Internal error', 'text/plain; charset=utf-8');
  }
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const displayHost = HOST.includes(':') ? `[${HOST}]` : HOST;
  if (!isLoopback(HOST)) {
    console.warn(`Warning: bound to non-loopback address "${HOST}". Use a TLS reverse proxy if exposing beyond localhost.`);
  }
  console.log(`Web API Playground (static UI only) at http://${displayHost}:${actualPort}`);
  console.log('API calls are made directly from your browser — this server never sees your API keys.');
});
