import { BUILTIN_PROVIDERS } from './providers/index.js';
import { buildRequest, executeOperation, fetchProviderModels, fetchModelContextLength } from './executor.js';
import { parseOpenApiSpec } from './openapi.js';
import {
  PALETTES,
  DEFAULT_SETTINGS,
  loadPrefs,
  savePrefs,
  getProviderConfig,
  setProviderConfig,
  getKey,
  hasKey,
  setKey,
  clearKey,
  migrateKey,
  loadCustomProviders,
  saveCustomProviders,
  serializeSettingsConf,
  parseSettingsConf,
} from './store.js';

const FONT_OPTIONS = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  verdana: 'Verdana, Geneva, sans-serif',
  custom: '',
};

const WORKSPACE_DIR_MAP = {
  top: 'column',
  bottom: 'column-reverse',
  left: 'row',
  right: 'row-reverse',
};

let settings = loadPrefs();
let customProviders = loadCustomProviders();
let currentOp = null;
let currentSettingsSection = null;
let menuFilterText = '';
let activeAbort = null;
const openGroups = new Set(['Settings']);
const draftState = new Map();
const responseState = new Map();
const modelsCache = new Map();

const $ = (sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
};

function allProviders() {
  return [...BUILTIN_PROVIDERS, ...customProviders];
}

function activeProvider() {
  const list = allProviders();
  return list.find((p) => p.id === settings.activeProviderId) || list[0];
}

function stateKeyFor(op = currentOp, prov = activeProvider()) {
  if (!op || !prov) return '';
  return `${prov.id}:${op.id}`;
}

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  const c = settings.colors;
  root.style.setProperty('--color-primary', c.primary);
  root.style.setProperty('--color-bg', c.bg);
  root.style.setProperty('--color-surface', c.surface);
  root.style.setProperty('--color-surface-alt', c.surfaceAlt);
  root.style.setProperty('--color-text', c.text);
  root.style.setProperty('--color-muted', c.muted);
  root.style.setProperty('--color-border', c.border);
  root.style.setProperty('--color-ok', c.ok);
  root.style.setProperty('--color-err', c.err);
  root.style.setProperty('--color-warn', c.warn);
  root.style.setProperty('--color-info', c.info);

  root.style.setProperty('--font-family', settings.fontFamily);
  root.style.setProperty('--font-mono', settings.fontMono);
  root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
  root.style.setProperty('--line-height', String(settings.lineHeight));

  root.style.setProperty('--radius', `${settings.radius}px`);
  root.style.setProperty('--border-width', `${settings.borderWidth}px`);
  root.style.setProperty('--sidebar-w', `${settings.sidebarWidth}px`);
  root.style.setProperty('--sidebar-pad', `${settings.sidebarPad}px`);
  root.style.setProperty('--layout-dir', settings.sidebarSide === 'right' ? 'row-reverse' : 'row');
  $('#app-layout').dataset.sidebarSide = settings.sidebarSide;

  const rPos = WORKSPACE_DIR_MAP[settings.responsePosition] ? settings.responsePosition : 'top';
  root.style.setProperty('--workspace-dir', WORKSPACE_DIR_MAP[rPos]);
  root.style.setProperty('--response-split-pct', `${settings.responseSplitPct}%`);
  root.style.setProperty('--response-min-h', `${settings.responseMinHeight}px`);
  if (settings.responseMaxVh > 0) root.style.setProperty('--response-max-vh', `${settings.responseMaxVh}vh`);
  else root.style.removeProperty('--response-max-vh');
  $('#workspace-panels').dataset.responsePos = rPos;

  root.style.setProperty('--main-pad', `${settings.mainPad}px`);
  root.style.setProperty('--panel-pad', `${settings.panelPad}px`);
  root.style.setProperty('--panel-gap', `${settings.panelGap}px`);
  root.style.setProperty('--field-gap', `${settings.fieldGap}px`);
  root.style.setProperty('--label-gap', `${settings.labelGap}px`);
  root.style.setProperty('--input-pad-y', `${settings.inputPadY}px`);
  root.style.setProperty('--input-pad-x', `${settings.inputPadX}px`);
  root.style.setProperty('--num-field-width', `${settings.numFieldWidth}px`);
  root.style.setProperty('--select-field-width', `${settings.selectFieldWidth}px`);
  root.style.setProperty('--text-field-basis', `${settings.textFieldBasis}px`);

  savePrefs(settings);
}

function syncAppearanceForm() {
  $('#set-theme').value = settings.theme;
  $('#set-color-primary').value = settings.colors.primary;
  $('#set-color-bg').value = settings.colors.bg;
  $('#set-color-surface').value = settings.colors.surface;
  $('#set-color-surface-alt').value = settings.colors.surfaceAlt;
  $('#set-color-text').value = settings.colors.text;
  $('#set-color-muted').value = settings.colors.muted;
  $('#set-color-border').value = settings.colors.border;
  $('#set-color-ok').value = settings.colors.ok;
  $('#set-color-err').value = settings.colors.err;
  $('#set-color-warn').value = settings.colors.warn;
  $('#set-color-info').value = settings.colors.info;

  const fontKey = Object.keys(FONT_OPTIONS).find((k) => FONT_OPTIONS[k] === settings.fontFamily) ?? 'custom';
  $('#set-font').value = fontKey;
  const customFont = $('#set-font-custom');
  customFont.hidden = fontKey !== 'custom';
  if (fontKey === 'custom') customFont.value = settings.fontFamily;
  $('#set-font-mono').value = settings.fontMono;
  $('#set-font-size').value = String(settings.fontSize);
  $('#set-line-height').value = String(settings.lineHeight);

  $('#set-response-pos').value = settings.responsePosition;
  $('#set-response-split').value = String(settings.responseSplitPct);
  $('#set-actions-pos').value = settings.actionsPosition;
  $('#set-sidebar-side').value = settings.sidebarSide;
  $('#set-sidebar-w').value = String(settings.sidebarWidth);
  $('#set-sidebar-pad').value = String(settings.sidebarPad);
  $('#set-main-pad').value = String(settings.mainPad);
  $('#set-panel-pad').value = String(settings.panelPad);
  $('#set-panel-gap').value = String(settings.panelGap);
  $('#set-field-gap').value = String(settings.fieldGap);
  $('#set-label-gap').value = String(settings.labelGap);
  $('#set-input-pad-y').value = String(settings.inputPadY);
  $('#set-input-pad-x').value = String(settings.inputPadX);
  $('#set-radius').value = String(settings.radius);
  $('#set-border-width').value = String(settings.borderWidth);
  $('#set-num-field-width').value = String(settings.numFieldWidth);
  $('#set-select-field-width').value = String(settings.selectFieldWidth);
  $('#set-text-field-basis').value = String(settings.textFieldBasis);
  $('#set-response-min-h').value = String(settings.responseMinHeight);
  $('#set-response-max-vh').value = String(settings.responseMaxVh);
}

