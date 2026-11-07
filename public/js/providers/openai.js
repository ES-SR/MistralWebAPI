import { op, str, txt, num, bool, json, sel, file, modelField, messagesField } from './helpers.js';

const chatFields = () => [
  modelField('gpt-4o-mini'),
  messagesField('Explain OpenAI-compatible APIs in one sentence.'),
  num('temperature', 'temperature', { default: 0.7, step: 0.01, min: 0, max: 2 }),
  num('topP', 'topP', { step: 0.01, min: 0, max: 1 }),
  num('maxCompletionTokens', 'maxCompletionTokens', { default: 256, min: 1 }),
  str('stop', 'stop', { placeholder: 'string or JSON array of stop sequences' }),
  num('seed', 'seed'),
  sel('reasoningEffort', 'reasoningEffort', ['', 'low', 'medium', 'high']),
  json('responseFormat', 'responseFormat', { placeholder: '{ "type": "json_object" }' }),
  json('tools', 'tools', { placeholder: '[{ "type": "function", "function": { … } }]' }),
  json('toolChoice', 'toolChoice', { placeholder: '"auto" | "none" | "required" | { … }' }),
  num('presencePenalty', 'presencePenalty', { step: 0.01, min: -2, max: 2 }),
  num('frequencyPenalty', 'frequencyPenalty', { step: 0.01, min: -2, max: 2 }),
  num('n', 'n', { min: 1 }),
  bool('parallelToolCalls', 'parallelToolCalls'),
  bool('store', 'store'),
  json('metadata', 'metadata'),
];

const responsesFields = () => [
  modelField('gpt-4o-mini'),
  json('input', 'input (string or array of input items)', {
    required: true,
    rows: 5,
    default: '"Explain the Responses API in one sentence."',
  }),
  txt('instructions', 'instructions', { rows: 3, placeholder: 'System/developer instructions' }),
  num('temperature', 'temperature', { default: 0.7, step: 0.01, min: 0, max: 2 }),
  num('topP', 'topP', { step: 0.01, min: 0, max: 1 }),
  num('maxOutputTokens', 'maxOutputTokens', { default: 256, min: 1 }),
  str('previousResponseId', 'previousResponseId'),
  json('tools', 'tools', { placeholder: '[{ "type": "web_search_preview" }]' }),
  json('toolChoice', 'toolChoice'),
  json('text', 'text (format config)', { placeholder: '{ "format": { "type": "text" } }' }),
  json('reasoning', 'reasoning', { placeholder: '{ "effort": "medium" }' }),
  bool('store', 'store'),
  json('metadata', 'metadata'),
];

