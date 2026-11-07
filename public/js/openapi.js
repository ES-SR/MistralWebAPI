import { API_KEY_FIELD } from './providers/helpers.js';

function resolveRef(spec, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = spec;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return cur;
}

function deref(spec, node, seen = new Set()) {
  if (!node || typeof node !== 'object') return node;
  if (node.$ref) {
    if (seen.has(node.$ref)) return {};
    seen.add(node.$ref);
    const target = resolveRef(spec, node.$ref);
    return target ? deref(spec, target, seen) : {};
  }
  if (Array.isArray(node.allOf)) {
    const merged = { type: 'object', properties: {}, required: [] };
    for (const sub of node.allOf) {
      const d = deref(spec, sub, new Set(seen));
      if (d?.properties) Object.assign(merged.properties, d.properties);
      if (Array.isArray(d?.required)) merged.required.push(...d.required);
    }
    return { ...node, ...merged };
  }
  if (Array.isArray(node.oneOf) && node.oneOf.length) {
    return deref(spec, node.oneOf[0], seen);
  }
  if (Array.isArray(node.anyOf) && node.anyOf.length) {
    return deref(spec, node.anyOf[0], seen);
  }
  return node;
}

function schemaToField(spec, name, propSchema, { required = false, inLoc = 'body' } = {}) {
  const s = deref(spec, propSchema) || {};
  const hint = s.description || '';
  const def = s.default ?? s.example;

  if (s.format === 'binary') {
    return { name, label: name, type: 'file', in: 'formData', required, hint };
  }
  if (Array.isArray(s.enum) && s.enum.length > 0) {
    return {
      name,
      label: name,
      type: 'select',
      in: inLoc,
      required,
      options: s.enum.map(String),
      default: def !== undefined ? String(def) : undefined,
      hint,
    };
  }
  if (s.type === 'boolean') {
    return { name, label: name, type: 'boolean', in: inLoc, required, default: Boolean(def), hint };
  }
  if (s.type === 'integer' || s.type === 'number') {
    return {
      name,
      label: name,
      type: 'number',
      in: inLoc,
      required,
      default: typeof def === 'number' ? def : undefined,
      min: s.minimum,
      max: s.maximum,
      hint,
    };
  }
  if (s.type === 'object' || s.type === 'array' || s.properties || s.items) {
    return {
      name,
      label: name,
      type: 'json',
      in: inLoc,
      required,
      rows: 5,
      default: def !== undefined ? JSON.stringify(def, null, 2) : undefined,
      hint,
    };
  }
  return {
    name,
    label: name,
    type: 'string',
    in: inLoc,
    required,
    default: def !== undefined ? String(def) : undefined,
    isModel: /^model(_id|Id)?$/i.test(name),
    hint,
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function parseOpenApiSpec(spec, overrides = {}) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('OpenAPI spec must be a JSON object.');
  }
  const title = overrides.name || spec.info?.title || 'Custom OpenAPI';
  const id = overrides.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-api';
  const serverUrl = overrides.baseUrl
    || spec.servers?.[0]?.url
    || (spec.host ? `${spec.schemes?.[0] || 'https'}://${spec.host}${spec.basePath || ''}` : 'https://api.example.com');

  const operations = [];
  const paths = spec.paths || {};

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const method of HTTP_METHODS) {
      const opObj = pathItem[method];
      if (!opObj || typeof opObj !== 'object') continue;

      const group = opObj.tags?.[0] || pathStr.split('/').filter(Boolean)[0] || 'General';
      const opId = opObj.operationId || `${method}.${pathStr.replace(/[^a-zA-Z0-9]+/g, '_')}`;
      const label = opObj.summary || opObj.operationId || `${method.toUpperCase()} ${pathStr}`;
      const description = opObj.description || '';

      const fields = [];
      const seenNames = new Set();
      const allParams = [...pathParams, ...(Array.isArray(opObj.parameters) ? opObj.parameters : [])];

      for (const rawParam of allParams) {
        const p = deref(spec, rawParam);
        if (!p?.name || seenNames.has(p.name)) continue;
        seenNames.add(p.name);
        const inLoc = p.in === 'path' ? 'path' : p.in === 'header' ? 'header' : 'query';
        const pSchema = p.schema || p;
        const field = schemaToField(spec, p.name, pSchema, {
          required: Boolean(p.required || p.in === 'path'),
          inLoc,
        });
        if (p.description && !field.hint) field.hint = p.description;
        fields.push(field);
      }

      let contentType = 'json';
      const reqBody = deref(spec, opObj.requestBody);
      const content = reqBody?.content || {};
      const mediaType = content['application/json']
        ? 'application/json'
        : content['multipart/form-data']
          ? 'multipart/form-data'
          : Object.keys(content)[0];

      if (mediaType === 'multipart/form-data') contentType = 'multipart';

      if (mediaType && content[mediaType]?.schema) {
        const bodySchema = deref(spec, content[mediaType].schema);
        const reqSet = new Set(Array.isArray(bodySchema?.required) ? bodySchema.required : []);
        if (bodySchema?.properties && typeof bodySchema.properties === 'object') {
          for (const [propName, propSchema] of Object.entries(bodySchema.properties)) {
            if (seenNames.has(propName)) continue;
            seenNames.add(propName);
            fields.push(
              schemaToField(spec, propName, propSchema, {
                required: reqSet.has(propName),
                inLoc: contentType === 'multipart' ? 'formData' : 'body',
              }),
            );
          }
        } else if (bodySchema) {
          fields.push({
            name: 'body',
            label: 'Request body (JSON)',
            type: 'json',
            in: 'bodyRoot',
            required: Boolean(reqBody?.required),
            rows: 6,
            default: '{}',
          });
        }
      }

      const sseMedia = Boolean(opObj.responses?.['200']?.content?.['text/event-stream']);
      fields.push(API_KEY_FIELD);

      operations.push({
        id: opId,
        group,
        label,
        method: method.toUpperCase(),
        path: pathStr,
        stream: sseMedia,
        contentType,
        responseType: 'json',
        description,
        fields,
      });
    }
  }

  return {
    id,
    name: title,
    baseUrl: serverUrl,
    wireCase: overrides.wireCase || 'preserve',
    isCustom: true,
    auth: overrides.auth || { type: 'bearer' },
    operations,
  };
}