function populateProviderSelects() {
  const list = allProviders();
  const sidebarSel = $('#provider-select');
  const apiSel = $('#set-api-provider');
  sidebarSel.innerHTML = '';
  apiSel.innerHTML = '';

  for (const p of list) {
    const o1 = document.createElement('option');
    o1.value = p.id;
    o1.textContent = p.name;
    sidebarSel.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = p.id;
    o2.textContent = p.name;
    apiSel.appendChild(o2);
  }
  const active = activeProvider();
  sidebarSel.value = active.id;
  apiSel.value = active.id;
}

function syncApiSettingsForm(provider = activeProvider()) {
  $('#set-api-provider').value = provider.id;
  $('#api-section-legend').textContent = `API & Keys — ${provider.name}`;
  const cfg = getProviderConfig(settings, provider);
  $('#set-base-url').value = cfg.baseUrl;
  $('#set-base-url').placeholder = provider.baseUrl || 'https://api.example.com';

  const saved = hasKey(provider.id);
  const authNone = provider.auth?.type === 'none';
  $('#no-key-banner').hidden = saved || authNone;
  $('#no-key-banner-text').textContent = `No API key saved for ${provider.name} — requests can't be sent yet.`;

  $('#row-ack').hidden = saved;
  $('#row-key').hidden = saved;
  $('#row-key-saved').hidden = !saved;

  const ack = $('#set-ack');
  const keyInput = $('#set-key');
  keyInput.disabled = !ack.checked;
  $('#key-hint').textContent = ack.checked
    ? `Type your ${provider.name} key, then press Save — stored only in this browser.`
    : 'Check the acknowledgment above to enable, then press Save. The key is stored only in this browser and only while a value exists.';

  const secrets = $('#set-enable-secrets');
  secrets.disabled = !saved;
  if (!saved) {
    secrets.checked = false;
    settings.enableSecretFields = false;
    savePrefs(settings);
  } else {
    secrets.checked = settings.enableSecretFields;
  }
  $('#set-persist').checked = settings.persistKey;
  $('#set-default-temperature').value = cfg.defaultTemperature;
  $('#set-default-max-tokens').value = cfg.defaultMaxTokens;

  updateModelsDatalist(provider.id);
  const modelSel = $('#set-default-model');
  const knownModels = modelsCache.get(provider.id) || [];
  modelSel.innerHTML = '<option value="">— none (use operation default) —</option>';
  for (const m of knownModels) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    modelSel.appendChild(opt);
  }
  modelSel.value = cfg.defaultModel;
}

function updateModelsDatalist(providerId) {
  const dl = $('#provider-models-datalist');
  dl.innerHTML = '';
  const ids = modelsCache.get(providerId) || [];
  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    dl.appendChild(opt);
  }
}

async function loadModelList(provider = activeProvider()) {
  const key = getKey(provider.id);
  if (!key && provider.auth?.type !== 'none') return;
  const cfg = getProviderConfig(settings, provider);
  try {
    const ids = await fetchProviderModels(provider, { apiKey: key || '', baseUrl: cfg.baseUrl });
    modelsCache.set(provider.id, ids);
    if (provider.id === activeProvider().id) {
      updateModelsDatalist(provider.id);
    }
    if ($('#set-api-provider').value === provider.id) {
      const sel = $('#set-default-model');
      sel.innerHTML = '<option value="">— none (use operation default) —</option>';
      for (const id of ids) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        sel.appendChild(opt);
      }
      sel.value = cfg.defaultModel;
      void updateTokenRange(provider, sel.value);
    }
  } catch {
    /* ignore model list fetch failure */
  }
}

async function updateTokenRange(provider, modelId) {
  const input = $('#set-default-max-tokens');
  const hint = $('#max-tokens-hint');
  if (!modelId) {
    input.removeAttribute('max');
    hint.textContent = "Upper bound set from the selected model's context length when available.";
    return;
  }
  const key = getKey(provider.id);
  if (!key && provider.auth?.type !== 'none') return;
  const cfg = getProviderConfig(settings, provider);
  try {
    const max = await fetchModelContextLength(provider, modelId, { apiKey: key || '', baseUrl: cfg.baseUrl });
    if (typeof max === 'number' && max > 0) {
      input.max = String(max);
      hint.textContent = `Valid range for ${modelId}: 0–${max} (model context length).`;
      if (Number(input.value) > max) {
        input.value = String(max);
        setProviderConfig(settings, provider.id, { defaultMaxTokens: String(max) });
        savePrefs(settings);
      }
    }
  } catch {
    /* leave unbounded */
  }
}

function refreshKeyDependent() {
  const prov = activeProvider();
  syncApiSettingsForm(prov);
  if (currentOp) renderForm(currentOp);
  if (hasKey(prov.id) || prov.auth?.type === 'none') {
    void loadModelList(prov);
  }
}

function fieldDefaultValue(field, provider = activeProvider()) {
  const cfg = getProviderConfig(settings, provider);
  if ((field.name === 'model' || field.isModel) && cfg.defaultModel) return cfg.defaultModel;
  if (field.name === 'temperature' && cfg.defaultTemperature !== '') return cfg.defaultTemperature;
  if (
    (field.name === 'maxTokens' || field.name === 'maxCompletionTokens' || field.name === 'maxOutputTokens') &&
    cfg.defaultMaxTokens !== '' &&
    cfg.defaultMaxTokens !== '0'
  ) {
    return cfg.defaultMaxTokens;
  }
  return field.default;
}

function secretFieldsEnabled(provider = activeProvider()) {
  return settings.enableSecretFields && hasKey(provider.id);
}

