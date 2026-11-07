export const API_KEY_FIELD = {
  name: 'apiKey',
  label: 'API key override (secret)',
  type: 'secret',
  in: 'auth',
  hint: 'Disabled by default — enable in Settings → API & Keys to override the saved provider key for a single request.',
};

export function op(id, group, label, method, path, fields = [], opts = {}) {
  const cleanPath = path.replace(/\s*\(multipart\)\s*$/i, '');
  const isMultipart = opts.contentType === 'multipart' || /\(multipart\)/i.test(path);
  return {
    id,
    group,
    label,
    method: method.toUpperCase(),
    path: cleanPath,
    stream: Boolean(opts.stream),
    contentType: isMultipart ? 'multipart' : (opts.contentType ?? 'json'),
    responseType: opts.responseType ?? 'json',
    extraBody: opts.extraBody ?? (opts.stream && opts.streamBody !== false ? { stream: true } : undefined),
    extraQuery: opts.extraQuery,
    description: opts.description,
    fields: [...fields, API_KEY_FIELD],
  };
}

export const str = (name, label, o = {}) => ({ name, label, type: 'string', ...o });
export const txt = (name, label, o = {}) => ({ name, label, type: 'text', rows: 4, ...o });
export const num = (name, label, o = {}) => ({ name, label, type: 'number', ...o });
export const bool = (name, label, o = {}) => ({ name, label, type: 'boolean', ...o });
export const json = (name, label, o = {}) => ({ name, label, type: 'json', rows: 5, ...o });
export const sel = (name, label, options, o = {}) => ({ name, label, type: 'select', options, ...o });
export const file = (name, label, o = {}) => ({ name, label, type: 'file', in: 'formData', ...o });

export const modelField = (defaultModel = '', hint = 'Select from discovered models or type a model ID. Overridden by Settings → API & Keys → Default model.') =>
  str('model', 'model', { required: true, default: defaultModel, isModel: true, hint });

export const messagesField = (defaultText = 'Explain this API in one sentence.') =>
  json('messages', 'messages', {
    required: true,
    rows: 6,
    default: JSON.stringify([{ role: 'user', content: defaultText }], null, 2),
  });
