import type { AppSettings, Field, Operation, ThemeColors } from '../shared/types.js';
import { OPERATIONS } from '../shared/operations.js';
import { execute, listModelIds } from './executor.js';
import { DEFAULT_SETTINGS, loadPrefs, savePrefs, getKey, hasKey, setKey, clearKey, migrateKey } from './store.js';

const PALETTES: Record<'dark' | 'light', ThemeColors> = {
  dark: { primary: '#ff7000', bg: '#0f0f13', surface: '#17171d', surfaceAlt: '#20202a', text: '#ececf1', muted: '#9a9aa8', border: '#2b2b37' },
  light: { primary: '#e85d00', bg: '#f6f6f8', surface: '#ffffff', surfaceAlt: '#ececf0', text: '#1c1c22', muted: '#5d5d6b', border: '#d8d8e0' },
};

const FONT_OPTIONS: Record<string, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  verdana: 'Verdana, Geneva, sans-serif',
  custom: '',
};

let settings: AppSettings = loadPrefs();
let currentOp: Operation | null = null;
const operations: Operation[] = OPERATIONS;

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
};

function applySettings(): void {
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
  root.style.setProperty('--font-family', settings.fontFamily);
  root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
  root.style.setProperty('--radius', `${settings.radius}px`);
  savePrefs(settings);
}

function syncAppearanceForm(): void {
  ($('#set-theme') as HTMLSelectElement).value = settings.theme;
  ($('#set-color-primary') as HTMLInputElement).value = settings.colors.primary;
  ($('#set-color-bg') as HTMLInputElement).value = settings.colors.bg;
  ($('#set-color-surface') as HTMLInputElement).value = settings.colors.surface;
  ($('#set-color-text') as HTMLInputElement).value = settings.colors.text;
  ($('#set-color-muted') as HTMLInputElement).value = settings.colors.muted;
  ($('#set-color-border') as HTMLInputElement).value = settings.colors.border;
  const fontKey = Object.keys(FONT_OPTIONS).find((k) => FONT_OPTIONS[k] === settings.fontFamily) ?? 'custom';
  ($('#set-font') as HTMLSelectElement).value = fontKey;
  const custom = $('#set-font-custom') as HTMLInputElement;
  custom.hidden = fontKey !== 'custom';
  if (fontKey === 'custom') custom.value = settings.fontFamily;
  const fs = $('#set-font-size') as HTMLInputElement;
  fs.value = String(settings.fontSize);
  $('#set-font-size-val').textContent = `${settings.fontSize}px`;
  const r = $('#set-radius') as HTMLInputElement;
  r.value = String(settings.radius);
  $('#set-radius-val').textContent = `${settings.radius}px`;
  ($('#set-default-model') as HTMLInputElement).value = settings.defaultModel;
  ($('#set-default-temperature') as HTMLInputElement).value = settings.defaultTemperature;
  ($('#set-default-max-tokens') as HTMLInputElement).value = settings.defaultMaxTokens;
  const secrets = $('#set-enable-secrets') as HTMLInputElement;
  secrets.checked = settings.enableSecretFields;
  secrets.disabled = !hasKey();
  ($('#set-persist') as HTMLInputElement).checked = settings.persistKey;
}

function refreshKeyDependent(): void {
  const saved = hasKey();
  $('#no-key-banner').hidden = saved;
  $('#row-ack').hidden = saved;
  $('#row-key').hidden = saved;
  $('#row-key-saved').hidden = !saved;
  const ack = $('#set-ack') as HTMLInputElement;
  const keyInput = $('#set-key') as HTMLInputElement;
  keyInput.disabled = !ack.checked;
  $('#key-hint').textContent = ack.checked
    ? 'Type your key — it is saved only in this browser.'
    : 'Check the acknowledgment above to enable. The key is saved only in this browser and only while a value exists.';
  const secrets = $('#set-enable-secrets') as HTMLInputElement;
  secrets.disabled = !saved;
  if (!saved) {
    secrets.checked = false;
    settings.enableSecretFields = false;
    savePrefs(settings);
  }
  if (currentOp) renderForm(currentOp);
  if (saved) void loadModelList();
}