const INPUT_BUILDERS = {
  select: (field, def, wrap) => {
    const sel = document.createElement('select');
    sel.id = `f-${field.name}`;
    sel.name = field.name;
    if (!field.required) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '— (default)';
      sel.appendChild(empty);
    }
    for (const o of field.options ?? []) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o || '— (any)';
      if (String(def ?? '') === o) opt.selected = true;
      sel.appendChild(opt);
    }
    if (def !== undefined && field.required) sel.value = String(def);
    wrap.classList.add('field-inline');
    return sel;
  },

  boolean: (field, def, wrap) => {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `f-${field.name}`;
    box.name = field.name;
    box.checked = def === true || def === 'true';
    wrap.classList.add('field-inline');
    return box;
  },

  json: (field, def) => {
    const ta = document.createElement('textarea');
    ta.id = `f-${field.name}`;
    ta.name = field.name;
    ta.rows = field.rows ?? 5;
    ta.spellcheck = false;
    if (field.required) ta.required = true;
    if (def !== undefined) {
      ta.value = typeof def === 'string' ? def : JSON.stringify(def, null, 2);
    }
    if (field.placeholder) ta.placeholder = field.placeholder;
    return ta;
  },

  text: (field, def) => {
    const ta = document.createElement('textarea');
    ta.id = `f-${field.name}`;
    ta.name = field.name;
    ta.rows = field.rows ?? 4;
    ta.spellcheck = false;
    if (field.required) ta.required = true;
    if (def !== undefined) ta.value = String(def);
    if (field.placeholder) ta.placeholder = field.placeholder;
    return ta;
  },

  file: (field) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.id = `f-${field.name}`;
    inp.name = field.name;
    if (field.accept) inp.accept = field.accept;
    return inp;
  },

  secret: (field) => {
    const prov = activeProvider();
    const pw = document.createElement('input');
    pw.type = 'password';
    pw.id = `f-${field.name}`;
    pw.name = field.name;
    pw.autocomplete = 'off';
    pw.className = 'secret-field';
    if (secretFieldsEnabled(prov)) {
      pw.disabled = false;
      pw.value = getKey(prov.id) ?? '';
      pw.placeholder = 'prefilled with saved key — edit to override for this request only';
    } else {
      pw.disabled = true;
      pw.value = '';
      pw.placeholder = '•••••••• (disabled — save a key in Settings → API & Keys, then enable secret fields)';
    }
    return pw;
  },

  number: (field, def, wrap) => {
    const n = document.createElement('input');
    n.type = 'number';
    n.id = `f-${field.name}`;
    n.name = field.name;
    n.step = field.step !== undefined
      ? String(field.step)
      : ['temperature', 'topP', 'presencePenalty', 'frequencyPenalty', 'speed'].includes(field.name)
        ? '0.01'
        : 'any';
    if (field.min !== undefined) n.min = String(field.min);
    if (field.max !== undefined) n.max = String(field.max);
    if (field.required) n.required = true;
    if (def !== undefined) n.value = String(def);
    if (field.placeholder) n.placeholder = field.placeholder;
    wrap.classList.add('field-inline');
    return n;
  },

  string: (field, def, wrap) => {
    const s = document.createElement('input');
    s.type = 'text';
    s.id = `f-${field.name}`;
    s.name = field.name;
    s.autocomplete = 'off';
    s.autocorrect = 'off';
    s.autocapitalize = 'off';
    s.spellcheck = false;
    if (field.required) s.required = true;
    if (field.isModel || field.name === 'model' || field.name === 'modelId') {
      s.setAttribute('list', 'provider-models-datalist');
    }
    if (def !== undefined) s.value = String(def);
    if (field.placeholder) s.placeholder = field.placeholder;
    wrap.classList.add('field-flex');
    return s;
  },
};

function buildInput(field, savedDraft) {
  const wrap = document.createElement('div');
  wrap.className = 'field-row';

  const label = document.createElement('label');
  label.htmlFor = `f-${field.name}`;
  label.textContent = field.label + (field.required ? ' *' : '');

  const def = savedDraft !== undefined ? savedDraft : fieldDefaultValue(field);
  const builder = INPUT_BUILDERS[field.type] || INPUT_BUILDERS.string;
  const input = builder(field, def, wrap);

  if (field.type === 'json') {
    const bar = document.createElement('div');
    bar.className = 'field-label-bar';
    bar.appendChild(label);

    const tools = document.createElement('div');
    tools.className = 'field-tools';
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge';
    statusBadge.hidden = true;

    const fmtBtn = document.createElement('button');
    fmtBtn.type = 'button';
    fmtBtn.className = 'btn-mini';
    fmtBtn.textContent = 'Format JSON';
    fmtBtn.addEventListener('click', () => {
      const raw = input.value.trim();
      if (!raw) return;
      try {
        input.value = JSON.stringify(JSON.parse(raw), null, 2);
        input.classList.remove('json-invalid');
        statusBadge.hidden = false;
        statusBadge.textContent = 'Valid JSON';
        statusBadge.className = 'badge ok';
      } catch {
        input.classList.add('json-invalid');
        statusBadge.hidden = false;
        statusBadge.textContent = 'Invalid JSON';
        statusBadge.className = 'badge err';
      }
    });

    input.addEventListener('blur', () => {
      const raw = input.value.trim();
      if (!raw) {
        input.classList.remove('json-invalid');
        statusBadge.hidden = true;
        return;
      }
      try {
        JSON.parse(raw);
        input.classList.remove('json-invalid');
        statusBadge.hidden = true;
      } catch {
        input.classList.add('json-invalid');
        statusBadge.hidden = false;
        statusBadge.textContent = 'Invalid JSON';
        statusBadge.className = 'badge err';
      }
    });
    input.addEventListener('input', () => {
      if (input.classList.contains('json-invalid')) {
        try {
          JSON.parse(input.value.trim());
          input.classList.remove('json-invalid');
          statusBadge.hidden = true;
        } catch {
          /* still invalid */
        }
      }
    });

    tools.appendChild(statusBadge);
    tools.appendChild(fmtBtn);
    bar.appendChild(tools);
    wrap.appendChild(bar);
    wrap.appendChild(input);
  } else if (field.type === 'secret') {
    wrap.appendChild(label);
    const secWrap = document.createElement('div');
    secWrap.className = 'secret-wrap';
    secWrap.appendChild(input);
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn-mini';
    toggleBtn.textContent = 'Show';
    toggleBtn.disabled = input.disabled;
    toggleBtn.addEventListener('click', () => {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      toggleBtn.textContent = isPw ? 'Hide' : 'Show';
    });
    secWrap.appendChild(toggleBtn);
    wrap.appendChild(secWrap);
  } else {
    wrap.appendChild(label);
    wrap.appendChild(input);
  }

  if (field.hint) {
    const hintId = `hint-${field.name}`;
    const hint = document.createElement('div');
    hint.id = hintId;
    hint.className = 'hint';
    hint.textContent = field.hint;
    input.setAttribute('aria-describedby', hintId);
    wrap.appendChild(hint);
  }
  return wrap;
}

