import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url)) + sep;

const MIME: Record<string, string> = {
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
  "img-src 'self' data:",
  "connect-src 'self' https://api.mistral.ai",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

function send(res: ServerResponse, status: number, body: string, type: string): void {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return;
    }
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const rel = path === '/' ? 'index.html' : path.slice(1);
    const fp = normalize(join(PUBLIC_DIR, rel));
    if (!fp.startsWith(PUBLIC_DIR)) {
      send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
      return;
    }
    try {
      const data = await readFile(fp);
      res.writeHead(200, {
        'Content-Type': MIME[extname(fp)] ?? 'application/octet-stream',
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
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
  console.log(`Mistral API playground (static UI only) at http://${HOST}:${PORT}`);
  console.log('API calls are made directly from your browser to api.mistral.ai — this server never sees your API key.');
});
