import { Mistral } from '@mistralai/mistralai';
import { OPERATION_MAP } from '../shared/operations.js';

function cleanParams(raw: any): { params: any; apiKey?: string } {
  const params: any = {};
  let apiKey: string | undefined;
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (k === 'apiKey') {
      if (typeof v === 'string' && v.trim()) apiKey = v.trim();
      continue;
    }
    if (v === undefined || v === null || v === '') continue;
    params[k] = v;
  }
  return { params, apiKey };
}

function fileFromFields(p: Record<string, any>, fallbackName: string) {
  const { fileContent, fileName, ...rest } = p;
  const content = typeof fileContent === 'string' && fileContent.length ? fileContent : '';
  let file: File;
  if (content.startsWith('data:')) {
    const b64 = content.slice(content.indexOf(',') + 1);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    file = new File([bytes], fileName || fallbackName);
  } else {
    file = new File([content], fileName || fallbackName);
  }
  return { rest, file };
}

export async function execute(opId: string, rawParams: any): Promise<{ data?: any; stream?: AsyncIterable<any> }> {
  const op = OPERATION_MAP[opId];
  if (!op) throw new Error(`Unknown operation: ${opId}`);
  const { params: p, apiKey } = cleanParams(rawParams);
  if (!apiKey) throw new Error('No API key. Add your default key in Settings → API (requires acknowledging the security risks first).');
  const c = new Mistral({ apiKey });

  switch (op.id) {
    case 'chat.complete': return { data: await c.chat.complete(p) };
    case 'chat.stream': return { stream: await c.chat.stream({ ...p, stream: true }) };
    case 'embeddings.create': return { data: await c.embeddings.create(p) };

    case 'models.list': return { data: await c.models.list() };
    case 'models.retrieve': return { data: await c.models.retrieve({ modelId: p.modelId }) };
    case 'models.update': return { data: await c.models.update({ modelId: p.modelId, updateFTModelIn: p.updateFTModelIn ?? {} }) };
    case 'models.delete': return { data: await c.models.delete({ modelId: p.modelId }) };
    case 'models.archive': return { data: await c.models.archive({ modelId: p.modelId }) };
    case 'models.unarchive': return { data: await c.models.unarchive({ modelId: p.modelId }) };

    case 'fim.complete': return { data: await c.fim.complete(p) };
    case 'fim.stream': return { stream: await c.fim.stream({ ...p, stream: true }) };

    case 'classifiers.moderate': return { data: await c.classifiers.moderate(p) };
    case 'classifiers.moderateChat': return { data: await c.classifiers.moderateChat(p) };
    case 'classifiers.classify': return { data: await c.classifiers.classify(p) };
    case 'classifiers.classifyChat': return { data: await c.classifiers.classifyChat(p) };

    case 'ocr.process': return { data: await c.ocr.process(p) };

    case 'files.upload': {
      const { rest, file } = fileFromFields(p, 'upload.txt');
      return { data: await c.files.upload({ ...rest, file }) };
    }
    case 'files.list': return { data: await c.files.list(p) };
    case 'files.retrieve': return { data: await c.files.retrieve({ fileId: p.fileId }) };
    case 'files.delete': return { data: await c.files.delete({ fileId: p.fileId }) };
    case 'files.download': {
      const s = await c.files.download({ fileId: p.fileId });
      const buf = await new Response(s as any).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return { data: { fileId: p.fileId, bytes: bytes.length, contentBase64: btoa(bin) } };
    }
    case 'files.getSignedUrl': return { data: await c.files.getSignedUrl(p) };

    case 'fineTuning.jobs.create': return { data: await c.fineTuning.jobs.create(p) };
    case 'fineTuning.jobs.list': return { data: await c.fineTuning.jobs.list(p) };
    case 'fineTuning.jobs.get': return { data: await c.fineTuning.jobs.get({ jobId: p.jobId }) };
    case 'fineTuning.jobs.start': return { data: await c.fineTuning.jobs.start({ jobId: p.jobId }) };
    case 'fineTuning.jobs.cancel': return { data: await c.fineTuning.jobs.cancel({ jobId: p.jobId }) };

    case 'batch.jobs.create': return { data: await c.batch.jobs.create(p) };
    case 'batch.jobs.list': return { data: await c.batch.jobs.list(p) };
    case 'batch.jobs.get': return { data: await c.batch.jobs.get({ jobId: p.jobId }) };
    case 'batch.jobs.cancel': return { data: await c.batch.jobs.cancel({ jobId: p.jobId }) };

    case 'agents.complete': return { data: await c.agents.complete(p) };
    case 'agents.stream': return { stream: await c.agents.stream({ ...p, stream: true }) };

    case 'beta.agents.create': return { data: await c.beta.agents.create(p) };
    case 'beta.agents.list': return { data: await c.beta.agents.list(p) };
    case 'beta.agents.get': return { data: await c.beta.agents.get({ agentId: p.agentId }) };
    case 'beta.agents.update': {
      const { agentId, agentUpdateRequest, ...rest } = p;
      return { data: await c.beta.agents.update({ agentId, agentUpdateRequest: { ...(agentUpdateRequest ?? {}), ...rest } }) };
    }
    case 'beta.agents.delete': return { data: await c.beta.agents.delete({ agentId: p.agentId }) };
    case 'beta.agents.listVersions': return { data: await c.beta.agents.listVersions({ agentId: p.agentId }) };
    case 'beta.agents.getVersion': return { data: await c.beta.agents.getVersion({ agentId: p.agentId, version: p.version }) };
    case 'beta.agents.updateVersion': return { data: await c.beta.agents.updateVersion({ agentId: p.agentId, version: p.version }) };
    case 'beta.agents.createVersionAlias': return { data: await c.beta.agents.createVersionAlias({ agentId: p.agentId, alias: p.alias, version: p.version }) };
    case 'beta.agents.listVersionAliases': return { data: await c.beta.agents.listVersionAliases({ agentId: p.agentId }) };
    case 'beta.agents.deleteVersionAlias': return { data: await c.beta.agents.deleteVersionAlias({ agentId: p.agentId, alias: p.alias }) };

    case 'conversations.start': return { data: await c.beta.conversations.start(p) };
    case 'conversations.startStream': return { stream: await c.beta.conversations.startStream({ ...p, stream: true }) };
    case 'conversations.append': {
      const { conversationId, ...body } = p;
      return { data: await c.beta.conversations.append({ conversationId, conversationAppendRequest: body }) };
    }
    case 'conversations.appendStream': {
      const { conversationId, ...body } = p;
      return { stream: await c.beta.conversations.appendStream({ conversationId, conversationAppendStreamRequest: body }) };
    }
    case 'conversations.restart': {
      const { conversationId, ...body } = p;
      return { data: await c.beta.conversations.restart({ conversationId, conversationRestartRequest: body }) };
    }
    case 'conversations.restartStream': {
      const { conversationId, ...body } = p;
      return { stream: await c.beta.conversations.restartStream({ conversationId, conversationRestartStreamRequest: body }) };
    }
    case 'conversations.list': return { data: await c.beta.conversations.list(p) };
    case 'conversations.get': return { data: await c.beta.conversations.get({ conversationId: p.conversationId }) };
    case 'conversations.getHistory': return { data: await c.beta.conversations.getHistory({ conversationId: p.conversationId }) };
    case 'conversations.getMessages': return { data: await c.beta.conversations.getMessages({ conversationId: p.conversationId }) };
    case 'conversations.delete': return { data: await c.beta.conversations.delete({ conversationId: p.conversationId }) };

    case 'libraries.list': return { data: await c.beta.libraries.list() };
    case 'libraries.create': return { data: await c.beta.libraries.create(p) };
    case 'libraries.get': return { data: await c.beta.libraries.get({ libraryId: p.libraryId }) };
    case 'libraries.update': {
      const { libraryId, libraryInUpdate } = p;
      return { data: await c.beta.libraries.update({ libraryId, libraryInUpdate: libraryInUpdate ?? {} }) };
    }
    case 'libraries.delete': return { data: await c.beta.libraries.delete({ libraryId: p.libraryId }) };
    case 'libraries.documents.list': return { data: await c.beta.libraries.documents.list(p) };
    case 'libraries.documents.upload': {
      const { libraryId, ...rest } = p;
      const { file } = fileFromFields(rest, 'document.pdf');
      return { data: await c.beta.libraries.documents.upload({ libraryId, requestBody: { file } }) };
    }
    case 'libraries.documents.get': return { data: await c.beta.libraries.documents.get({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.update': {
      const { libraryId, documentId, documentUpdateIn } = p;
      return { data: await c.beta.libraries.documents.update({ libraryId, documentId, documentUpdateIn: documentUpdateIn ?? {} }) };
    }
    case 'libraries.documents.delete': return { data: await c.beta.libraries.documents.delete({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.textContent': return { data: await c.beta.libraries.documents.textContent({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.status': return { data: await c.beta.libraries.documents.status({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.getSignedUrl': return { data: await c.beta.libraries.documents.getSignedUrl({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.extractedTextSignedUrl': return { data: await c.beta.libraries.documents.extractedTextSignedUrl({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.documents.reprocess': return { data: await c.beta.libraries.documents.reprocess({ libraryId: p.libraryId, documentId: p.documentId }) };
    case 'libraries.accesses.list': return { data: await c.beta.libraries.accesses.list({ libraryId: p.libraryId }) };
    case 'libraries.accesses.updateOrCreate': {
      const { libraryId, sharingIn } = p;
      return { data: await c.beta.libraries.accesses.updateOrCreate({ libraryId, sharingIn: sharingIn ?? {} }) };
    }
    case 'libraries.accesses.delete': {
      const { libraryId, sharingDelete } = p;
      return { data: await c.beta.libraries.accesses.delete({ libraryId, sharingDelete: sharingDelete ?? {} }) };
    }

    case 'connectors.create': return { data: await c.beta.connectors.create(p) };
    case 'connectors.list': return { data: await c.beta.connectors.list(p) };
    case 'connectors.get': return { data: await c.beta.connectors.get({ connectorIdOrName: p.connectorIdOrName }) };
    case 'connectors.update': {
      const { connectorId, connectorMCPUpdate } = p;
      return { data: await c.beta.connectors.update({ connectorId, connectorMCPUpdate: connectorMCPUpdate ?? {} }) };
    }
    case 'connectors.delete': return { data: await c.beta.connectors.delete({ connectorId: p.connectorId }) };
    case 'connectors.callTool': {
      const { connectorId, toolName, arguments: args } = p;
      return { data: await c.beta.connectors.callTool({ connectorIdOrName: connectorId, toolName, mcpToolCallRequest: { arguments: args ?? {} } }) };
    }

    case 'audio.transcriptions.complete': {
      const { rest, file } = fileFromFields(p, 'audio.wav');
      if (p.fileContent) rest.file = file;
      const req: any = { ...rest, stream: false as const };
      return { data: await c.audio.transcriptions.complete(req) };
    }
    case 'audio.transcriptions.stream': {
      const { rest, file } = fileFromFields(p, 'audio.wav');
      if (p.fileContent) rest.file = file;
      const req: any = { ...rest, stream: true };
      return { stream: await c.audio.transcriptions.stream(req) };
    }

    default:
      throw new Error(`Unhandled operation: ${op.id}`);
  }
}

export async function listModelIds(apiKey: string): Promise<string[]> {
  const c = new Mistral({ apiKey });
  const models = await c.models.list();
  return ((models as any)?.data ?? []).map((m: any) => m.id).filter(Boolean);
}
