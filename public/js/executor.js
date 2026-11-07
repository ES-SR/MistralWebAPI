const toSnake = (s) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const normKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function wireKeyFor(field, wireCase) {
  if (field.wireName) return field.wireName;
  if (wireCase === 'snake') return toSnake(field.name);
  return field.name;
}

const AUTH_APPLY = {
  bearer: ({ apiKey, headers }) => {
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  },
  header: ({ apiKey, auth, headers }) => {
    if (apiKey) headers[auth.headerName || 'x-api-key'] = apiKey;
  },
  query: ({ apiKey, auth, query }) => {
    if (apiKey) query.set(auth.queryParam || 'key', apiKey);
  },
  none: () => {},
};

function makeFallbackFile(content, fileName = 'upload.bin') {
  if (typeof content !== 'string' || !content.length) return null;
  if (content.startsWith('data:')) {
    const comma = content.indexOf(',');
    const meta = content.slice(5, comma);
    const mime = meta.split(';')[0] || 'application/octet-stream';
    const b64 = content.slice(comma + 1);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new File([bytes], fileName, { type: mime });
  }
  return new File([content], fileName, { type: 'text/plain;charset=utf-8' });
}

export function buildRequest(provider, op, rawParams, { apiKey = '', baseUrl = '' } = {}) {
  const effectiveBase = (baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  const rawPath = op.path.replace(/#.*$/, '');
  const fieldsByName = new Map((op.fields || []).map((f) => [f.name, f]));

  const clean = {};
  for (const [k, v] of Object.entries(rawParams ?? {})) {
    if (k === 'apiKey') continue;
    if (v === undefined || v === null || v === '') continue;
    clean[k] = v;
  }

  const usedKeys = new Set();
  const resolvedPath = rawPath.replace(/\{([^}]+)\}/g, (full, token) => {
    const tokenNorm = normKey(token);
    const matchKey = Object.keys(clean).find((k) => {
      const f = fieldsByName.get(k);
      const wk = f ? wireKeyFor(f, provider.wireCase) : k;
      return k === token || wk === token || normKey(k) === tokenNorm || normKey(wk) === tokenNorm;
    });
    if (matchKey !== undefined) {
      usedKeys.add(matchKey);
      return encodeURIComponent(String(clean[matchKey]));
    }
    return full;
  });

  const query = new URLSearchParams();
  if (op.extraQuery) {
    for (const [k, v] of Object.entries(op.extraQuery)) query.set(k, String(v));
  }

  const headers = {
    ...(provider.auth?.extraHeaders ?? {}),
  };

  const authType = provider.auth?.type || 'bearer';
  const applyAuth = AUTH_APPLY[authType] || AUTH_APPLY.bearer;
  applyAuth({ apiKey, auth: provider.auth || {}, headers, query });

  let body;
  let bodyPreview = null;
  const isGetOrHead = op.method === 'GET' || op.method === 'HEAD';

  if (isGetOrHead) {
    for (const [k, v] of Object.entries(clean)) {
      if (usedKeys.has(k)) continue;
      const f = fieldsByName.get(k) || { name: k };
      const wk = wireKeyFor(f, provider.wireCase);
      query.set(wk, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  } else if (op.contentType === 'multipart') {
    const form = new FormData();
    const previewObj = {};
    let hasFile = clean.file instanceof File;
    if (hasFile) {
      form.append('file', clean.file, clean.file.name);
      previewObj.file = `<File: ${clean.file.name} (${clean.file.size} bytes)>`;
      usedKeys.add('file');
    } else if (clean.fileContent) {
      const fallback = makeFallbackFile(clean.fileContent, clean.fileName || 'upload.txt');
      if (fallback) {
        form.append('file', fallback, fallback.name);
        previewObj.file = `<File from text: ${fallback.name} (${fallback.size} bytes)>`;
      }
    }
    usedKeys.add('fileContent');
    usedKeys.add('fileName');

    for (const [k, v] of Object.entries(clean)) {
      if (usedKeys.has(k)) continue;
      const f = fieldsByName.get(k) || { name: k };
      if (f.in === 'query') {
        query.set(wireKeyFor(f, provider.wireCase), typeof v === 'object' ? JSON.stringify(v) : String(v));
        continue;
      }
      if (f.in === 'header') {
        headers[wireKeyFor(f, provider.wireCase)] = String(v);
        continue;
      }
      const wk = wireKeyFor(f, provider.wireCase);
      if (v instanceof File) {
        form.append(wk, v, v.name);
        previewObj[wk] = `<File: ${v.name} (${v.size} bytes)>`;
      } else {
        const serialized = typeof v === 'object' ? JSON.stringify(v) : String(v);
        form.append(wk, serialized);
        previewObj[wk] = v;
      }
    }
    if (op.extraBody) {
      for (const [k, v] of Object.entries(op.extraBody)) {
        form.append(k, String(v));
        previewObj[k] = v;
      }
    }
    body = form;
    bodyPreview = previewObj;
  } else {
    const jsonBody = {};
    for (const [k, v] of Object.entries(clean)) {
      if (usedKeys.has(k)) continue;
      const f = fieldsByName.get(k) || { name: k };
      if (f.in === 'query') {
        query.set(wireKeyFor(f, provider.wireCase), typeof v === 'object' ? JSON.stringify(v) : String(v));
        continue;
      }
      if (f.in === 'header') {
        headers[wireKeyFor(f, provider.wireCase)] = String(v);
        continue;
      }
      if (f.in === 'bodyRoot' && v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(jsonBody, v);
        continue;
      }
      const wk = wireKeyFor(f, provider.wireCase);
      jsonBody[wk] = v;
    }
    if (op.extraBody) {
      Object.assign(jsonBody, op.extraBody);
    }
    if (Object.keys(jsonBody).length > 0) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(jsonBody);
      bodyPreview = jsonBody;
    }
  }

  if (op.stream) {
    headers['Accept'] = 'text/event-stream';
  }

  const qs = query.toString();
  const url = `${effectiveBase}${resolvedPath}${qs ? '?' + qs : ''}`;
  const curl = formatCurl({ url, method: op.method, headers, bodyPreview, isMultipart: op.contentType === 'multipart' });

  return { url, method: op.method, headers, body, bodyPreview, curl };
}

function formatCurl({ url, method, headers, bodyPreview, isMultipart }) {
  const parts = [`curl -X ${method} '${url}'`];
  for (const [k, v] of Object.entries(headers)) {
    const masked = /^(authorization|x-api-key|x-goog-api-key)$/i.test(k)
      ? v.replace(/(Bearer\s+)?(.{4}).*(.{2})/, '$1$2…$3')
      : v;
    parts.push(`  -H '${k}: ${masked}'`);
  }
  if (isMultipart && bodyPreview) {
    for (const [k, v] of Object.entries(bodyPreview)) {
      parts.push(`  -F '${k}=${typeof v === 'string' ? v : JSON.stringify(v)}'`);
    }
  } else if (bodyPreview && Object.keys(bodyPreview).length > 0) {
    parts.push(`  -d '${JSON.stringify(bodyPreview, null, 2).replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n');
}

export function extractTextFromChunk(data) {
  if (!data || typeof data !== 'object') return '';
  // OpenAI / Mistral Chat & FIM delta
  const choice = data.choices?.[0];
  if (choice) {
    if (typeof choice.delta?.content === 'string') return choice.delta.content;
    if (Array.isArray(choice.delta?.content)) {
      return choice.delta.content.map((c) => c.text ?? '').join('');
    }
    if (typeof choice.text === 'string') return choice.text;
    if (typeof choice.message?.content === 'string') return choice.message.content;
  }
  // OpenAI Responses stream delta
  if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') {
    return data.delta;
  }
  // Anthropic Messages stream delta
  if (data.type === 'content_block_delta') {
    if (typeof data.delta?.text === 'string') return data.delta.text;
    if (typeof data.delta?.thinking === 'string') return data.delta.thinking;
  }
  // Gemini candidates parts
  const parts = data.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p) => p.text ?? '').join('');
  }
  // Mistral conversations / audio stream
  if (typeof data.content === 'string') return data.content;
  if (typeof data.text === 'string') return data.text;
  return '';
}

export function extractReadableOutput(data) {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);

  // Chat completion response
  const choiceMsg = data.choices?.[0]?.message?.content;
  if (typeof choiceMsg === 'string') return choiceMsg;
  if (Array.isArray(choiceMsg)) {
    return choiceMsg.map((c) => c.text ?? JSON.stringify(c)).join('\n');
  }
  // OpenAI Responses API output
  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.output)) {
    const texts = [];
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === 'string') texts.push(c.text);
        }
      }
    }
    if (texts.length) return texts.join('\n\n');
  }
  // Anthropic message response
  if (Array.isArray(data.content)) {
    const texts = data.content.map((b) => b.text ?? b.thinking ?? '').filter(Boolean);
    if (texts.length) return texts.join('\n\n');
  }
  // Gemini candidate response
  const gemParts = data.candidates?.[0]?.content?.parts;
  if (Array.isArray(gemParts)) {
    const texts = gemParts.map((p) => p.text ?? '').filter(Boolean);
    if (texts.length) return texts.join('');
  }
  // Mistral Conversations outputs
  if (Array.isArray(data.outputs)) {
    const texts = data.outputs.map((o) => o.content ?? '').filter(Boolean);
    if (texts.length) return texts.join('\n\n');
  }
  // OCR markdown pages
  if (Array.isArray(data.pages)) {
    const md = data.pages.map((p, i) => `--- Page ${i + 1} ---\n${p.markdown ?? ''}`).join('\n\n');
    if (md.trim()) return md;
  }
  // Audio transcription text
  if (typeof data.text === 'string') return data.text;

  return JSON.stringify(data, null, 2);
}

async function* parseSseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            yield { data: parsed, textDelta: extractTextFromChunk(parsed) };
          } catch {
            yield { data: payload, textDelta: payload };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function executeOperation(provider, op, rawParams, { apiKey = '', baseUrl = '', signal } = {}) {
  const reqInfo = buildRequest(provider, op, rawParams, { apiKey, baseUrl });
  const t0 = performance.now();

  const response = await fetch(reqInfo.url, {
    method: reqInfo.method,
    headers: reqInfo.headers,
    body: reqInfo.body,
    signal,
  });

  const status = response.status;
  const statusText = response.statusText;
  const resHeaders = Object.fromEntries(response.headers.entries());

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = errText;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      /* keep raw text */
    }
    const elapsedMs = Math.round(performance.now() - t0);
    return {
      ok: false,
      status,
      statusText,
      elapsedMs,
      headers: resHeaders,
      request: reqInfo,
      data: parsedErr,
      extractedText: typeof parsedErr === 'string' ? parsedErr : JSON.stringify(parsedErr, null, 2),
    };
  }

  if (op.stream && response.body) {
    return {
      ok: true,
      status,
      statusText,
      headers: resHeaders,
      request: reqInfo,
      stream: parseSseStream(response),
      t0,
    };
  }

  let data;
  if (op.responseType === 'binary') {
    const buf = await response.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    data = {
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      bytes: bytes.length,
      contentBase64: btoa(bin),
    };
  } else {
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  return {
    ok: true,
    status,
    statusText,
    elapsedMs,
    headers: resHeaders,
    request: reqInfo,
    data,
    extractedText: extractReadableOutput(data),
  };
}

function getByDotPath(obj, pathStr) {
  if (!pathStr || !obj) return obj;
  return pathStr.split('.').reduce((acc, part) => acc?.[part], obj);
}

export async function fetchProviderModels(provider, { apiKey = '', baseUrl = '' } = {}) {
  if (!provider.models?.path) return [];
  const effectiveBase = (baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  const query = new URLSearchParams();
  const headers = { ...(provider.auth?.extraHeaders ?? {}) };
  const authType = provider.auth?.type || 'bearer';
  const applyAuth = AUTH_APPLY[authType] || AUTH_APPLY.bearer;
  applyAuth({ apiKey, auth: provider.auth || {}, headers, query });

  const qs = query.toString();
  const url = `${effectiveBase}${provider.models.path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const json = await res.json();
  const list = Array.isArray(json) ? json : (getByDotPath(json, provider.models.listPath) ?? []);
  if (!Array.isArray(list)) return [];
  const idField = provider.models.idField || 'id';
  const prefix = provider.models.stripPrefix || '';
  return list
    .map((item) => {
      const rawId = typeof item === 'string' ? item : item?.[idField];
      if (typeof rawId !== 'string') return '';
      return prefix && rawId.startsWith(prefix) ? rawId.slice(prefix.length) : rawId;
    })
    .filter(Boolean);
}

export async function fetchModelContextLength(provider, modelId, { apiKey = '', baseUrl = '' } = {}) {
  if (!provider.models?.detailPath || !provider.models?.contextField || !modelId) return null;
  const effectiveBase = (baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  const query = new URLSearchParams();
  const headers = { ...(provider.auth?.extraHeaders ?? {}) };
  const authType = provider.auth?.type || 'bearer';
  const applyAuth = AUTH_APPLY[authType] || AUTH_APPLY.bearer;
  applyAuth({ apiKey, auth: provider.auth || {}, headers, query });

  const path = provider.models.detailPath.replace(/\{[^}]+\}/, encodeURIComponent(modelId));
  const qs = query.toString();
  const url = `${effectiveBase}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const max = data?.[provider.models.contextField];
  return typeof max === 'number' && max > 0 ? max : null;
}