function snapshotFormDraft(op = currentOp) {
  const form = document.querySelector('#op-form');
  if (!op || !form) return;
  const draft = {};
  for (const field of op.fields) {
    if (field.type === 'secret' || field.type === 'file') continue;
    const el = form.querySelector(`#f-${field.name}`);
    if (!el) continue;
    draft[field.name] = field.type === 'boolean' ? el.checked : el.value;
  }
  draftState.set(stateKeyFor(op), draft);
}

function menuEntry(label, sub, active, onClick) {
  const li = document.createElement('li');
  li.className = 'menu-entry';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-item' + (active ? ' active' : '');
  const title = document.createElement('span');
  title.className = 'menu-label';
  title.textContent = label;
  const path = document.createElement('span');
  path.className = 'menu-path';
  path.textContent = sub;
  btn.appendChild(title);
  btn.appendChild(path);
  btn.addEventListener('click', onClick);
  li.appendChild(btn);
  return li;
}

function addGroup(name, count, buildEntries) {
  const groupUl = document.createElement('ul');
  const isFilterActive = menuFilterText.trim().length > 0;
  const isOpen = isFilterActive || openGroups.has(name);
  groupUl.className = 'menu-group' + (isOpen ? '' : ' collapsed');

  const headerLi = document.createElement('li');
  headerLi.className = 'menu-group-header';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = name;
  headerLi.appendChild(titleSpan);

  if (typeof count === 'number') {
    const countSpan = document.createElement('span');
    countSpan.className = 'group-count';
    countSpan.textContent = String(count);
    headerLi.appendChild(countSpan);
  }

  headerLi.addEventListener('click', () => {
    if (openGroups.has(name)) openGroups.delete(name);
    else openGroups.add(name);
    groupUl.classList.toggle('collapsed', !openGroups.has(name));
  });
  groupUl.appendChild(headerLi);
  buildEntries(groupUl);
  $('#menu-groups').appendChild(groupUl);
}

function renderMenu() {
  const container = $('#menu-groups');
  container.innerHTML = '';
  const q = menuFilterText.trim().toLowerCase();

  addGroup('Settings', 3, (ul) => {
    ul.appendChild(
      menuEntry('Appearance & Layout', 'colors, fonts, panel placement, spacing', currentSettingsSection === 'appearance', () =>
        selectSettings('appearance'),
      ),
    );
    ul.appendChild(
      menuEntry('API & Keys', 'key, base URL, defaults, secret fields', currentSettingsSection === 'api', () => selectSettings('api')),
    );
    ul.appendChild(
      menuEntry('Providers & OpenAPI', 'import OpenAPI 3.x specs, custom APIs', currentSettingsSection === 'providers', () =>
        selectSettings('providers'),
      ),
    );
  });

  const prov = activeProvider();
  const groups = new Map();
  for (const op of prov.operations || []) {
    if (q) {
      const hay = `${op.group} ${op.label} ${op.method} ${op.path} ${op.id}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (!groups.has(op.group)) groups.set(op.group, []);
    groups.get(op.group).push(op);
  }

  for (const [group, ops] of groups) {
    addGroup(group, ops.length, (ul) => {
      for (const op of ops) {
        ul.appendChild(
          menuEntry(
            op.label + (op.stream ? ' ⇢' : ''),
            `${op.method} ${op.path}`,
            !currentSettingsSection && op.id === currentOp?.id,
            () => selectOp(op.id),
          ),
        );
      }
    });
  }
}

function buildActionBar(op, form, isBottom = false) {
  const actions = document.createElement('div');
  actions.className = 'form-actions' + (isBottom ? ' form-actions-bottom' : '');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn-primary submit-btn';
  submit.textContent = op.stream ? 'Send (streamed)' : 'Send request';
  actions.appendChild(submit);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn-secondary';
  resetBtn.textContent = 'Reset to defaults';
  resetBtn.addEventListener('click', () => {
    draftState.delete(stateKeyFor(op));
    renderForm(op);
  });
  actions.appendChild(resetBtn);

  const curlBtn = document.createElement('button');
  curlBtn.type = 'button';
  curlBtn.className = 'btn-secondary';
  curlBtn.textContent = 'Copy as cURL';
  curlBtn.addEventListener('click', async () => {
    try {
      const prov = activeProvider();
      const cfg = getProviderConfig(settings, prov);
      const params = collectParams(op, form);
      const override = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
      delete params.apiKey;
      const apiKey = override || getKey(prov.id) || '<YOUR_API_KEY>';
      const req = buildRequest(prov, op, params, { apiKey, baseUrl: cfg.baseUrl });
      await navigator.clipboard.writeText(req.curl);
      const orig = curlBtn.textContent;
      curlBtn.textContent = 'Copied cURL ✓';
      setTimeout(() => {
        curlBtn.textContent = orig;
      }, 1500);
    } catch (e) {
      setStatus('Invalid input', false);
      $('#response').textContent = e instanceof Error ? e.message : String(e);
    }
  });
  actions.appendChild(curlBtn);

  return actions;
}

function renderForm(op) {
  const panel = $('#form-panel');
  panel.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'form-head';
  const h2 = document.createElement('h2');
  h2.textContent = op.label;
  const badge = document.createElement('span');
  badge.className = 'badge method-' + op.method.toLowerCase();
  badge.textContent = op.method;
  const pathEl = document.createElement('code');
  pathEl.className = 'op-path';
  pathEl.textContent = op.path;
  head.appendChild(h2);
  head.appendChild(badge);
  head.appendChild(pathEl);
  panel.appendChild(head);

  if (op.description) {
    const d = document.createElement('p');
    d.className = 'hint';
    d.textContent = op.description;
    panel.appendChild(d);
  }

  const form = document.createElement('form');
  form.id = 'op-form';

  const actPos = settings.actionsPosition || 'top';
  if (actPos === 'top' || actPos === 'both') {
    form.appendChild(buildActionBar(op, form, false));
  }

  const savedDraft = draftState.get(stateKeyFor(op)) || {};
  const requiredFields = op.fields.filter((f) => f.required);
  const optionalFields = op.fields.filter((f) => !f.required);

  if (requiredFields.length > 0) {
    const reqSet = document.createElement('fieldset');
    reqSet.className = 'field-group';
    const legend = document.createElement('legend');
    legend.textContent = `Required (${requiredFields.length})`;
    reqSet.appendChild(legend);
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    for (const field of requiredFields) {
      grid.appendChild(buildInput(field, savedDraft[field.name]));
    }
    reqSet.appendChild(grid);
    form.appendChild(reqSet);
  }

  if (optionalFields.length > 0) {
    const details = document.createElement('details');
    details.className = 'optional-group';
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = `Optional & Request Overrides (${optionalFields.length})`;
    details.appendChild(summary);
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    for (const field of optionalFields) {
      grid.appendChild(buildInput(field, savedDraft[field.name]));
    }
    details.appendChild(grid);
    form.appendChild(details);
  }

  if (actPos === 'bottom' || actPos === 'both') {
    form.appendChild(buildActionBar(op, form, true));
  }

  form.addEventListener('input', () => snapshotFormDraft(op));
  form.addEventListener('change', () => snapshotFormDraft(op));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    snapshotFormDraft(op);
    void send(op, form);
  });
  panel.appendChild(form);

  renderCachedResponse(op);
}

function renderCachedResponse(op = currentOp) {
  const cached = responseState.get(stateKeyFor(op));
  const out = $('#response');
  const timeBadge = $('#response-time');
  const mode = $('#response-view-mode').value;

  if (!cached) {
    out.textContent = 'Responses appear here.';
    out.classList.add('placeholder');
    setStatus('', null);
    timeBadge.hidden = true;
    return;
  }

  out.classList.remove('placeholder');
  setStatus(cached.statusLabel, cached.ok);
  if (cached.elapsedMs !== undefined) {
    timeBadge.hidden = false;
    timeBadge.textContent = `${cached.elapsedMs} ms`;
  } else {
    timeBadge.hidden = true;
  }

  const viewMap = {
    json: () => cached.rawJson || 'No JSON payload.',
    text: () => cached.extractedText || cached.rawJson || '',
    request: () => cached.requestInfo || 'No request metadata.',
  };
  const renderFn = viewMap[mode] || viewMap.json;
  out.textContent = renderFn();
}

function selectOp(id) {
  snapshotFormDraft(currentOp);
  const prov = activeProvider();
  const op = (prov.operations || []).find((o) => o.id === id);
  if (!op) return;
  currentOp = op;
  currentSettingsSection = null;
  openGroups.add(op.group);
  renderMenu();
  renderForm(op);
  showView('api');
}

function selectSettings(sec) {
  snapshotFormDraft(currentOp);
  currentSettingsSection = sec;
  openGroups.add('Settings');
  $('#section-appearance').hidden = sec !== 'appearance';
  $('#section-api').hidden = sec !== 'api';
  $('#section-providers').hidden = sec !== 'providers';
  renderMenu();
  showView('settings');
}

function collectParams(op, form) {
  const params = {};
  for (const field of op.fields) {
    const el = form.querySelector(`#f-${field.name}`);
    if (!el) continue;
    if (field.type === 'boolean') {
      params[field.name] = el.checked === true;
    } else if (field.type === 'file') {
      if (el.files && el.files[0]) {
        params[field.name] = el.files[0];
      }
    } else if (field.type === 'number') {
      const v = el.value.trim();
      if (v === '') continue;
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`Field "${field.label}" must be a number`);
      params[field.name] = n;
    } else if (field.type === 'json') {
      const v = el.value.trim();
      if (v === '') continue;
      try {
        params[field.name] = JSON.parse(v);
      } catch {
        throw new Error(`Field "${field.label}" is not valid JSON`);
      }
    } else {
      params[field.name] = el.value;
    }
  }
  return params;
}

