# Web API Playground

A minimal, zero-dependency, framework-free web UI for exploring LLM and REST APIs (**Mistral AI**, **OpenAI / OpenAI-Compatible**, **Anthropic**, **Google Gemini**, and custom **OpenAPI 3.x / Swagger** specifications) directly from your browser.

**Architecture:**
- **Static Server ([`server.ts`](file:///home/mike/Projects/MistralWebAPI/server.ts)):** Serves only static files from `public/` (bound to `127.0.0.1` by default, with `Content-Security-Policy`, `nosniff`, and `no-store` headers). **Your API keys never touch the server** — they are entered in Settings, stored only in your browser (`sessionStorage` by default, or opt-in `localStorage`), and attached to requests directly by your browser.
- **Zero Build / Zero Dependencies:** Uses native browser ES modules (`public/js/*.js`) and native CSS with selector nesting and CSS custom properties (`public/styles.css`). No `npm install`, bundler, or preprocessor step is required.
- **Declarative HTTP + SSE Engine ([`public/js/executor.js`](file:///home/mike/Projects/MistralWebAPI/public/js/executor.js)):** Replaces SDK-specific switch statements with a unified `fetch` + Server-Sent Events (SSE) executor that handles path parameters, query strings, JSON bodies, multipart file uploads, cURL generation, and live streaming text extraction.

## Features

- **Built-in API Providers:**
  - **Mistral AI** (`https://api.mistral.ai` — Chat, Embeddings, Models, FIM, Moderation & Classification, OCR, Files, Fine-tuning, Batch, Agents, Conversations, Libraries, Connectors, Audio).
  - **OpenAI / OpenAI-Compatible** (`https://api.openai.com` or custom Base URL for Ollama, vLLM, Groq, OpenRouter, DeepSeek — Chat, Responses API, Embeddings, Models, Images, Audio, Moderations, Files, Batches).
  - **Anthropic** (`https://api.anthropic.com` — Messages, Streaming, Token Counting, Models, Message Batches).
  - **Google Gemini** (`https://generativelanguage.googleapis.com` — GenerateContent, StreamGenerateContent, CountTokens, EmbedContent, Models).
- **OpenAPI 3.x / Swagger Import ([`public/js/openapi.js`](file:///home/mike/Projects/MistralWebAPI/public/js/openapi.js)):**
  - Paste an OpenAPI JSON spec, upload a `.json` file, or fetch from a URL in **Settings → Providers & OpenAPI** to automatically generate grouped sidebar menus and typed request forms for any REST API.
- **User-Controlled Layout & CSS Variables:**
  - Choose where the **Response panel** sits (`Top` above the form by default, `Bottom`, `Left` split, or `Right` split).
  - Choose where the **Sidebar** (`Left` or `Right`) and **Form action bar** (`Top`, `Bottom`, or `Both`) sit.
  - Every color, font stack, text size, line height, padding, gap, width, and border radius is backed by a CSS custom property and adjustable live in **Settings → Appearance & Layout**.
- **Point-of-Use Controls & State Preservation:**
  - Switching between operations or Settings preserves your form drafts and responses in memory.
  - Response panel switches between **Raw JSON**, **Extracted / Text**, and **Request & cURL**, with one-click Copy, Clear, and in-flight Cancel.

## Run Locally

Start the static server directly with Node (no `npm install` or build step needed):

```bash
node server.ts
```

Or use `./install.sh --run` to pull/clone and start the server in the background.

Open <http://127.0.0.1:3000>, select your provider, go to **Settings → API & Keys**, acknowledge the security note, and save your API key.

## Project Layout

```
server.ts                        # Dependency-free static HTTP server (127.0.0.1, CSP/nosniff/no-store)
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