export const OPENAI_PROVIDER = {
  id: 'openai',
  name: 'OpenAI / Compatible',
  baseUrl: 'https://api.openai.com',
  wireCase: 'snake',
  auth: {
    type: 'bearer',
  },
  models: {
    path: '/v1/models',
    listPath: 'data',
    idField: 'id',
    detailPath: '/v1/models/{model}',
    contextField: 'context_window',
  },
  operations: [
    // ── Chat Completions ──────────────────────────────────────────────────
    op('chat.completions', 'Chat', 'Chat completion', 'POST', '/v1/chat/completions', chatFields(), {
      description: 'Standard OpenAI & OpenAI-compatible chat completion endpoint (works with OpenAI, Ollama, vLLM, Groq, OpenRouter, DeepSeek, etc.).',
    }),
    op('chat.completions.stream', 'Chat', 'Chat completion (stream)', 'POST', '/v1/chat/completions', chatFields(), {
      stream: true,
      description: 'Streaming chat completion over Server-Sent Events.',
    }),

    // ── Responses ─────────────────────────────────────────────────────────
    op('responses.create', 'Responses', 'Create response', 'POST', '/v1/responses', responsesFields(), {
      description: 'POST /v1/responses — unified Responses API.',
    }),
    op('responses.stream', 'Responses', 'Create response (stream)', 'POST', '/v1/responses', responsesFields(), {
      stream: true,
      description: 'POST /v1/responses (stream=true) — streaming Responses API.',
    }),
    op('responses.retrieve', 'Responses', 'Get response', 'GET', '/v1/responses/{response_id}', [
      str('responseId', 'responseId', { required: true, default: 'resp_…' }),
    ]),
    op('responses.delete', 'Responses', 'Delete response', 'DELETE', '/v1/responses/{response_id}', [
      str('responseId', 'responseId', { required: true, default: 'resp_…' }),
    ]),

    // ── Embeddings ────────────────────────────────────────────────────────
    op('embeddings.create', 'Embeddings', 'Create embeddings', 'POST', '/v1/embeddings', [
      modelField('text-embedding-3-small'),
      json('input', 'input (string or array of strings)', {
        required: true,
        default: JSON.stringify(['Embeddings map text into vector space.'], null, 2),
      }),
      num('dimensions', 'dimensions'),
      sel('encodingFormat', 'encodingFormat', ['', 'float', 'base64']),
      str('user', 'user'),
    ]),

    // ── Models ────────────────────────────────────────────────────────────
    op('models.list', 'Models', 'List models', 'GET', '/v1/models', []),
    op('models.retrieve', 'Models', 'Retrieve model', 'GET', '/v1/models/{model}', [
      str('model', 'model', { required: true, default: 'gpt-4o-mini', isModel: true }),
    ]),
    op('models.delete', 'Models', 'Delete fine-tuned model', 'DELETE', '/v1/models/{model}', [
      str('model', 'model', { required: true, default: 'ft:gpt-4o-mini:…', isModel: true }),
    ]),

    // ── Images ────────────────────────────────────────────────────────────
    op('images.generate', 'Images', 'Generate image', 'POST', '/v1/images/generations', [
      modelField('gpt-image-1'),
      txt('prompt', 'prompt', { required: true, rows: 3, default: 'A minimalist geometric illustration of a lighthouse at dusk.' }),
      num('n', 'n', { default: 1, min: 1 }),
      sel('size', 'size', ['', '1024x1024', '1536x1024', '1024x1536', 'auto']),
      sel('quality', 'quality', ['', 'auto', 'low', 'medium', 'high', 'standard', 'hd']),
      sel('outputFormat', 'outputFormat', ['', 'png', 'jpeg', 'webp']),
    ]),

    // ── Audio ─────────────────────────────────────────────────────────────
    op('audio.speech', 'Audio', 'Create speech (TTS)', 'POST', '/v1/audio/speech', [
      modelField('gpt-4o-mini-tts'),
      txt('input', 'input (text to synthesize)', { required: true, rows: 3, default: 'Hello from the Web API Playground.' }),
      sel('voice', 'voice', ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'], { required: true, default: 'alloy' }),
      sel('responseFormat', 'responseFormat', ['', 'mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']),
      num('speed', 'speed', { step: 0.05, min: 0.25, max: 4.0 }),
    ], { responseType: 'binary' }),
    op('audio.transcriptions', 'Audio', 'Create transcription', 'POST', '/v1/audio/transcriptions', [
      modelField('gpt-4o-mini-transcribe'),
      file('file', 'file (select audio file)'),
      str('fileName', 'fileName (fallback when using fileContent)', { default: 'audio.wav' }),
      txt('fileContent', 'fileContent (fallback data: URL)', { rows: 3, placeholder: 'data:audio/wav;base64,…' }),
      str('language', 'language', { placeholder: 'ISO-639-1 code, e.g. en' }),
      txt('prompt', 'prompt', { rows: 2 }),
      sel('responseFormat', 'responseFormat', ['', 'json', 'text', 'srt', 'verbose_json', 'vtt']),
      num('temperature', 'temperature', { step: 0.01 }),
    ], { contentType: 'multipart' }),

    // ── Moderations ───────────────────────────────────────────────────────
    op('moderations.create', 'Moderations', 'Create moderation', 'POST', '/v1/moderations', [
      modelField('omni-moderation-latest'),
      json('input', 'input (string or array)', { required: true, default: '"Sample text to check for policy compliance."' }),
    ]),

    // ── Files & Batches ───────────────────────────────────────────────────
    op('files.list', 'Files & Batches', 'List files', 'GET', '/v1/files', [
      sel('purpose', 'purpose', ['', 'assistants', 'batch', 'fine-tune', 'vision', 'user_data', 'evals']),
      num('limit', 'limit', { default: 100 }),
    ]),
    op('files.upload', 'Files & Batches', 'Upload file', 'POST', '/v1/files', [
      file('file', 'file (select file to upload)'),
      str('fileName', 'fileName', { default: 'batch_input.jsonl' }),
      txt('fileContent', 'fileContent (fallback content if no file selected)', {
        rows: 5,
        default: '{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}]}}\n',
      }),
      sel('purpose', 'purpose', ['batch', 'fine-tune', 'assistants', 'vision', 'user_data', 'evals'], { required: true, default: 'batch' }),
    ], { contentType: 'multipart' }),
    op('files.retrieve', 'Files & Batches', 'Retrieve file', 'GET', '/v1/files/{file_id}', [
      str('fileId', 'fileId', { required: true, default: 'file-…' }),
    ]),
    op('files.delete', 'Files & Batches', 'Delete file', 'DELETE', '/v1/files/{file_id}', [
      str('fileId', 'fileId', { required: true, default: 'file-…' }),
    ]),
    op('batches.list', 'Files & Batches', 'List batches', 'GET', '/v1/batches', [
      num('limit', 'limit', { default: 20 }),
      str('after', 'after'),
    ]),
    op('batches.create', 'Files & Batches', 'Create batch', 'POST', '/v1/batches', [
      str('inputFileId', 'inputFileId', { required: true, default: 'file-…' }),
      sel('endpoint', 'endpoint', ['/v1/responses', '/v1/chat/completions', '/v1/embeddings', '/v1/completions'], { required: true, default: '/v1/chat/completions' }),
      sel('completionWindow', 'completionWindow', ['24h'], { required: true, default: '24h' }),
      json('metadata', 'metadata'),
    ]),
  ],
};
