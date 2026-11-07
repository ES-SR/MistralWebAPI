import { op, str, num, json, modelField } from './helpers.js';

const geminiGenerateFields = () => [
  modelField('gemini-2.5-flash', 'Model ID (e.g. gemini-2.5-flash, gemini-2.5-pro). Substituting into {model} path.'),
  json('contents', 'contents', {
    required: true,
    rows: 6,
    default: JSON.stringify([
      {
        role: 'user',
        parts: [{ text: 'Explain the Gemini API in one sentence.' }],
      },
    ], null, 2),
  }),
  json('systemInstruction', 'systemInstruction', {
    rows: 3,
    placeholder: '{ "parts": [{ "text": "You are a helpful assistant." }] }',
  }),
  json('generationConfig', 'generationConfig', {
    rows: 4,
    default: JSON.stringify({ temperature: 0.7, maxOutputTokens: 256 }, null, 2),
  }),
  json('tools', 'tools', { placeholder: '[{ "googleSearch": {} }]' }),
  json('toolConfig', 'toolConfig'),
  json('safetySettings', 'safetySettings'),
];

export const GEMINI_PROVIDER = {
  id: 'gemini',
  name: 'Google Gemini',
  baseUrl: 'https://generativelanguage.googleapis.com',
  wireCase: 'camel',
  auth: {
    type: 'header',
    headerName: 'x-goog-api-key',
  },
  models: {
    path: '/v1beta/models',
    listPath: 'models',
    idField: 'name',
    stripPrefix: 'models/',
    detailPath: '/v1beta/models/{model}',
    contextField: 'inputTokenLimit',
  },
  operations: [
    // ── Generate Content ──────────────────────────────────────────────────
    op('models.generateContent', 'Generate', 'Generate content', 'POST', '/v1beta/models/{model}:generateContent', geminiGenerateFields(), {
      description: 'POST /v1beta/models/{model}:generateContent — non-streaming multimodal generation.',
    }),
    op('models.streamGenerateContent', 'Generate', 'Stream generate content', 'POST', '/v1beta/models/{model}:streamGenerateContent', geminiGenerateFields(), {
      stream: true,
      streamBody: false,
      extraQuery: { alt: 'sse' },
      description: 'POST /v1beta/models/{model}:streamGenerateContent?alt=sse — streams responses over Server-Sent Events.',
    }),
    op('models.countTokens', 'Generate', 'Count tokens', 'POST', '/v1beta/models/{model}:countTokens', [
      modelField('gemini-2.5-flash'),
      json('contents', 'contents', {
        required: true,
        rows: 5,
        default: JSON.stringify([{ role: 'user', parts: [{ text: 'How many tokens is this sentence?' }] }], null, 2),
      }),
    ]),

    // ── Embeddings ────────────────────────────────────────────────────────
    op('models.embedContent', 'Embeddings', 'Embed content', 'POST', '/v1beta/models/{model}:embedContent', [
      modelField('text-embedding-004'),
      json('content', 'content', {
        required: true,
        rows: 4,
        default: JSON.stringify({ parts: [{ text: 'Embeddings represent text as vectors.' }] }, null, 2),
      }),
      str('taskType', 'taskType', { placeholder: 'RETRIEVAL_DOCUMENT | RETRIEVAL_QUERY | SEMANTIC_SIMILARITY | CLASSIFICATION' }),
      str('title', 'title'),
      num('outputDimensionality', 'outputDimensionality'),
    ]),

    // ── Models ────────────────────────────────────────────────────────────
    op('models.list', 'Models', 'List models', 'GET', '/v1beta/models', [
      num('pageSize', 'pageSize', { default: 50 }),
      str('pageToken', 'pageToken'),
    ]),
    op('models.get', 'Models', 'Get model', 'GET', '/v1beta/models/{model}', [
      str('model', 'model', { required: true, default: 'gemini-2.5-flash', isModel: true }),
    ]),
  ],
};