function setStatus(text, ok) {
  const badge = $('#response-status');
  badge.textContent = text;
  badge.className = 'badge' + (ok === true ? ' ok' : ok === false ? ' err' : '');
}

function setInFlight(busy) {
  $('#response-cancel').hidden = !busy;
  document.querySelectorAll('#op-form .submit-btn').forEach((btn) => {
    btn.disabled = busy;
  });
}

async function postBridgeResponse(payload) {
  try {
    const prov = activeProvider();
    await fetch('/bridge/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: prov?.id ?? null,
        operation: currentOp?.id ?? null,
        ...payload,
      }),
    });
  } catch {
    /* bridge unavailable or offline */
  }
}

async function send(op, form, requestId = null) {
  const prov = activeProvider();
  const cfg = getProviderConfig(settings, prov);
  const out = $('#response');
  out.classList.remove('placeholder');

  let params;
  try {
    params = collectParams(op, form);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    setStatus('Invalid input', false);
    out.textContent = errMsg;
    void postBridgeResponse({ requestId, ok: false, status: 'Invalid input', readable: errMsg, raw: errMsg });
    return;
  }

  const override = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
  delete params.apiKey;
  const apiKey = override || getKey(prov.id) || '';

  if (!apiKey && prov.auth?.type !== 'none') {
    const errMsg = `No API key available for ${prov.name}. Add your default key in Settings → API & Keys (requires acknowledging the security risks first), or enable secret form fields to enter a key per request.`;
    setStatus('No API key', false);
    out.textContent = errMsg;
    $('#no-key-banner').hidden = false;
    void postBridgeResponse({ requestId, ok: false, status: 'No API key', readable: errMsg, raw: errMsg });
    return;
  }

  if (activeAbort) activeAbort.abort();
  activeAbort = new AbortController();
  setInFlight(true);
  setStatus('Sending…', null);
  $('#response-time').hidden = true;
  out.textContent = '';

  const sKey = stateKeyFor(op, prov);
  try {
    const res = await executeOperation(prov, op, params, {
      apiKey,
      baseUrl: cfg.baseUrl,
      signal: activeAbort.signal,
    });

    const reqSummary = [
      `${res.request.method} ${res.request.url}`,
      `Status: ${res.status} ${res.statusText}`,
      '',
      '--- cURL ---',
      res.request.curl,
      '',
      '--- Response Headers ---',
      JSON.stringify(res.headers, null, 2),
    ].join('\n');

    if (op.stream && res.stream) {
      let chunks = 0;
      const rawChunks = [];
      let combinedText = '';
      for await (const chunk of res.stream) {
        chunks++;
        rawChunks.push(JSON.stringify(chunk.data, null, 2));
        if (chunk.textDelta) combinedText += chunk.textDelta;
        const elapsedMs = Math.round(performance.now() - res.t0);
        responseState.set(sKey, {
          ok: true,
          statusLabel: `${chunks} chunks (${res.status})`,
          elapsedMs,
          rawJson: rawChunks.join('\n— — —\n'),
          extractedText: combinedText || rawChunks.join('\n— — —\n'),
          requestInfo: reqSummary,
        });
        renderCachedResponse(op);
      }
      const totalMs = Math.round(performance.now() - res.t0);
      responseState.set(sKey, {
        ok: chunks > 0,
        statusLabel: `${chunks} chunks (${res.status})`,
        elapsedMs: totalMs,
        rawJson: rawChunks.join('\n— — —\n'),
        extractedText: combinedText || rawChunks.join('\n— — —\n'),
        requestInfo: reqSummary,
      });
      renderCachedResponse(op);
    } else {
      const statusLabel = res.ok ? `OK (${res.status})` : `Error (${res.status})`;
      const rawJson = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null, null, 2);
      responseState.set(sKey, {
        ok: res.ok,
        statusLabel,
        elapsedMs: res.elapsedMs,
        rawJson,
        extractedText: res.extractedText || rawJson,
        requestInfo: reqSummary,
      });
      renderCachedResponse(op);
    }
  } catch (e) {
    const isAbort = e && typeof e === 'object' && e.name === 'AbortError';
    const msg = isAbort ? 'Request cancelled by user.' : e instanceof Error ? e.message : String(e);
    responseState.set(sKey, {
      ok: false,
      statusLabel: isAbort ? 'Cancelled' : 'Error',
      rawJson: msg,
      extractedText: msg,
      requestInfo: msg,
    });
    renderCachedResponse(op);
  } finally {
    setInFlight(false);
    activeAbort = null;
    const finalCached = responseState.get(sKey);
    if (finalCached) {
      void postBridgeResponse({
        requestId,
        provider: prov.id,
        operation: op.id,
        ok: finalCached.ok,
        status: finalCached.statusLabel,
        readable: finalCached.extractedText,
        raw: finalCached.rawJson,
      });
    }
  }
}

