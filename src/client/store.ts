import type { AppSettings } from '../shared/types.js';

const PREFS_KEY = 'mistral-playground-prefs-v1';
const KEY_SLOT = 'mistral-playground-key';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  colors: {
    primary: '#ff7000',
    bg: '#0f0f13',
    surface: '#17171d',
    surfaceAlt: '#20202a',
    text: '#ececf1',
    muted: '#9a9aa8',
    border: '#2b2b37',
  },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 15,
  radius: 10,
  defaultModel: '',
  defaultTemperature: '',
  defaultMaxTokens: '0',
  enableSecretFields: false,
  persistKey: false,
};

export function loadPrefs(): AppSettings {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_SETTINGS), ...parsed, colors: { ...DEFAULT_SETTINGS.colors, ...(parsed.colors ?? {}) } };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function savePrefs(s: AppSettings): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(s));
}

function keyStorage(prefs: AppSettings = loadPrefs()): Storage {
  return prefs.persistKey ? localStorage : sessionStorage;
}

export function getKey(): string | null {
  return sessionStorage.getItem(KEY_SLOT) ?? localStorage.getItem(KEY_SLOT);
}

export function hasKey(): boolean {
  return !!getKey();
}

export function setKey(value: string): void {
  const prefs = loadPrefs();
  const target = keyStorage(prefs);
  const other = prefs.persistKey ? sessionStorage : localStorage;
  other.removeItem(KEY_SLOT);
  target.setItem(KEY_SLOT, value);
}

export function clearKey(): void {
  sessionStorage.removeItem(KEY_SLOT);
  localStorage.removeItem(KEY_SLOT);
}

export function migrateKey(persist: boolean): void {
  const v = sessionStorage.getItem(KEY_SLOT) ?? localStorage.getItem(KEY_SLOT);
  clearKey();
  if (v) (persist ? localStorage : sessionStorage).setItem(KEY_SLOT, v);
}