function fieldDefaultValue(field: Field): string | number | boolean | undefined {
  if (field.name === 'model' && settings.defaultModel) return settings.defaultModel;
  if (field.name === 'temperature' && settings.defaultTemperature !== '') return settings.defaultTemperature;
  if (field.name === 'maxTokens' && settings.defaultMaxTokens !== '') return settings.defaultMaxTokens;
  return field.default;
}

function secretFieldsEnabled(): boolean {
  return settings.enableSecretFields && hasKey();
}

function buildInput(field: Field): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'field-row';
  const label = document.createElement('label');
  label.htmlFor = `f-${field.name}`;
  label.textContent = field.label + (field.required ? ' *' : '');
  wrap.appendChild(label);

  let input: HTMLElement;
  const def = fieldDefaultValue(field);
  if (field.type === 'select') {
    const sel = document.createElement('select');
    sel.id = `f-${field.name}`;
    if (!field.required) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '— (default)';
      sel.appendChild(empty);
    }
    for (const o of field.options ?? []) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      if (String(def ?? '') === o) opt.selected = true;
      sel.appendChild(opt);
    }
    if (def !== undefined && field.required) sel.value = String(def);
    input = sel;
  } else if (field.type === 'boolean') {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `f-${field.name}`;
    box.checked = def === true;
    input = box;
  } else if (field.type === 'json' || field.type === 'text') {
    const ta = document.createElement('textarea');
    ta.id = `f-${field.name}`;
    ta.rows = field.rows ?? 4;
    ta.spellcheck = false;
    if (def !== undefined) ta.value = String(def);
    if (field.placeholder) ta.placeholder = field.placeholder;
    input = ta;
  } else if (field.type === 'secret') {
    const pw = document.createElement('input');
    pw.type = 'password';
    pw.id = `f-${field.name}`;
    pw.autocomplete = 'off';
    if (secretFieldsEnabled()) {
      pw.disabled = false;
      pw.value = getKey() ?? '';
      pw.placeholder = 'prefilled with the saved key — edit to override for this request only';
    } else {
      pw.disabled = true;
      pw.value = '';
      pw.placeholder = '•••••••• (disabled — save a key in Settings → API, then enable secret fields)';
    }
    input = pw;
  } else if (field.type === 'number') {
    const n = document.createElement('input');
    n.type = 'number';
    n.step = 'any';
    n.id = `f-${field.name}`;
    if (def !== undefined) n.value = String(def);
    if (field.placeholder) n.placeholder = field.placeholder;
    input = n;
  } else {
    const s = document.createElement('input');
    s.type = 'text';
    s.id = `f-${field.name}`;
    if (def !== undefined) s.value = String(def);
    if (field.placeholder) s.placeholder = field.placeholder;
    input = s;
  }
  wrap.appendChild(input);
  if (field.type === 'secret') input.classList.add('secret-field');
  if (field.hint) {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = field.hint;
    wrap.appendChild(hint);
  }
  return wrap;
}

function renderMenu(): void {
  const menu = $('#menu');
  menu.innerHTML = '';
  const groups = new Map<string, Operation[]>();
  for (const op of operations) {
    if (!groups.has(op.group)) groups.set(op.group, []);
    groups.get(op.group)!.push(op);
  }
  for (const [group, ops] of groups) {
    const h = document.createElement('h3');
    h.textContent = group;
    menu.appendChild(h);
    for (const op of ops) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-item' + (op.id === currentOp?.id ? ' active' : '');
      btn.dataset.op = op.id;
      const title = document.createElement('span');
      title.className = 'menu-label';
      title.textContent = op.label + (op.stream ? ' ⇢' : '');
      const path = document.createElement('span');
      path.className = 'menu-path';
      path.textContent = `${op.method} ${op.path}`;
      btn.appendChild(title);
      btn.appendChild(path);
      btn.addEventListener('click', () => selectOp(op.id));
      menu.appendChild(btn);
    }
  }
}