function showView(view) {
  $('#view-api').hidden = view !== 'api';
  $('#view-settings').hidden = view !== 'settings';
}

function renderCustomProvidersList() {
  const ul = $('#custom-provider-list');
  ul.innerHTML = '';
  if (customProviders.length === 0) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = 'No custom providers imported yet.';
    ul.appendChild(li);
    return;
  }
  for (const p of customProviders) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.innerHTML = `<strong>${p.name}</strong> <code>${p.baseUrl}</code> (${p.operations?.length ?? 0} operations)`;
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-secondary';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', () => {
      customProviders = customProviders.filter((x) => x.id !== p.id);
      saveCustomProviders(customProviders);
      clearKey(p.id);
      if (settings.activeProviderId === p.id) {
        settings.activeProviderId = 'mistral';
        savePrefs(settings);
      }
      populateProviderSelects();
      renderCustomProvidersList();
      switchProvider(settings.activeProviderId);
    });
    li.appendChild(info);
    li.appendChild(delBtn);
    ul.appendChild(li);
  }
}

function switchProvider(providerId) {
  snapshotFormDraft(currentOp);
  settings.activeProviderId = providerId;
  savePrefs(settings);
  populateProviderSelects();
  const prov = activeProvider();
  openGroups.clear();
  openGroups.add('Settings');
  if (prov.operations?.length) {
    openGroups.add(prov.operations[0].group);
    currentOp = prov.operations[0];
  } else {
    currentOp = null;
  }
  refreshKeyDependent();
  renderMenu();
  if (currentOp && !currentSettingsSection) {
    renderForm(currentOp);
  }
}

function importSpecObject(rawObj) {
  const name = $('#oas-name').value.trim();
  const baseUrl = $('#oas-base-url').value.trim();
  const authType = $('#oas-auth-type').value;
  const authName = $('#oas-auth-name').value.trim();
  const auth = {
    type: authType,
    headerName: authType === 'header' ? (authName || 'x-api-key') : undefined,
    queryParam: authType === 'query' ? (authName || 'api_key') : undefined,
  };
  const spec = parseOpenApiSpec(rawObj, { name, baseUrl, auth });
  if (!spec.operations.length) {
    throw new Error('No HTTP operations found in the provided OpenAPI paths object.');
  }
  customProviders = [...customProviders.filter((p) => p.id !== spec.id), spec];
  saveCustomProviders(customProviders);
  renderCustomProvidersList();
  switchProvider(spec.id);
  $('#oas-status').textContent = `Imported "${spec.name}" (${spec.operations.length} operations) ✓`;
}

