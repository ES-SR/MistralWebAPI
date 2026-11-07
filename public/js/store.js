const PREFS_KEY = 'mistral-playground-prefs-v1';
const LEGACY_KEY_SLOT = 'mistral-playground-key';
const KEY_PREFIX = 'webapi-playground-key:';
const CUSTOM_PROVIDERS_KEY = 'webapi-playground-custom-providers-v1';

export const PALETTES = {
  dark: {
    primary: '#ff7000',
    bg: '#0f0f13',
    surface: '#17171d',
    surfaceAlt: '#20202a',
    text: '#ececf1',
    muted: '#9a9aa8',
    border: '#2b2b37',
    ok: '#2fbf71',
    err: '#ff5c5c',
    warn: '#e8b93e',
    info: '#4da3ff',
  },
  light: {
    primary: '#e85d00',
    bg: '#f6f6f8',
    surface: '#ffffff',
    surfaceAlt: '#ececf0',
    text: '#1c1c22',
    muted: '#5d5d6b',
    border: '#d8d8e0',
    ok: '#188038',
    err: '#d93025',
    warn: '#b06000',
    info: '#1a73e8',
  },
};

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  colors: structuredClone(PALETTES.dark),
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 15,
  lineHeight: 1.5,
  radius: 10,
  borderWidth: 1,
  sidebarSide: 'left',
  sidebarWidth: 300,
  sidebarPad: 12,
  responsePosition: 'top',
  responseSplitPct: 48,
  responseMinHeight: 140,
  responseMaxVh: 60,
  actionsPosition: 'top',
  mainPad: 24,
  panelPad: 20,
  panelGap: 20,
  fieldGap: 16,
  labelGap: 5,
  inputPadY: 8,
  inputPadX: 10,
  numFieldWidth: 110,
  selectFieldWidth: 200,
  textFieldBasis: 320,
  activeProviderId: 'mistral',
  defaultModel: '',
  defaultTemperature: '',
  defaultMaxTokens: '0',
  providerConfigs: {},
  enableSecretFields: false,
  persistKey: false,
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      colors: { ...DEFAULT_SETTINGS.colors, ...(parsed.colors ?? {}) },
      providerConfigs: { ...(parsed.providerConfigs ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function savePrefs(s) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(s));
}

export function getProviderConfig(settings, provider) {
  const saved = settings.providerConfigs?.[provider.id] ?? {};
  const isMistral = provider.id === 'mistral';
  return {
    baseUrl: saved.baseUrl || provider.baseUrl || '',
    defaultModel: saved.defaultModel ?? (isMistral ? settings.defaultModel : '') ?? '',
    defaultTemperature: saved.defaultTemperature ?? (isMistral ? settings.defaultTemperature : '') ?? '',
    defaultMaxTokens: saved.defaultMaxTokens ?? (isMistral ? settings.defaultMaxTokens : '0') ?? '0',
  };
}

export function setProviderConfig(settings, providerId, patch) {
  if (!settings.providerConfigs) settings.providerConfigs = {};
  settings.providerConfigs[providerId] = {
    ...(settings.providerConfigs[providerId] ?? {}),
    ...patch,
  };
  if (providerId === 'mistral') {
    if (patch.defaultModel !== undefined) settings.defaultModel = patch.defaultModel;
    if (patch.defaultTemperature !== undefined) settings.defaultTemperature = patch.defaultTemperature;
    if (patch.defaultMaxTokens !== undefined) settings.defaultMaxTokens = patch.defaultMaxTokens;
  }
}

function slotFor(providerId = 'mistral') {
  return `${KEY_PREFIX}${providerId}`;
}

function keyStorage(prefs = loadPrefs()) {
  return prefs.persistKey ? localStorage : sessionStorage;
}

export function getKey(providerId = 'mistral') {
  const slot = slotFor(providerId);
  const direct = sessionStorage.getItem(slot) ?? localStorage.getItem(slot);
  if (direct) return direct;
  if (providerId === 'mistral') {
    return sessionStorage.getItem(LEGACY_KEY_SLOT) ?? localStorage.getItem(LEGACY_KEY_SLOT);
  }
  return null;
}

export function hasKey(providerId = 'mistral') {
  return Boolean(getKey(providerId));
}

export function setKey(value, providerId = 'mistral') {
  const v = value.trim();
  clearKey(providerId);
  if (!v) return;
  const store = keyStorage();
  store.setItem(slotFor(providerId), v);
  if (providerId === 'mistral') {
    store.setItem(LEGACY_KEY_SLOT, v);
  }
}

export function clearKey(providerId = 'mistral') {
  const slot = slotFor(providerId);
  sessionStorage.removeItem(slot);
  localStorage.removeItem(slot);
  if (providerId === 'mistral') {
    sessionStorage.removeItem(LEGACY_KEY_SLOT);
    localStorage.removeItem(LEGACY_KEY_SLOT);
  }
}

export function migrateKey(persist, providerId = 'mistral') {
  const current = getKey(providerId);
  clearKey(providerId);
  if (current) {
    const target = persist ? localStorage : sessionStorage;
    target.setItem(slotFor(providerId), current);
    if (providerId === 'mistral') target.setItem(LEGACY_KEY_SLOT, current);
  }
}

export function loadCustomProviders() {
  try {
    const raw = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomProviders(list) {
  localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(list));
}
