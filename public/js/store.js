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

const SETTINGS_KV_SPEC = [
  ['Theme', 'theme', 'string'],
  ['PrimaryColor', 'colors.primary', 'string'],
  ['BgColor', 'colors.bg', 'string'],
  ['SurfaceColor', 'colors.surface', 'string'],
  ['SurfaceAltColor', 'colors.surfaceAlt', 'string'],
  ['TextColor', 'colors.text', 'string'],
  ['MutedColor', 'colors.muted', 'string'],
  ['BorderColor', 'colors.border', 'string'],
  ['OkColor', 'colors.ok', 'string'],
  ['ErrColor', 'colors.err', 'string'],
  ['WarnColor', 'colors.warn', 'string'],
  ['InfoColor', 'colors.info', 'string'],
  ['FontFamily', 'fontFamily', 'string'],
  ['FontMono', 'fontMono', 'string'],
  ['FontSize', 'fontSize', 'number'],
  ['LineHeight', 'lineHeight', 'number'],
  ['Radius', 'radius', 'number'],
  ['BorderWidth', 'borderWidth', 'number'],
  ['SidebarSide', 'sidebarSide', 'string'],
  ['SidebarWidth', 'sidebarWidth', 'number'],
  ['SidebarPad', 'sidebarPad', 'number'],
  ['ResponsePosition', 'responsePosition', 'string'],
  ['ResponseSplitPct', 'responseSplitPct', 'number'],
  ['ResponseMinHeight', 'responseMinHeight', 'number'],
  ['ResponseMaxVh', 'responseMaxVh', 'number'],
  ['ActionsPosition', 'actionsPosition', 'string'],
  ['MainPad', 'mainPad', 'number'],
  ['PanelPad', 'panelPad', 'number'],
  ['PanelGap', 'panelGap', 'number'],
  ['FieldGap', 'fieldGap', 'number'],
  ['LabelGap', 'labelGap', 'number'],
  ['InputPadY', 'inputPadY', 'number'],
  ['InputPadX', 'inputPadX', 'number'],
  ['NumFieldWidth', 'numFieldWidth', 'number'],
  ['SelectFieldWidth', 'selectFieldWidth', 'number'],
  ['TextFieldBasis', 'textFieldBasis', 'number'],
  ['ActiveProviderId', 'activeProviderId', 'string'],
  ['DefaultModel', 'defaultModel', 'string'],
  ['DefaultTemperature', 'defaultTemperature', 'string'],
  ['DefaultMaxTokens', 'defaultMaxTokens', 'string'],
  ['EnableSecretFields', 'enableSecretFields', 'boolean'],
  ['PersistKey', 'persistKey', 'boolean'],
];

export function serializeSettingsConf(s = loadPrefs()) {
  const lines = ['# Web API Playground Settings (Key = Value)'];
  for (const [confKey, path] of SETTINGS_KV_SPEC) {
    const val = path.startsWith('colors.') ? s.colors?.[path.slice(7)] : s[path];
    if (val !== undefined) lines.push(`${confKey} = ${val}`);
  }
  for (const [provId, cfg] of Object.entries(s.providerConfigs ?? {})) {
    if (cfg.baseUrl) lines.push(`Provider.${provId}.BaseUrl = ${cfg.baseUrl}`);
    if (cfg.defaultModel) lines.push(`Provider.${provId}.DefaultModel = ${cfg.defaultModel}`);
    if (cfg.defaultTemperature !== undefined && cfg.defaultTemperature !== '') {
      lines.push(`Provider.${provId}.DefaultTemperature = ${cfg.defaultTemperature}`);
    }
    if (cfg.defaultMaxTokens !== undefined && cfg.defaultMaxTokens !== '') {
      lines.push(`Provider.${provId}.DefaultMaxTokens = ${cfg.defaultMaxTokens}`);
    }
  }
  return lines.join('\n') + '\n';
}

export function parseSettingsConf(text, base = loadPrefs()) {
  const next = structuredClone(base);
  const specByLower = new Map(SETTINGS_KV_SPEC.map((entry) => [entry[0].toLowerCase(), entry]));

  for (const rawLine of String(text).split(/\r?\n/)) {
    const clean = rawLine.replace(/^\s*#.*$/, '').trim();
    if (!clean) continue;
    const eqIdx = clean.indexOf('=');
    if (eqIdx === -1) continue;
    const rawKey = clean.slice(0, eqIdx).trim();
    const rawVal = clean.slice(eqIdx + 1).trim();

    const provMatch = rawKey.match(/^Provider\.([^.]+)\.(\w+)$/i);
    if (provMatch) {
      const [, provId, field] = provMatch;
      const fl = field.toLowerCase();
      const patch = {};
      if (fl === 'baseurl') patch.baseUrl = rawVal;
      if (fl === 'defaultmodel') patch.defaultModel = rawVal;
      if (fl === 'defaulttemperature') patch.defaultTemperature = rawVal;
      if (fl === 'defaultmaxtokens') patch.defaultMaxTokens = rawVal;
      setProviderConfig(next, provId, patch);
      continue;
    }

    const spec = specByLower.get(rawKey.toLowerCase());
    if (!spec) continue;
    const [, path, type] = spec;
    let parsedVal = rawVal;
    if (type === 'number') {
      const n = Number(rawVal);
      if (Number.isNaN(n)) continue;
      parsedVal = n;
    } else if (type === 'boolean') {
      parsedVal = rawVal === 'true' || rawVal === '1';
    }
    if (path.startsWith('colors.')) {
      next.colors[path.slice(7)] = parsedVal;
    } else {
      next[path] = parsedVal;
    }
  }
  return next;
}
