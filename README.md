# Mistral API Playground

A minimal, framework-free web UI for exploring the full Mistral API with the official TypeScript SDK
([`@mistralai/mistralai`](https://www.npmjs.com/package/@mistralai/mistralai)).

**Architecture:** the Node server only serves the static interface (bound to `127.0.0.1`, with a strict
Content-Security-Policy). All API calls are made **directly from your browser** to `api.mistral.ai` using the
SDK bundled into the page. **Your API key never touches the server** — it is entered by you in Settings, stored
only in your browser, and attached to requests by the page itself.

- **Client** (`public/index.html` + `src/client/*.ts` + `src/client/styles.scss`) is plain HTML / TypeScript /
  SCSS, bundled with esbuild. The sidebar lists every API operation (Chat, Embeddings, Models, FIM,
  Moderation/classification, OCR, Files, Fine-tuning, Batch, Agents, Conversations, Libraries, Connectors,
  Audio); the main area shows a form matching that operation's parameters, prefilled with example values.
- **Settings** has two sections: *Appearance* (theme, colors, font family, text size, corner radius — persisted
  in `localStorage`, applied live via CSS variables) and *API* (default model / temperature / max tokens, key
  management, secret-field toggle).

## API key flow (consent-gated)

- No key is shipped in code and none is kept on the server.
- In **Settings → API** you first see the security note and a checkbox *"I have read and understand the security
  risks"*. The key input stays disabled until you check it; once checked, typing a key saves it **only in your
  browser** (sessionStorage by default; opt-in localStorage via "Remember key across sessions").
- The acknowledgment is **tied to the presence of the key value**: there is no separate stored flag. Deleting the
  key — via "Remove saved key", closing the browser (sessionStorage), clearing site data, or any other way the
  value disappears — implicitly revokes the acknowledgment, the checkbox reappears, and a new key requires a
  fresh acknowledgment. The acknowledgment checkbox itself cannot be deselected once a key is saved.
- The **"Enable secret form fields"** toggle is only enabled when a key is saved. Form API-key fields are disabled
  and empty (masked) otherwise; when enabled they are prefilled with the saved key (masked) and editable as a
  per-request override.
- Therefore a request can carry a key only if a key value is currently stored, and a value can only be stored
  behind a checked acknowledgment. If no key is saved, the main view shows a banner linking to the key setting,
  and sending is refused with an explanation.
- Note this is a **consent gate, not an access control**: you can always read/edit your own storage via devtools.

## Security model

The app's responsibility is to control what it can and to inform you about the rest:

- **Controlled by the app:** key never shipped in code, never sent to or stored on the server, never logged;
  server binds `127.0.0.1` only; CSP (`script-src 'self'`, `connect-src 'self' https://api.mistral.ai`,
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`); `nosniff` + `no-store` headers; secret
  fields masked and disabled by default; session-storage default for the key.
- **Disclosed, not mitigable by the app** (also stated in Settings → API): the key is visible in devtools/network
  traces by design (it is your own key); browser extensions, local malware, or other local processes can read
  browser storage or loopback traffic; if site data is cleared the key (and acknowledgment) is gone; a leaked key
  can incur billable usage and expose the prompts/documents you send. **Your mitigations:** use a least-privilege,
  revocable key (not a production key), rotate it if you suspect exposure, keep the app on localhost, and put TLS
  (e.g. a reverse proxy) in front if you ever expose it beyond localhost.

## Run locally

Requires Node.js ≥ 22.18 (the server runs as TypeScript directly via type-stripping — no build step for it).

```bash
# 1. Install dependencies (runtime: the Mistral SDK; dev: sass/tsc/esbuild for the client build)
npm install

# 2. Build the client (SCSS → CSS, typecheck, bundle TS+SDK → public/js/app.js)
npm run build

# 3. Start the static server (no API key needed on the server)
npm start
```

Open <http://127.0.0.1:3000>, go to **Settings → API**, acknowledge the security note, and save your key.
`PORT=8080 npm start` changes the port; `HOST=0.0.0.0 npm start` would expose it on the network (not recommended).

## Project layout

```
server.ts                  # static file server only: 127.0.0.1 binding, CSP/nosniff/no-store headers
src/shared/operations.ts   # catalog of all API operations + form fields (bundled into the client)
src/shared/types.ts        # shared types (Operation, Field, AppSettings)
src/client/app.ts          # UI: menu, forms, key/banner/toggle state, settings
src/client/executor.ts     # maps each operation to the SDK call (runs in the browser, key from Settings)
src/client/store.ts        # prefs (localStorage) + API key (sessionStorage/localStorage, ack-tied)
src/client/styles.scss     # styles with CSS variables for live theming (compiled to public/styles.css)
public/index.html          # app shell (API view + Settings view + <noscript> warning)
```
