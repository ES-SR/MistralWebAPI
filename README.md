# Web API Playground

A minimal, zero-dependency, framework-free web UI for exploring LLM and REST APIs (**Mistral AI**, **OpenAI / OpenAI-Compatible**, **Anthropic**, **Google Gemini**, and custom **OpenAPI 3.x / Swagger** specifications) directly from your browser.

**Architecture:**
- **Static Server ([`server.ts`](server.ts)):** Serves only static files from `public/` (bound to `127.0.0.1:3000` by default, with `Content-Security-Policy`, `nosniff`, and `no-store` headers). **Your API keys never touch the server** — they are entered in Settings, stored only in your browser (`sessionStorage` by default, or opt-in `localStorage`), and attached to requests directly by your browser.
- **Zero Build / Zero Dependencies:** Uses native browser ES modules (`public/js/*.js`) and native CSS with selector nesting and CSS custom properties (`public/styles.css`). No `npm install`, bundler, or preprocessor step is required.
- **Declarative HTTP + SSE Engine ([`public/js/executor.js`](public/js/executor.js)):** Replaces SDK-specific switch statements with a unified `fetch` + Server-Sent Events (SSE) executor that handles path parameters, query strings, JSON bodies, multipart file uploads, cURL generation, and live streaming text extraction.

## Features

- **Built-in API Providers:**
  - **Mistral AI** (`https://api.mistral.ai` — Chat, Embeddings, Models, FIM, Moderation & Classification, OCR, Files, Fine-tuning, Batch, Agents, Conversations, Libraries, Connectors, Audio).
  - **OpenAI / OpenAI-Compatible** (`https://api.openai.com` or custom Base URL for Ollama, vLLM, Groq, OpenRouter, DeepSeek — Chat, Responses API, Embeddings, Models, Images, Audio, Moderations, Files, Batches).
  - **Anthropic** (`https://api.anthropic.com` — Messages, Streaming, Token Counting, Models, Message Batches).
  - **Google Gemini** (`https://generativelanguage.googleapis.com` — GenerateContent, StreamGenerateContent, CountTokens, EmbedContent, Models).
- **OpenAPI 3.x / Swagger Import ([`public/js/openapi.js`](public/js/openapi.js)):**
  - Paste an OpenAPI JSON spec, upload a `.json` file, or fetch from a URL in **Settings → Providers & OpenAPI** to automatically generate grouped sidebar menus and typed request forms for any REST API.
- **User-Controlled Layout & CSS Variables:**
  - Choose where the **Response panel** sits (`Top` above the form by default, `Bottom`, `Left` split, or `Right` split).
  - Choose where the **Sidebar** (`Left` or `Right`) and **Form action bar** (`Top`, `Bottom`, or `Both`) sit.
  - Every color, font stack, text size, line height, padding, gap, width, and border radius is backed by a CSS custom property and adjustable live in **Settings → Appearance & Layout**.
- **Point-of-Use Controls & State Preservation:**
  - Switching between operations or Settings preserves your form drafts and responses in memory.
  - Response panel switches between **Raw JSON**, **Extracted / Text**, and **Request & cURL**, with one-click Copy, Clear, and in-flight Cancel.

## Configuration & Running Locally

Server defaults are stored in [`config.conf`](config.conf) in plain-text `Key = Value` format (no environment variables required):

```ini
Host = 127.0.0.1
Port = 3000
```

Start the static server directly with Node (no `npm install` or build step needed). CLI flags follow the `@args:parse` style (case-insensitive, supporting `--flag value`, `flag=value`, or short flags) and override `config.conf`:

```bash
node server.ts                                    # reads ./config.conf (default: http://127.0.0.1:3000)
node server.ts Port=8080                          # custom port (or -p 8080, --port 8080)
node server.ts Port=0                             # random free OS-assigned port
node server.ts HostAddress=127.0.0.1 Port=3000    # explicit bind address (or -ha, --host-address)
node server.ts ConfigurationFile=./my.conf        # custom Key=Value config file (or -cf, --configuration-file)
node server.ts Help                               # show CLI options (or -h, --help)
```

Or use [`install.zsh`](install.zsh) (the `@webAPI` Zsh CLI tool powered by `@args:parse` from `ES-SR/ZshTools`) or [`install.sh`](install.sh) (Bash):

```zsh
./install.zsh Install              # interactively prompt (via vared) for repo & XDG/$path wrapper dir
./install.zsh Start Port=8080      # start background server and record state in XDG runtime/state dir
./install.zsh Status               # check running server PID and URL
./install.zsh Stop                 # stop background server

# Loopback Web-Terminal Bridge (never touches or transmits API keys):
./install.zsh BridgeState                                          # inspect connected browser tabs & active op
./install.zsh Select mistral chat.complete                         # switch provider & operation in the browser UI
./install.zsh Fill model=mistral-small-latest temperature=0.3      # populate form fields in the browser UI
./install.zsh Send mistral:chat.complete model=mistral-small-latest --extract content
./install.zsh BridgeResponse --extract content id                  # fetch latest browser response & extract keys
./install.zsh Listen                                               # stream live SSE events from the bridge
./install.zsh Extract content id < response.json                   # extract Key=Value pairs from JSON without jq
```

> **Security note on `--host`:** The server defaults to loopback (`127.0.0.1`). If you bind to a non-loopback interface (e.g. `0.0.0.0` or a LAN IP), the server logs a warning — always place a TLS reverse proxy in front if exposing beyond localhost.

Open <http://127.0.0.1:3000>, select your provider, go to **Settings → API & Keys**, acknowledge the security note, and save your API key.

## CI & Smoke / Unit Tests

A GitHub Actions workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs automatically on every pull request and every push to `trunk`. It runs `npm run smoke` ([`scripts/smoke.mjs`](scripts/smoke.mjs)), which:

1. Syntax-checks [`server.ts`](server.ts) and every module under `public/js/` (`node --check`).
2. Unit-tests the built-in provider catalogs, `buildRequest` (path interpolation, `snake_case` conversion, `bodyRoot` flattening, auth headers, and API key masking in cURL output), SSE stream text extraction, and the OpenAPI 3.x schema importer (`parseOpenApiSpec`).
3. Boots [`server.ts`](server.ts) on an ephemeral OS-assigned port (`--port 0`), waits for the stdout readiness event, and verifies all static assets, security headers (`Content-Security-Policy`, `nosniff`, `no-store`), `405` method restrictions, `/api/*` `404`, and path-traversal blocking.

To run the full suite locally at any time (no install required):

```bash
npm run smoke
```

## Project Layout

```
server.ts                        # Dependency-free static HTTP server (127.0.0.1:3000 default, --port/--host CLI)
scripts/smoke.mjs                # Zero-dependency syntax, unit, and live HTTP smoke test suite
public/index.html                # App shell (Sidebar, API workspace, Settings sections)
public/styles.css                # Native CSS with nesting and runtime CSS custom properties
public/js/app.js                 # UI controller, menu, form builder, state caching, settings wiring
public/js/executor.js            # Declarative fetch + SSE executor, cURL builder, stream extractor
public/js/openapi.js             # OpenAPI 3.x / Swagger 2.0 JSON schema importer
public/js/store.js               # Settings persistence, per-provider key management, custom providers
public/js/providers/index.js     # Built-in provider registry
public/js/providers/helpers.js   # Declarative operation and field builders
public/js/providers/mistral.js   # Mistral AI operation catalog
public/js/providers/openai.js    # OpenAI / OpenAI-compatible operation catalog
public/js/providers/anthropic.js # Anthropic operation catalog
public/js/providers/gemini.js    # Google Gemini operation catalog
```
