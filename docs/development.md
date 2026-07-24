# TsukuMate development

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
