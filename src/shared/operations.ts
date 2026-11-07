import type { Field, Operation } from './types.js';

const API_KEY_FIELD: Field = {
  name: 'apiKey',
  label: 'API key override (secret)',
  type: 'secret',
  hint: 'Disabled and hidden by default — enable in Settings → API. The server uses its own MISTRAL_API_KEY unless an override is entered here.',
};

function op(
  id: string,
  group: string,
  label: string,
  method: string,
  path: string,
  fields: Field[],
  opts: { stream?: boolean; description?: string } = {},
): Operation {
  return { id, group, label, method, path, stream: opts.stream, description: opts.description, fields: [...fields, API_KEY_FIELD] };
}

const str = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'string', ...o });
const txt = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'text', rows: 4, ...o });
const num = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'number', ...o });
const bool = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'boolean', ...o });
const json = (name: string, label: string, o: Partial<Field> = {}): Field => ({ name, label, type: 'json', rows: 5, ...o });
const sel = (name: string, label: string, options: string[], o: Partial<Field> = {}): Field => ({ name, label, type: 'select', options, ...o });

const modelField = (d = 'mistral-small-latest'): Field => str('model', 'model', { required: true, default: d, hint: 'Overridden by Settings → API → default model.' });
const messagesField = (): Field =>
  json('messages', 'messages', {
    required: true,
    rows: 6,
    default: JSON.stringify([{ role: 'user', content: 'Explain the Mistral API in one sentence.' }], null, 2),
  });
const agentIdField = (): Field => str('agentId', 'agentId', { required: true, default: 'agt_…', placeholder: 'agent id, e.g. agt_01…' });
const fileIdField = (): Field => str('fileId', 'fileId', { required: true, default: 'file-…', placeholder: 'file id' });
const jobIdField = (): Field => str('jobId', 'jobId', { required: true, default: 'ftjob-…', placeholder: 'job id' });
const libraryIdField = (): Field => str('libraryId', 'libraryId', { required: true, default: 'lib_…', placeholder: 'library id' });
const conversationIdField = (): Field => str('conversationId', 'conversationId', { required: true, default: 'conv_…', placeholder: 'conversation id' });

const chatFields = (): Field[] => [
  modelField(),
  messagesField(),
  num('temperature', 'temperature', { default: 0.7 }),
  num('topP', 'topP'),
  num('maxTokens', 'maxTokens', { default: 256 }),
  str('stop', 'stop', { placeholder: 'string or array of stop sequences (JSON for array)' }),
  num('randomSeed', 'randomSeed'),
  json('responseFormat', 'responseFormat', { placeholder: '{ "type": "json_object" }' }),
  json('tools', 'tools', { placeholder: '[{ "type": "function", "function": { … } }]' }),
  json('toolChoice', 'toolChoice', { placeholder: '"auto" | "none" | "any" | { … }' }),
  num('presencePenalty', 'presencePenalty'),
  num('frequencyPenalty', 'frequencyPenalty'),
  num('n', 'n'),
  bool('parallelToolCalls', 'parallelToolCalls'),
  json('prediction', 'prediction'),
  json('metadata', 'metadata'),
];

const agentCompletionFields = (): Field[] => [
  agentIdField(),
  messagesField(),
  num('maxTokens', 'maxTokens', { default: 256 }),
  str('stop', 'stop'),
  num('randomSeed', 'randomSeed'),
  json('responseFormat', 'responseFormat'),
  json('tools', 'tools'),
  json('toolChoice', 'toolChoice'),
  num('presencePenalty', 'presencePenalty'),
  num('frequencyPenalty', 'frequencyPenalty'),
  num('n', 'n'),
  bool('parallelToolCalls', 'parallelToolCalls'),
  json('prediction', 'prediction'),
  json('metadata', 'metadata'),
];

const fimFields = (): Field[] => [
  str('model', 'model', { required: true, default: 'codestral-latest' }),
  txt('prompt', 'prompt', { required: true, rows: 6, default: 'def fibonacci(n: int) -> int:\n    """Return the n-th Fibonacci number."""\n' }),
  txt('suffix', 'suffix', { rows: 3, placeholder: 'code that follows the cursor' }),
  num('temperature', 'temperature', { default: 0.2 }),
  num('topP', 'topP'),
  num('maxTokens', 'maxTokens', { default: 128 }),
  num('minTokens', 'minTokens'),
  str('stop', 'stop'),
  num('randomSeed', 'randomSeed'),
];