function wireSettings() {
  $('#provider-select').addEventListener('change', (e) => {
    currentSettingsSection = null;
    switchProvider(e.target.value);
    showView('api');
  });

  $('#menu-filter').addEventListener('input', (e) => {
    menuFilterText = e.target.value;
    renderMenu();
  });

  $('#menu-toggle-all').addEventListener('click', () => {
    const prov = activeProvider();
    const allGroupNames = ['Settings', ...new Set((prov.operations || []).map((o) => o.group))];
    const allOpen = allGroupNames.every((g) => openGroups.has(g));
    if (allOpen) openGroups.clear();
    else allGroupNames.forEach((g) => openGroups.add(g));
    renderMenu();
  });

  $('#response-view-mode').addEventListener('change', () => renderCachedResponse());

  $('#response-cancel').addEventListener('click', () => {
    if (activeAbort) activeAbort.abort();
  });

  $('#response-copy').addEventListener('click', async () => {
    const text = $('#response').textContent || '';
    await navigator.clipboard.writeText(text);
    const btn = $('#response-copy');
    const prev = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => {
      btn.textContent = prev;
    }, 1400);
  });

  $('#response-clear').addEventListener('click', () => {
    if (currentOp) responseState.delete(stateKeyFor(currentOp));
    renderCachedResponse(currentOp);
  });

  $('#banner-open-settings').addEventListener('click', () => {
    selectSettings('api');
    $('#row-key').scrollIntoView({ block: 'center' });
  });

  $('#set-response-pos').addEventListener('change', (e) => {
    settings.responsePosition = e.target.value;
    applySettings();
  });

  $('#set-actions-pos').addEventListener('change', (e) => {
    settings.actionsPosition = e.target.value;
    applySettings();
    if (currentOp) renderForm(currentOp);
  });

  $('#set-sidebar-side').addEventListener('change', (e) => {
    settings.sidebarSide = e.target.value === 'right' ? 'right' : 'left';
    applySettings();
  });

  $('#set-theme').addEventListener('change', (e) => {
    settings.theme = e.target.value === 'light' ? 'light' : 'dark';
    settings.colors = structuredClone(PALETTES[settings.theme]);
    applySettings();
    syncAppearanceForm();
  });

  const colorMap = [
    ['#set-color-primary', 'primary'],
    ['#set-color-bg', 'bg'],
    ['#set-color-surface', 'surface'],
    ['#set-color-surface-alt', 'surfaceAlt'],
    ['#set-color-text', 'text'],
    ['#set-color-muted', 'muted'],
    ['#set-color-border', 'border'],
    ['#set-color-ok', 'ok'],
    ['#set-color-err', 'err'],
    ['#set-color-warn', 'warn'],
    ['#set-color-info', 'info'],
  ];
  for (const [sel, key] of colorMap) {
    $(sel).addEventListener('input', (e) => {
      settings.colors[key] = e.target.value;
      applySettings();
    });
  }

  $('#set-font').addEventListener('change', (e) => {
    const v = e.target.value;
    const custom = $('#set-font-custom');
    custom.hidden = v !== 'custom';
    settings.fontFamily = v === 'custom' ? custom.value || 'sans-serif' : FONT_OPTIONS[v];
    applySettings();
  });
  $('#set-font-custom').addEventListener('input', (e) => {
    settings.fontFamily = e.target.value || 'sans-serif';
    applySettings();
  });
  $('#set-font-mono').addEventListener('input', (e) => {
    settings.fontMono = e.target.value || 'monospace';
    applySettings();
  });

  const numberSettings = [
    ['#set-font-size', 'fontSize'],
    ['#set-line-height', 'lineHeight'],
    ['#set-radius', 'radius'],
    ['#set-border-width', 'borderWidth'],
    ['#set-sidebar-w', 'sidebarWidth'],
    ['#set-sidebar-pad', 'sidebarPad'],
    ['#set-response-split', 'responseSplitPct'],
    ['#set-response-min-h', 'responseMinHeight'],
    ['#set-response-max-vh', 'responseMaxVh'],
    ['#set-main-pad', 'mainPad'],
    ['#set-panel-pad', 'panelPad'],
    ['#set-panel-gap', 'panelGap'],
    ['#set-field-gap', 'fieldGap'],
    ['#set-label-gap', 'labelGap'],
    ['#set-input-pad-y', 'inputPadY'],
    ['#set-input-pad-x', 'inputPadX'],
    ['#set-num-field-width', 'numFieldWidth'],
    ['#set-select-field-width', 'selectFieldWidth'],
    ['#set-text-field-basis', 'textFieldBasis'],
  ];
  for (const [sel, key] of numberSettings) {
    $(sel).addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (Number.isNaN(v)) return;
      settings[key] = v;
      applySettings();
    });
  }

  $('#settings-reset').addEventListener('click', () => {
    const d = structuredClone(DEFAULT_SETTINGS);
    const keepKeys = ['activeProviderId', 'defaultModel', 'defaultTemperature', 'defaultMaxTokens', 'providerConfigs', 'enableSecretFields', 'persistKey'];
    for (const [k, v] of Object.entries(d)) {
      if (!keepKeys.includes(k)) settings[k] = v;
    }
    applySettings();
    syncAppearanceForm();
    if (currentOp) renderForm(currentOp);
  });

  const downloadBlob = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  $('#settings-export-conf').addEventListener('click', () => {
    downloadBlob('webapi-settings.conf', serializeSettingsConf(settings), 'text/plain;charset=utf-8');
  });

  $('#settings-import-conf').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    settings = parseSettingsConf(text, settings);
    applySettings();
    populateProviderSelects();
    syncAppearanceForm();
    refreshKeyDependent();
    if (currentOp) renderForm(currentOp);
    $('#backup-status').textContent = `Imported settings from ${f.name} ✓`;
    e.target.value = '';
  });

  $('#workspace-export-json').addEventListener('click', () => {
    snapshotFormDraft(currentOp);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      parameters: Object.fromEntries(draftState.entries()),
      responses: Object.fromEntries(responseState.entries()),
      customProviders,
    };
    downloadBlob('webapi-workspace.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  });

  $('#workspace-import-json').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed.parameters && typeof parsed.parameters === 'object') {
        for (const [k, v] of Object.entries(parsed.parameters)) draftState.set(k, v);
      }
      if (parsed.responses && typeof parsed.responses === 'object') {
        for (const [k, v] of Object.entries(parsed.responses)) responseState.set(k, v);
      }
      if (Array.isArray(parsed.customProviders)) {
        customProviders = parsed.customProviders;
        saveCustomProviders(customProviders);
        populateProviderSelects();
        renderCustomProvidersList();
      }
      renderMenu();
      if (currentOp) renderForm(currentOp);
      $('#backup-status').textContent = `Imported workspace data from ${f.name} ✓`;
    } catch (err) {
      $('#backup-status').textContent = `Import error: ${err instanceof Error ? err.message : String(err)}`;
    }
    e.target.value = '';
  });

  // ── API & Keys section wiring ─────────────────────────────────────────
  $('#set-api-provider').addEventListener('change', (e) => {
    const targetId = e.target.value;
    switchProvider(targetId);
  });

  const ack = $('#set-ack');
  const keyInput = $('#set-key');
  ack.addEventListener('change', () => {
    const prov = activeProvider();
    keyInput.disabled = !ack.checked;
    $('#key-hint').textContent = ack.checked
      ? `Type your ${prov.name} key, then press Save — stored only in this browser.`
      : 'Check the acknowledgment above to enable, then press Save. The key is stored only in this browser and only while a value exists.';
    if (!ack.checked) keyInput.value = '';
  });

  $('#api-save').addEventListener('click', () => {
    const prov = activeProvider();
    const v = keyInput.value.trim();
    if (!hasKey(prov.id) && ack.checked && v) {
      setKey(v, prov.id);
      keyInput.value = '';
    }
    setProviderConfig(settings, prov.id, {
      baseUrl: $('#set-base-url').value.trim() || prov.baseUrl,
      defaultModel: $('#set-default-model').value,
      defaultTemperature: $('#set-default-temperature').value,
      defaultMaxTokens: $('#set-default-max-tokens').value,
    });
    savePrefs(settings);
    refreshKeyDependent();
    const st = $('#api-save-status');
    st.textContent = 'Saved ✓';
    setTimeout(() => {
      st.textContent = '';
    }, 2000);
  });

  $('#set-remove-key').addEventListener('click', () => {
    const prov = activeProvider();
    clearKey(prov.id);
    ack.checked = false;
    refreshKeyDependent();
  });

  $('#set-persist').addEventListener('change', (e) => {
    settings.persistKey = e.target.checked;
    for (const p of allProviders()) {
      migrateKey(settings.persistKey, p.id);
    }
    savePrefs(settings);
  });

  $('#set-enable-secrets').addEventListener('change', (e) => {
    const prov = activeProvider();
    if (!hasKey(prov.id)) {
      e.target.checked = false;
      return;
    }
    settings.enableSecretFields = e.target.checked;
    savePrefs(settings);
    if (currentOp) renderForm(currentOp);
  });

  $('#set-default-model').addEventListener('change', (e) => {
    const prov = activeProvider();
    setProviderConfig(settings, prov.id, { defaultModel: e.target.value });
    void updateTokenRange(prov, e.target.value);
  });

  $('#set-default-temperature').addEventListener('input', (e) => {
    const prov = activeProvider();
    setProviderConfig(settings, prov.id, { defaultTemperature: e.target.value });
  });

  $('#set-default-max-tokens').addEventListener('input', (e) => {
    const prov = activeProvider();
    setProviderConfig(settings, prov.id, { defaultMaxTokens: e.target.value });
  });

  // ── OpenAPI Import section wiring ─────────────────────────────────────
  $('#oas-auth-type').addEventListener('change', (e) => {
    const t = e.target.value;
    const nameInp = $('#oas-auth-name');
    nameInp.hidden = t !== 'header' && t !== 'query';
  });

  $('#oas-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    $('#oas-json').value = text;
  });

  $('#oas-fetch-btn').addEventListener('click', async () => {
    const url = $('#oas-url').value.trim();
    if (!url) return;
    const status = $('#oas-status');
    status.textContent = 'Fetching spec…';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const obj = await res.json();
      $('#oas-json').value = JSON.stringify(obj, null, 2);
      importSpecObject(obj);
    } catch (e) {
      status.textContent = `Fetch error: ${e instanceof Error ? e.message : String(e)}`;
    }
  });

  $('#oas-import-btn').addEventListener('click', () => {
    const status = $('#oas-status');
    try {
      const raw = $('#oas-json').value.trim();
      if (!raw) throw new Error('Paste OpenAPI JSON or select a file first.');
      const obj = JSON.parse(raw);
      importSpecObject(obj);
    } catch (e) {
      status.textContent = `Import error: ${e instanceof Error ? e.message : String(e)}`;
    }
  });

  window.addEventListener('storage', () => refreshKeyDependent());
}