function renderForm(op: Operation): void {
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
  for (const field of op.fields) form.appendChild(buildInput(field));

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn-primary';
  submit.textContent = op.stream ? 'Send (streamed)' : 'Send request';
  actions.appendChild(submit);
  form.appendChild(actions);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void send(op, form);
  });
  panel.appendChild(form);

  $('#response-panel').hidden = true;
  $('#response').textContent = '';
  $('#response-status').textContent = '';
}

function selectOp(id: string): void {
  const op = operations.find((o) => o.id === id);
  if (!op) return;
  currentOp = op;
  renderMenu();
  renderForm(op);
  showView('api');
}

function collectParams(op: Operation, form: HTMLFormElement): Record<string, any> {
  const params: Record<string, any> = {};
  for (const field of op.fields) {
    const el = form.querySelector(`#f-${field.name}`);
    if (!el) continue;
    const input = el as HTMLInputElement;
    if (field.type === 'boolean') {
      params[field.name] = input.checked === true;
    } else if (field.type === 'number') {
      const v = input.value.trim();
      if (v === '') continue;
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`Field "${field.label}" must be a number`);
      params[field.name] = n;
    } else if (field.type === 'json') {
      const v = input.value.trim();
      if (v === '') continue;
      try {
        params[field.name] = JSON.parse(v);
      } catch {
        throw new Error(`Field "${field.label}" is not valid JSON`);
      }
    } else {
      params[field.name] = input.value;
    }
  }
  return params;
}

function setStatus(text: string, ok: boolean | null): void {
  const badge = $('#response-status');
  badge.textContent = text;
  badge.className = 'badge' + (ok === true ? ' ok' : ok === false ? ' err' : '');
}

async function send(op: Operation, form: HTMLFormElement): Promise<void> {
  $('#response-panel').hidden = false;
  const out = $('#response');
  let params: Record<string, any>;
  try {
    params = collectParams(op, form);
  } catch (e) {
    setStatus('Invalid input', false);
    out.textContent = e instanceof Error ? e.message : String(e);
    return;
  }
  const override = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
  delete params.apiKey;
  const apiKey = override || getKey();
  if (!apiKey) {
    setStatus('No API key', false);
    out.textContent = 'No API key available. Add your default key in Settings → API (you will be asked to acknowledge the security risks first), or enable secret form fields to enter a key per request.';
    $('#no-key-banner').hidden = false;
    return;
  }
  setStatus('Sending…', null);
  out.textContent = '';
  try {
    const r = await execute(op.id, { ...params, apiKey });
    if (op.stream && r.stream) {
      let chunks = 0;
      for await (const chunk of r.stream) {
        chunks++;
        out.textContent += (chunks > 1 ? '\n— — —\n' : '') + JSON.stringify(chunk, null, 2);
      }
      setStatus(`${chunks} chunks`, chunks > 0);
    } else {
      setStatus('OK', true);
      out.textContent = JSON.stringify(r.data ?? null, null, 2);
    }
  } catch (e) {
    setStatus('Error', false);
    out.textContent = e instanceof Error ? e.message : String(e);
  }
}

function showView(view: 'api' | 'settings'): void {
  $('#view-api').hidden = view !== 'api';
  $('#view-settings').hidden = view !== 'settings';
  $('#nav-api').classList.toggle('active', view === 'api');
  $('#nav-settings').classList.toggle('active', view === 'settings');
  $('#sidebar').classList.toggle('hidden', view !== 'api');
}

async function loadModelList(): Promise<void> {
  const key = getKey();
  if (!key) return;
  try {
    const ids = await listModelIds(key);
    const list = $('#model-list');
    list.innerHTML = '';
    for (const id of ids) {
      const opt = document.createElement('option');
      opt.value = id;
      list.appendChild(opt);
    }
  } catch {
    /* model suggestions need a valid key */
  }
}

