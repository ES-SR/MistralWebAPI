import { op, str, txt, num, bool, json, sel, modelField, messagesField } from './helpers.js';

const messageCreateFields = () => [
  modelField('claude-sonnet-4-20250514'),
  messagesField('Explain the Anthropic Messages API in one sentence.'),
  num('maxTokens', 'maxTokens', { required: true, default: 1024, min: 1 }),
  txt('system', 'system (system prompt)', { rows: 3, placeholder: 'Optional system instructions' }),
  num('temperature', 'temperature', { default: 1.0, step: 0.01, min: 0, max: 1 }),
  num('topP', 'topP', { step: 0.01, min: 0, max: 1 }),
  num('topK', 'topK', { min: 1 }),
  json('stopSequences', 'stopSequences (array of strings)', { placeholder: '["\\n\\nHuman:"]' }),
  json('thinking', 'thinking', { placeholder: '{ "type": "enabled", "budget_tokens": 1024 }' }),
  json('tools', 'tools', { placeholder: '[{ "name": "get_weather", "description": "…", "input_schema": { "type": "object", "properties": {} } }]' }),
  json('toolChoice', 'toolChoice', { placeholder: '{ "type": "auto" }' }),
  json('metadata', 'metadata', { placeholder: '{ "user_id": "…" }' }),
];

export const ANTHROPIC_PROVIDER = {
  id: 'anthropic',
  name: 'Anthropic',
  baseUrl: 'https://api.anthropic.com',
  wireCase: 'snake',
  auth: {
    type: 'header',
    headerName: 'x-api-key',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  },
  models: {
    path: '/v1/models',
    listPath: 'data',
    idField: 'id',
    detailPath: '/v1/models/{model_id}',
  },
  operations: [
    // ── Messages ──────────────────────────────────────────────────────────
    op('messages.create', 'Messages', 'Create message', 'POST', '/v1/messages', messageCreateFields(), {
      description: 'POST /v1/messages — send a structured list of input messages to Claude.',
    }),
    op('messages.stream', 'Messages', 'Create message (stream)', 'POST', '/v1/messages', messageCreateFields(), {
      stream: true,
      description: 'POST /v1/messages (stream=true) — stream message events over SSE.',
    }),
    op('messages.countTokens', 'Messages', 'Count message tokens', 'POST', '/v1/messages/count_tokens', [
      modelField('claude-sonnet-4-20250514'),
      messagesField('Count the tokens in this message.'),
      txt('system', 'system', { rows: 2 }),
      json('thinking', 'thinking'),
      json('tools', 'tools'),
      json('toolChoice', 'toolChoice'),
    ]),

    // ── Models ────────────────────────────────────────────────────────────
    op('models.list', 'Models', 'List models', 'GET', '/v1/models', [
      num('limit', 'limit', { default: 20 }),
      str('beforeId', 'beforeId'),
      str('afterId', 'afterId'),
    ]),
    op('models.retrieve', 'Models', 'Get model', 'GET', '/v1/models/{model_id}', [
      str('modelId', 'modelId', { required: true, default: 'claude-sonnet-4-20250514', isModel: true }),
    ]),

    // ── Batches ───────────────────────────────────────────────────────────
    op('batches.create', 'Message Batches', 'Create message batch', 'POST', '/v1/messages/batches', [
      json('requests', 'requests', {
        required: true,
        rows: 7,
        default: JSON.stringify([
          {
            custom_id: 'req-1',
            params: {
              model: 'claude-sonnet-4-20250514',
              max_tokens: 256,
              messages: [{ role: 'user', content: 'Hello Claude!' }],
            },
          },
        ], null, 2),
      }),
    ]),
    op('batches.list', 'Message Batches', 'List message batches', 'GET', '/v1/messages/batches', [
      num('limit', 'limit', { default: 20 }),
      str('beforeId', 'beforeId'),
      str('afterId', 'afterId'),
    ]),
    op('batches.retrieve', 'Message Batches', 'Get message batch', 'GET', '/v1/messages/batches/{message_batch_id}', [
      str('messageBatchId', 'messageBatchId', { required: true, default: 'msgbatch_…' }),
    ]),
    op('batches.cancel', 'Message Batches', 'Cancel message batch', 'POST', '/v1/messages/batches/{message_batch_id}/cancel', [
      str('messageBatchId', 'messageBatchId', { required: true, default: 'msgbatch_…' }),
    ]),
  ],
};
