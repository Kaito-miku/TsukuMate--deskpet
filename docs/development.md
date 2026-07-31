# TsukuMate development

## Development log

### 2026-07-31 — journals and workspace refinement

- Added independently stored AI special diaries alongside the existing scheduled daily journal. AI can record important goals, commitments, decisions, experiences, persistent preferences, and emotional turning points; users can force recording with natural language or `/diary [focus]`.
- Added local special-diary index/content storage, constrained workspace IPC, diary-memory summaries for later relevant responses, and a persistent in-chat special-diary receipt.
- Updated the workspace journal drawer with separate regular/special journal tabs, edit/delete support for special diaries, and a compact two-row drawer header.
- Refined hierarchy/network workspace behavior and the TsukuMate moon wordmark in the tool rail during the same working session.
- Validation: focused conversation-store and chat-workspace tests passed. A full `npm test` run remains blocked by the existing long-running `mobile-preview-server.test.js` and unrelated Settings CSS assertions; no local journals, API keys, personas, or other user data are tracked in Git.

TsukuMate is an Electron application. It does not bundle, download, or launch
an inference runtime. During development, connect it to a local or remote
OpenAI Chat Completions-compatible service from **Settings → Model
Connections**.

## Run

```bash
cd tsukumate
npm install
npm start
```

If Electron downloads slowly:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Test

```bash
cd tsukumate
npm test
```

## Local compatible service

Create a model-service profile using a complete Chat Completions URL, for
example `http://127.0.0.1:11434/v1/chat/completions`, and enter the model name
exposed by that service. API Key is optional for localhost services. TsukuMate
does not manage model files, devices, adapters, or the service process.

## Privacy

Secrets are encrypted by Electron `safeStorage`. Do not commit user-data
directories, chat history, journals, screenshots, model files, or credentials.

## Packaging

Electron Builder packages only the desktop client and the separately licensed
remote-control helper used by its optional integrations. No inference engine,
model weights, or LoRA adapters are included.