function wireSettings(): void {
  $('#nav-api').addEventListener('click', () => showView('api'));
  $('#nav-settings').addEventListener('click', () => showView('settings'));
  $('#banner-open-settings').addEventListener('click', () => {
    showView('settings');
    $('#row-key').scrollIntoView({ block: 'center' });
  });

  $('#set-theme').addEventListener('change', (e) => {
    settings.theme = (e.target as HTMLSelectElement).value === 'light' ? 'light' : 'dark';
    settings.colors = structuredClone(PALETTES[settings.theme]);
    applySettings();
    syncAppearanceForm();
  });

  const colorMap: [string, keyof ThemeColors][] = [
    ['#set-color-primary', 'primary'],
    ['#set-color-bg', 'bg'],
    ['#set-color-surface', 'surface'],
    ['#set-color-text', 'text'],
    ['#set-color-muted', 'muted'],
    ['#set-color-border', 'border'],
  ];
  for (const [sel, key] of colorMap) {
    $(sel).addEventListener('input', (e) => {
      settings.colors[key] = (e.target as HTMLInputElement).value;
      applySettings();
    });
  }

  $('#set-font').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    const custom = $('#set-font-custom') as HTMLInputElement;
    custom.hidden = v !== 'custom';
    settings.fontFamily = v === 'custom' ? custom.value || 'sans-serif' : FONT_OPTIONS[v];
    applySettings();
  });
  $('#set-font-custom').addEventListener('input', (e) => {
    settings.fontFamily = (e.target as HTMLInputElement).value || 'sans-serif';
    applySettings();
  });
  $('#set-font-size').addEventListener('input', (e) => {
    settings.fontSize = Number((e.target as HTMLInputElement).value);
    $('#set-font-size-val').textContent = `${settings.fontSize}px`;
    applySettings();
  });
  $('#set-radius').addEventListener('input', (e) => {
    settings.radius = Number((e.target as HTMLInputElement).value);
    $('#set-radius-val').textContent = `${settings.radius}px`;
    applySettings();
  });

  const ack = $('#set-ack') as HTMLInputElement;
  const keyInput = $('#set-key') as HTMLInputElement;
  ack.addEventListener('change', () => {
    keyInput.disabled = !ack.checked;
    $('#key-hint').textContent = ack.checked
      ? 'Type your key — it is saved only in this browser.'
      : 'Check the acknowledgment above to enable. The key is saved only in this browser and only while a value exists.';
    if (!ack.checked) keyInput.value = '';
  });
  const saveKeyFromInput = (): void => {
    if (!ack.checked) return;
    const v = keyInput.value.trim();
    if (v) {
      setKey(v);
      keyInput.value = '';
      refreshKeyDependent();
    }
  };
  keyInput.addEventListener('change', saveKeyFromInput);
  keyInput.addEventListener('blur', saveKeyFromInput);

  $('#set-remove-key').addEventListener('click', () => {
    clearKey();
    refreshKeyDependent();
  });

  $('#set-persist').addEventListener('change', (e) => {
    settings.persistKey = (e.target as HTMLInputElement).checked;
    migrateKey(settings.persistKey);
    savePrefs(settings);
  });

  $('#set-enable-secrets').addEventListener('change', (e) => {
    if (!hasKey()) return;
    settings.enableSecretFields = (e.target as HTMLInputElement).checked;
    savePrefs(settings);
    if (currentOp) renderForm(currentOp);
  });

  $('#set-default-model').addEventListener('input', (e) => {
    settings.defaultModel = (e.target as HTMLInputElement).value.trim();
    savePrefs(settings);
  });
  $('#set-default-temperature').addEventListener('input', (e) => {
    settings.defaultTemperature = (e.target as HTMLInputElement).value;
    savePrefs(settings);
  });
  $('#set-default-max-tokens').addEventListener('input', (e) => {
    settings.defaultMaxTokens = (e.target as HTMLInputElement).value;
    savePrefs(settings);
  });

  $('#settings-reset').addEventListener('click', () => {
    const d = structuredClone(DEFAULT_SETTINGS);
    settings.theme = d.theme;
    settings.colors = d.colors;
    settings.fontFamily = d.fontFamily;
    settings.fontSize = d.fontSize;
    settings.radius = d.radius;
    applySettings();
    syncAppearanceForm();
  });

  window.addEventListener('storage', () => refreshKeyDependent());
}

function init(): void {
  applySettings();
  syncAppearanceForm();
  wireSettings();
  renderMenu();
  refreshKeyDependent();
  if (operations.length) selectOp(operations[0].id);
}

init();