const fileContentFields = (): Field[] => [
  str('fileName', 'fileName', { default: 'sample.jsonl' }),
  txt('fileContent', 'fileContent (sent as the uploaded file)', {
    required: true,
    rows: 8,
    default: '{"messages": [{"role": "user", "content": "Hello"}]}\n',
  }),
];

export const OPERATIONS: Operation[] = [
  // ── Chat ──────────────────────────────────────────────────────────────
  op('chat.complete', 'Chat', 'Chat completion', 'POST', '/v1/chat/completions', chatFields(), {
    description: 'client.chat.complete(params) — non-streaming chat completion.',
  }),
  op('chat.stream', 'Chat', 'Chat completion (stream)', 'POST', '/v1/chat/completions', chatFields(), {
    stream: true,
    description: 'client.chat.stream(params) — streams chunks as SSE.',
  }),

  // ── Embeddings ────────────────────────────────────────────────────────
  op('embeddings.create', 'Embeddings', 'Create embeddings', 'POST', '/v1/embeddings', [
    str('model', 'model', { required: true, default: 'mistral-embed' }),
    json('inputs', 'inputs (string or array of strings)', {
      required: true,
      default: JSON.stringify(['Mistral AI builds frontier models.', 'Embeddings map text to vectors.'], null, 2),
    }),
    num('outputDimension', 'outputDimension'),
    sel('outputDtype', 'outputDtype', ['float', 'int8', 'uint8', 'binary', 'ubinary']),
    sel('encodingFormat', 'encodingFormat', ['float', 'base64']),
  ]),

  // ── Models ────────────────────────────────────────────────────────────
  op('models.list', 'Models', 'List models', 'GET', '/v1/models', []),
  op('models.retrieve', 'Models', 'Retrieve model', 'GET', '/v1/models/{model_id}', [
    str('modelId', 'modelId', { required: true, default: 'mistral-large-latest' }),
  ]),
  op('models.update', 'Models', 'Update fine-tuned model', 'PATCH', '/v1/models/{model_id}', [
    str('modelId', 'modelId', { required: true, default: 'ft:open-mistral-7b:…' }),
    json('updateFTModelIn', 'updateFTModelIn', { default: JSON.stringify({ name: 'my-model-v2', description: 'Updated via playground' }, null, 2) }),
  ]),
  op('models.delete', 'Models', 'Delete fine-tuned model', 'DELETE', '/v1/models/{model_id}', [
    str('modelId', 'modelId', { required: true, default: 'ft:open-mistral-7b:…' }),
  ]),
  op('models.archive', 'Models', 'Archive fine-tuned model', 'POST', '/v1/models/{model_id}/archive', [
    str('modelId', 'modelId', { required: true, default: 'ft:open-mistral-7b:…' }),
  ]),
  op('models.unarchive', 'Models', 'Unarchive fine-tuned model', 'POST', '/v1/models/{model_id}/unarchive', [
    str('modelId', 'modelId', { required: true, default: 'ft:open-mistral-7b:…' }),
  ]),

  // ── FIM ───────────────────────────────────────────────────────────────
  op('fim.complete', 'FIM', 'FIM completion', 'POST', '/v1/fim/completions', fimFields()),
  op('fim.stream', 'FIM', 'FIM completion (stream)', 'POST', '/v1/fim/completions', fimFields(), { stream: true }),

  // ── Moderation & classification ───────────────────────────────────────
  op('classifiers.moderate', 'Moderation & classification', 'Moderate text', 'POST', '/v1/moderations', [
    str('model', 'model', { default: 'mistral-moderation-latest' }),
    json('inputs', 'inputs (string or array of strings)', { required: true, default: JSON.stringify(['Hello, how are you?', 'I hate you.'], null, 2) }),
  ]),
  op('classifiers.moderateChat', 'Moderation & classification', 'Moderate chat messages', 'POST', '/v1/chat/moderations', [
    str('model', 'model', { default: 'mistral-moderation-latest' }),
    json('inputs', 'inputs (array of chat messages)', { required: true, default: JSON.stringify([{ role: 'user', content: 'Hello!' }], null, 2) }),
  ]),
  op('classifiers.classify', 'Moderation & classification', 'Classify text', 'POST', '/v1/classifications', [
    str('model', 'model', { required: true, default: 'ft:…:classifier:…' }),
    json('inputs', 'inputs (string or array of strings)', { required: true, default: '"The product works great!"' }),
  ]),
  op('classifiers.classifyChat', 'Moderation & classification', 'Classify chat messages', 'POST', '/v1/classifiers/chat/completions', [
    str('model', 'model', { required: true, default: 'ft:…:classifier:…' }),
    json('inputs', 'inputs (array of chat messages)', { required: true, default: JSON.stringify([{ role: 'user', content: 'The product works great!' }], null, 2) }),
  ]),

  // ── OCR ───────────────────────────────────────────────────────────────
  op('ocr.process', 'OCR', 'Process document (OCR)', 'POST', '/v1/ocr', [
    str('model', 'model', { required: true, default: 'mistral-ocr-latest' }),
    json('document', 'document (FileChunk | DocumentURLChunk | ImageURLChunk)', {
      required: true,
      rows: 4,
      default: JSON.stringify({ type: 'document_url', documentUrl: 'https://arxiv.org/pdf/1706.03762.pdf', documentName: 'attention.pdf' }, null, 2),
    }),
    json('pages', 'pages (array of page numbers, 0-based)', { default: '[0]' }),
    bool('includeImageBase64', 'includeImageBase64'),
    num('imageLimit', 'imageLimit'),
    num('imageMinSize', 'imageMinSize'),
    json('bboxAnnotationFormat', 'bboxAnnotationFormat'),
    json('documentAnnotationFormat', 'documentAnnotationFormat'),
    str('documentAnnotationPrompt', 'documentAnnotationPrompt'),
    str('id', 'id'),
  ]),

  // ── Files ─────────────────────────────────────────────────────────────
  op('files.upload', 'Files', 'Upload file', 'POST', '/v1/files (multipart)', [
    ...fileContentFields(),
    sel('purpose', 'purpose', ['fine-tune', 'batch', 'ocr', 'vision', 'assistants'], { default: 'fine-tune' }),
    sel('visibility', 'visibility', ['workspace', 'user']),
    num('expiry', 'expiry (seconds until signed URL expiry)'),
  ]),
  op('files.list', 'Files', 'List files', 'GET', '/v1/files', [
    sel('purpose', 'purpose', ['', 'fine-tune', 'batch', 'ocr', 'vision', 'assistants']),
    str('search', 'search'),
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    bool('includeTotal', 'includeTotal'),
  ]),
  op('files.retrieve', 'Files', 'Retrieve file metadata', 'GET', '/v1/files/{file_id}', [fileIdField()]),
  op('files.delete', 'Files', 'Delete file', 'DELETE', '/v1/files/{file_id}', [fileIdField()]),
  op('files.download', 'Files', 'Download file content', 'GET', '/v1/files/{file_id}/content', [fileIdField()], {
    description: 'Returns the file content base64-encoded in the JSON response.',
  }),
  op('files.getSignedUrl', 'Files', 'Get signed URL', 'GET', '/v1/files/{file_id}/signed-url', [
    fileIdField(),
    num('expiry', 'expiry (seconds)'),
  ]),

  // ── Fine-tuning ───────────────────────────────────────────────────────
  op('fineTuning.jobs.create', 'Fine-tuning', 'Create fine-tuning job', 'POST', '/v1/fine_tuning/jobs', [
    str('model', 'model', { required: true, default: 'open-mistral-7b' }),
    json('trainingFiles', 'trainingFiles', { required: true, default: JSON.stringify([{ fileId: 'file-…', weight: 1 }], null, 2) }),
    json('validationFiles', 'validationFiles (array of file ids)'),
    json('hyperparameters', 'hyperparameters', { required: true, default: JSON.stringify({ trainingSteps: 100, learningRate: 0.0001 }, null, 2) }),
    str('suffix', 'suffix'),
    bool('autoStart', 'autoStart', { default: true }),
    json('integrations', 'integrations (e.g. Weights & Biases)'),
    json('repositories', 'repositories (GitHub)'),
  ]),
  op('fineTuning.jobs.list', 'Fine-tuning', 'List fine-tuning jobs', 'GET', '/v1/fine_tuning/jobs', [
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    str('model', 'model'),
    str('status', 'status'),
    str('suffix', 'suffix'),
    bool('createdByMe', 'createdByMe'),
  ]),
  op('fineTuning.jobs.get', 'Fine-tuning', 'Get fine-tuning job', 'GET', '/v1/fine_tuning/jobs/{job_id}', [jobIdField()]),
  op('fineTuning.jobs.start', 'Fine-tuning', 'Start fine-tuning job', 'POST', '/v1/fine_tuning/jobs/{job_id}/start', [jobIdField()]),
  op('fineTuning.jobs.cancel', 'Fine-tuning', 'Cancel fine-tuning job', 'POST', '/v1/fine_tuning/jobs/{job_id}/cancel', [jobIdField()]),

  // ── Batch ─────────────────────────────────────────────────────────────
  op('batch.jobs.create', 'Batch', 'Create batch job', 'POST', '/v1/batch/jobs', [
    sel('endpoint', 'endpoint', [
      '/v1/chat/completions',
      '/v1/embeddings',
      '/v1/fim/completions',
      '/v1/moderations',
      '/v1/chat/moderations',
      '/v1/classifications',
      '/v1/ocr',
    ], { required: true, default: '/v1/chat/completions' }),
    json('inputFiles', 'inputFiles (array of file ids)', { required: true, default: '["file-…"]' }),
    str('model', 'model'),
    str('agentId', 'agentId'),
    json('requests', 'requests (inline requests instead of inputFiles)'),
    json('metadata', 'metadata'),
    num('timeoutHours', 'timeoutHours', { default: 24 }),
  ]),
  op('batch.jobs.list', 'Batch', 'List batch jobs', 'GET', '/v1/batch/jobs', [
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    str('model', 'model'),
    str('agentId', 'agentId'),
    str('status', 'status'),
  ]),
  op('batch.jobs.get', 'Batch', 'Get batch job', 'GET', '/v1/batch/jobs/{job_id}', [jobIdField()]),
  op('batch.jobs.cancel', 'Batch', 'Cancel batch job', 'POST', '/v1/batch/jobs/{job_id}/cancel', [jobIdField()]),

  // ── Agents: completions ───────────────────────────────────────────────
  op('agents.complete', 'Agents', 'Agent completion', 'POST', '/v1/agents/completions', agentCompletionFields()),
  op('agents.stream', 'Agents', 'Agent completion (stream)', 'POST', '/v1/agents/completions', agentCompletionFields(), { stream: true }),

  // ── Agents: management ────────────────────────────────────────────────
  op('beta.agents.create', 'Agents', 'Create agent', 'POST', '/v1/agents', [
    modelField('mistral-large-latest'),
    str('name', 'name', { required: true, default: 'my-agent' }),
    str('description', 'description'),
    txt('instructions', 'instructions', { rows: 4, default: 'You are a helpful assistant.' }),
    json('tools', 'tools', { default: JSON.stringify([{ type: 'web_search' }], null, 2) }),
    json('completionArgs', 'completionArgs'),
    json('guardrails', 'guardrails'),
    json('handoffs', 'handoffs (array of agent ids)'),
    json('metadata', 'metadata'),
  ]),
  op('beta.agents.list', 'Agents', 'List agents', 'GET', '/v1/agents', [
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    str('name', 'name'),
    str('search', 'search'),
    bool('deploymentChat', 'deploymentChat'),
  ]),
  op('beta.agents.get', 'Agents', 'Get agent', 'GET', '/v1/agents/{agent_id}', [agentIdField()]),
  op('beta.agents.update', 'Agents', 'Update agent', 'PATCH', '/v1/agents/{agent_id}', [
    agentIdField(),
    json('agentUpdateRequest', 'agentUpdateRequest', { required: true, default: JSON.stringify({ name: 'renamed-agent' }, null, 2) }),
  ]),
  op('beta.agents.delete', 'Agents', 'Delete agent', 'DELETE', '/v1/agents/{agent_id}', [agentIdField()]),
  op('beta.agents.listVersions', 'Agents', 'List agent versions', 'GET', '/v1/agents/{agent_id}/versions', [agentIdField()]),
  op('beta.agents.getVersion', 'Agents', 'Get agent version', 'GET', '/v1/agents/{agent_id}/versions/{version}', [
    agentIdField(),
    num('version', 'version', { required: true, default: 1 }),
  ]),
  op('beta.agents.updateVersion', 'Agents', 'Update agent version', 'PATCH', '/v1/agents/{agent_id}/versions/{version}', [
    agentIdField(),
    num('version', 'version', { required: true, default: 1 }),
  ]),
  op('beta.agents.createVersionAlias', 'Agents', 'Create version alias', 'POST', '/v1/agents/{agent_id}/aliases', [
    agentIdField(),
    num('version', 'version', { required: true, default: 1 }),
    str('alias', 'alias', { required: true, default: 'latest' }),
  ]),
  op('beta.agents.listVersionAliases', 'Agents', 'List version aliases', 'GET', '/v1/agents/{agent_id}/aliases', [agentIdField()]),
  op('beta.agents.deleteVersionAlias', 'Agents', 'Delete version alias', 'DELETE', '/v1/agents/{agent_id}/aliases/{alias}', [
    agentIdField(),
    str('alias', 'alias', { required: true, default: 'latest' }),
  ]),

  // ── Conversations ─────────────────────────────────────────────────────
  op('conversations.start', 'Conversations', 'Start conversation', 'POST', '/v1/conversations', [
    str('agentId', 'agentId (optional)', { placeholder: 'defaults to the workspace agent' }),
    json('inputs', 'inputs (string or array of input entries)', { required: true, default: '"Hello, what can you do?"' }),
    bool('store', 'store', { default: true }),
    str('name', 'name'),
    str('description', 'description'),
    txt('instructions', 'instructions'),
    json('tools', 'tools'),
    json('metadata', 'metadata'),
    json('handoffExecution', 'handoffExecution'),
  ]),
  op('conversations.startStream', 'Conversations', 'Start conversation (stream)', 'POST', '/v1/conversations', [
    str('agentId', 'agentId (optional)'),
    json('inputs', 'inputs (string or array of input entries)', { required: true, default: '"Hello, what can you do?"' }),
    bool('store', 'store', { default: true }),
    str('name', 'name'),
    str('description', 'description'),
    txt('instructions', 'instructions'),
    json('tools', 'tools'),
    json('metadata', 'metadata'),
    json('handoffExecution', 'handoffExecution'),
  ], { stream: true }),
  op('conversations.append', 'Conversations', 'Append to conversation', 'POST', '/v1/conversations/{conversation_id}/append', [
    conversationIdField(),
    json('inputs', 'inputs (string or array of input entries)', { required: true, default: '"Tell me more."' }),
  ]),
  op('conversations.appendStream', 'Conversations', 'Append to conversation (stream)', 'POST', '/v1/conversations/{conversation_id}/append', [
    conversationIdField(),
    json('inputs', 'inputs (string or array of input entries)', { required: true, default: '"Tell me more."' }),
  ], { stream: true }),
  op('conversations.restart', 'Conversations', 'Restart conversation', 'POST', '/v1/conversations/{conversation_id}/restart', [
    conversationIdField(),
    str('fromEntryId', 'fromEntryId', { required: true, default: 'entry_…', placeholder: 'entry id to restart from' }),
    json('inputs', 'inputs (optional)', {}),
  ]),
  op('conversations.restartStream', 'Conversations', 'Restart conversation (stream)', 'POST', '/v1/conversations/{conversation_id}/restart', [
    conversationIdField(),
    str('fromEntryId', 'fromEntryId', { required: true, default: 'entry_…', placeholder: 'entry id to restart from' }),
    json('inputs', 'inputs (optional)'),
  ], { stream: true }),
  op('conversations.list', 'Conversations', 'List conversations', 'GET', '/v1/conversations', [
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    json('metadata', 'metadata (filters)'),
  ]),
  op('conversations.get', 'Conversations', 'Get conversation', 'GET', '/v1/conversations/{conversation_id}', [conversationIdField()]),
  op('conversations.getHistory', 'Conversations', 'Get conversation history', 'GET', '/v1/conversations/{conversation_id}/history', [conversationIdField()]),
  op('conversations.getMessages', 'Conversations', 'Get conversation messages', 'GET', '/v1/conversations/{conversation_id}/messages', [conversationIdField()]),
  op('conversations.delete', 'Conversations', 'Delete conversation', 'DELETE', '/v1/conversations/{conversation_id}', [conversationIdField()]),

  // ── Libraries (document library) ──────────────────────────────────────
  op('libraries.list', 'Libraries', 'List libraries', 'GET', '/v1/libraries', []),
  op('libraries.create', 'Libraries', 'Create library', 'POST', '/v1/libraries', [
    str('name', 'name', { required: true, default: 'my-library' }),
    str('description', 'description'),
    num('chunkSize', 'chunkSize'),
  ]),
  op('libraries.get', 'Libraries', 'Get library', 'GET', '/v1/libraries/{library_id}', [libraryIdField()]),
  op('libraries.update', 'Libraries', 'Update library', 'PATCH', '/v1/libraries/{library_id}', [
    libraryIdField(),
    json('libraryInUpdate', 'libraryInUpdate', { default: JSON.stringify({ name: 'renamed-library' }, null, 2) }),
  ]),
  op('libraries.delete', 'Libraries', 'Delete library', 'DELETE', '/v1/libraries/{library_id}', [libraryIdField()]),
  op('libraries.documents.list', 'Libraries', 'List documents', 'GET', '/v1/libraries/{library_id}/documents', [
    libraryIdField(),
    str('search', 'search'),
    num('page', 'page', { default: 1 }),
    num('pageSize', 'pageSize', { default: 100 }),
    str('sortBy', 'sortBy'),
    sel('sortOrder', 'sortOrder', ['', 'asc', 'desc']),
  ]),
  op('libraries.documents.upload', 'Libraries', 'Upload document', 'POST', '/v1/libraries/{library_id}/documents (multipart)', [
    libraryIdField(),
    str('fileName', 'fileName', { default: 'document.pdf' }),
    txt('fileContent', 'fileContent (sent as the uploaded file; paste text or a data URL)', { required: true, rows: 8, default: 'data:application/pdf;base64,…' }),
  ]),
  op('libraries.documents.get', 'Libraries', 'Get document', 'GET', '/v1/libraries/{library_id}/documents/{document_id}', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.update', 'Libraries', 'Update document', 'PATCH', '/v1/libraries/{library_id}/documents/{document_id}', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
    json('documentUpdateIn', 'documentUpdateIn', { default: JSON.stringify({ name: 'renamed.pdf' }, null, 2) }),
  ]),
  op('libraries.documents.delete', 'Libraries', 'Delete document', 'DELETE', '/v1/libraries/{library_id}/documents/{document_id}', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.textContent', 'Libraries', 'Get document text content', 'GET', '/v1/libraries/{library_id}/documents/{document_id}/text', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.status', 'Libraries', 'Get document processing status', 'GET', '/v1/libraries/{library_id}/documents/{document_id}/status', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.getSignedUrl', 'Libraries', 'Get document signed URL', 'GET', '/v1/libraries/{library_id}/documents/{document_id}/signed-url', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.extractedTextSignedUrl', 'Libraries', 'Get extracted-text signed URL', 'GET', '/v1/libraries/{library_id}/documents/{document_id}/extracted-text/signed-url', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.documents.reprocess', 'Libraries', 'Reprocess document', 'POST', '/v1/libraries/{library_id}/documents/{document_id}/reprocess', [
    libraryIdField(),
    str('documentId', 'documentId', { required: true, default: 'doc_…' }),
  ]),
  op('libraries.accesses.list', 'Libraries', 'List library shares', 'GET', '/v1/libraries/{library_id}/share', [libraryIdField()]),
  op('libraries.accesses.updateOrCreate', 'Libraries', 'Share library (update or create)', 'POST', '/v1/libraries/{library_id}/share', [
    libraryIdField(),
    json('sharingIn', 'sharingIn', {
      required: true,
      default: JSON.stringify({ level: 'viewer', shareWithType: 'org', shareWithUuid: 'org-uuid-…' }, null, 2),
    }),
  ]),
  op('libraries.accesses.delete', 'Libraries', 'Remove library share', 'DELETE', '/v1/libraries/{library_id}/share', [
    libraryIdField(),
    json('sharingDelete', 'sharingDelete', {
      required: true,
      default: JSON.stringify({ shareWithType: 'org', shareWithUuid: 'org-uuid-…' }, null, 2),
    }),
  ]),

  // ── Connectors (MCP) ──────────────────────────────────────────────────
  op('connectors.create', 'Connectors', 'Create MCP connector', 'POST', '/v1/connectors', [
    str('name', 'name', { required: true, default: 'my-mcp-server' }),
    str('description', 'description', { required: true, default: 'My MCP server' }),
    str('server', 'server (MCP server URL)', { required: true, default: 'https://mcp.example.com/sse' }),
    str('iconUrl', 'iconUrl'),
    sel('visibility', 'visibility', ['private', 'shared_workspace', 'shared_org', 'shared_global'], { default: 'private' }),
    json('headers', 'headers (incl. authData)', { placeholder: '{ "Authorization": "Bearer …" }' }),
  ]),
  op('connectors.list', 'Connectors', 'List connectors', 'GET', '/v1/connectors', [
    num('pageSize', 'pageSize', { default: 100 }),
    str('cursor', 'cursor'),
    json('queryFilters', 'queryFilters'),
  ]),
  op('connectors.get', 'Connectors', 'Get connector', 'GET', '/v1/connectors/{connector_id_or_name}', [
    str('connectorIdOrName', 'connectorIdOrName', { required: true, default: 'conn_…' }),
  ]),
  op('connectors.update', 'Connectors', 'Update connector', 'PATCH', '/v1/connectors/{connector_id}', [
    str('connectorId', 'connectorId', { required: true, default: 'conn_…' }),
    json('connectorMCPUpdate', 'connectorMCPUpdate', { default: JSON.stringify({ name: 'renamed-connector' }, null, 2) }),
  ]),
  op('connectors.delete', 'Connectors', 'Delete connector', 'DELETE', '/v1/connectors/{connector_id}', [
    str('connectorId', 'connectorId', { required: true, default: 'conn_…' }),
  ]),
  op('connectors.callTool', 'Connectors', 'Call connector tool', 'POST', '/v1/connectors/{connector_id}/tools/{tool_name}', [
    str('connectorId', 'connectorIdOrName', { required: true, default: 'conn_…' }),
    str('toolName', 'toolName', { required: true, default: 'search' }),
    json('arguments', 'arguments (tool arguments object)', { default: JSON.stringify({ query: 'Mistral AI' }, null, 2) }),
  ]),

  // ── Audio ─────────────────────────────────────────────────────────────
  op('audio.transcriptions.complete', 'Audio', 'Transcribe audio', 'POST', '/v1/audio/transcriptions', [
    str('model', 'model', { required: true, default: 'voxtral-mini-latest' }),
    str('fileUrl', 'fileUrl (public URL of the audio file)'),
    str('fileId', 'fileId (previously uploaded file)'),
    str('fileName', 'fileName (used when pasting fileContent)'),
    txt('fileContent', 'fileContent (audio bytes as base64 or data URL)', { rows: 4, placeholder: 'data:audio/wav;base64,…' }),
    str('language', 'language', { placeholder: 'e.g. en, fr (auto-detected when empty)' }),
    num('temperature', 'temperature'),
    bool('diarize', 'diarize'),
    json('timestampGranularities', 'timestampGranularities', { placeholder: '["word", "segment"]' }),
    json('contextBias', 'contextBias (array of phrases)'),
  ]),
  op('audio.transcriptions.stream', 'Audio', 'Transcribe audio (stream)', 'POST', '/v1/audio/transcriptions', [
    str('model', 'model', { required: true, default: 'voxtral-mini-latest' }),
    str('fileUrl', 'fileUrl'),
    str('fileId', 'fileId'),
    str('fileName', 'fileName'),
    txt('fileContent', 'fileContent', { rows: 4, placeholder: 'data:audio/wav;base64,…' }),
    str('language', 'language'),
    num('temperature', 'temperature'),
    bool('diarize', 'diarize'),
    json('timestampGranularities', 'timestampGranularities'),
    json('contextBias', 'contextBias'),
  ], { stream: true }),
];

export const OPERATION_MAP: Record<string, Operation> = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));