function applyBridgeParams(op, params) {
  if (!op || !params || typeof params !== 'object') return;
  const form = document.querySelector('#op-form');
  const existing = draftState.get(stateKeyFor(op)) || {};
  const nextDraft = { ...existing };

  for (const field of op.fields) {
    if (field.type === 'secret' || field.type === 'file') continue;
    if (!(field.name in params)) continue;
    const rawVal = params[field.name];
    const formatted =
      field.type === 'json' && typeof rawVal === 'object' && rawVal !== null
        ? JSON.stringify(rawVal, null, 2)
        : field.type === 'boolean'
          ? Boolean(rawVal)
          : String(rawVal);

    nextDraft[field.name] = formatted;
    const el = form?.querySelector(`#f-${field.name}`);
    if (el) {
      if (field.type === 'boolean') el.checked = Boolean(rawVal);
      else el.value = String(formatted);
    }
  }
  draftState.set(stateKeyFor(op), nextDraft);
}

function initBridge() {
  if (typeof EventSource === 'undefined') return;
  const es = new EventSource('/bridge/events');

  es.addEventListener('connected', () => {
    void postBridgeResponse({
      status: 'Connected',
      ok: true,
      readable: `Connected (${activeProvider().id}:${currentOp?.id ?? 'none'})`,
    });
  });

  const BRIDGE_ACTIONS = {
    select: async (cmd) => {
      if (cmd.provider && cmd.provider !== settings.activeProviderId) {
        switchProvider(cmd.provider);
      }
      if (cmd.operation) {
        selectOp(cmd.operation);
      }
      if (cmd.params && currentOp) {
        applyBridgeParams(currentOp, cmd.params);
      }
      await postBridgeResponse({
        requestId: cmd.requestId,
        ok: true,
        status: 'Selected',
        readable: `Selected ${activeProvider().id}:${currentOp?.id ?? 'none'}`,
      });
    },

    fill: async (cmd) => {
      if (cmd.provider && cmd.provider !== settings.activeProviderId) {
        switchProvider(cmd.provider);
      }
      if (cmd.operation) {
        selectOp(cmd.operation);
      }
      if (currentOp && cmd.params) {
        applyBridgeParams(currentOp, cmd.params);
      }
      await postBridgeResponse({
        requestId: cmd.requestId,
        ok: true,
        status: 'Filled',
        readable: `Populated parameters on ${activeProvider().id}:${currentOp?.id ?? 'none'}`,
        raw: draftState.get(stateKeyFor(currentOp)) || {},
      });
    },

    inspect: async (cmd) => {
      snapshotFormDraft(currentOp);
      const cached = currentOp ? responseState.get(stateKeyFor(currentOp)) : null;
      await postBridgeResponse({
        requestId: cmd.requestId,
        ok: true,
        status: cached?.statusLabel ?? 'Ready',
        readable: cached?.extractedText ?? '',
        raw: {
          provider: activeProvider().id,
          operation: currentOp?.id ?? null,
          draft: currentOp ? draftState.get(stateKeyFor(currentOp)) || {} : {},
          lastResponse: cached ?? null,
        },
      });
    },

    execute: async (cmd) => {
      if (cmd.provider && cmd.provider !== settings.activeProviderId) {
        switchProvider(cmd.provider);
      }
      if (cmd.operation) {
        selectOp(cmd.operation);
      }
      if (!currentOp) {
        await postBridgeResponse({
          requestId: cmd.requestId,
          ok: false,
          status: 'No operation',
          readable: 'No operation selected to execute.',
        });
        return;
      }
      showView('api');
      if (cmd.params) {
        applyBridgeParams(currentOp, cmd.params);
      }
      const form = document.querySelector('#op-form');
      if (form) {
        await send(currentOp, form, cmd.requestId);
      }
    },
  };

  es.addEventListener('command', (ev) => {
    try {
      const cmd = JSON.parse(ev.data);
      const handler = BRIDGE_ACTIONS[cmd.action] || BRIDGE_ACTIONS.execute;
      void handler(cmd);
    } catch {
      /* ignore malformed event */
    }
  });
}

function init() {
  applySettings();
  populateProviderSelects();
  syncAppearanceForm();
  renderCustomProvidersList();
  wireSettings();
  const prov = activeProvider();
  if (prov.operations?.length) {
    openGroups.add(prov.operations[0].group);
    currentOp = prov.operations[0];
  }
  refreshKeyDependent();
  renderMenu();
  if (currentOp) selectOp(currentOp.id);
  initBridge();
}

init();
