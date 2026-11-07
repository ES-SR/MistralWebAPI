import { MISTRAL_PROVIDER } from './mistral.js';
import { OPENAI_PROVIDER } from './openai.js';
import { ANTHROPIC_PROVIDER } from './anthropic.js';
import { GEMINI_PROVIDER } from './gemini.js';

export const BUILTIN_PROVIDERS = [
  MISTRAL_PROVIDER,
  OPENAI_PROVIDER,
  ANTHROPIC_PROVIDER,
  GEMINI_PROVIDER,
];

export const BUILTIN_PROVIDER_MAP = Object.fromEntries(
  BUILTIN_PROVIDERS.map((p) => [p.id, p]),
);
