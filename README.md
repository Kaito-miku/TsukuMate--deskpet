<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/Inference-Local%20%7C%20OpenAI%20Compatible-7c6cf2" alt="Local or OpenAI-compatible API">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey" alt="Platform">
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  An open-source AI desktop companion that chats, remembers, reacts to emotion, and follows your coding-agent progress.
</p>

---

## Highlights

> **Development status:** TsukuMate is under active development. This README is an initial draft and interfaces may still change.

- **Bring your own model service** — connect a self-hosted local service or one of several saved OpenAI Chat Completions-compatible API profiles.
- **Personas and memory** — manage multiple personas, daily chat history, scheduled daily journals, AI-created special journals, and explicit “remember this” notes.
- **Sprite and Live2D pets** — transparent, resizable pets with clicks, dragging, system actions, compound reactions, and persistent moods.
- **Private screen context** — explicitly select a display and attach one in-memory screenshot to the next vision request only.
- **Codex task card** — show real task and tool activity from existing Codex hooks and session events.
- **Desktop controls** — use the quick launcher, do-not-disturb mode, Apple Music controls, and configurable shortcuts.
- **Local-first storage** — conversations and journals stay in the app data directory; API keys are encrypted with Electron `safeStorage`.

## Getting Started

### System Requirements

| Item | Recommended |
| --- | --- |
| macOS | 14.0+, Apple Silicon (M1/M2/M3/M4), about 2 GB disk space |
| Windows | x64 with Vulkan support, about 2 GB disk space |
| Network | Required on first launch unless you already have a local model file |

> macOS Apple Silicon is the primary tested platform. A Windows installer is also available — feedback is welcome.

### Installation

**macOS**

1. Go to [Releases](https://github.com/Kaito-miku/TsukuMate--deskpet/releases) and download the latest `TsukuMate-*-arm64.dmg`.
2. Open the DMG and drag **TsukuMate** into `Applications`.
3. Launch the app and follow the setup guide.

If macOS blocks the first launch, right-click the app and choose **Open**. If needed, remove the quarantine flag:

```bash
xattr -cr /Applications/TsukuMate.app
```

**Windows**

1. Go to [Releases](https://github.com/Kaito-miku/TsukuMate--deskpet/releases) and download the latest `.exe` installer.
2. Run the installer and complete the wizard.
3. Launch the app and follow the setup guide.

### First Launch

Open **Settings → Model Connections**, then add a local service that you
operate yourself or a remote OpenAI Chat Completions-compatible endpoint.
Enter its complete Chat Completions URL and model name. API Key is optional
for services that do not require authentication.

## Features

### Chat With Your Desktop Pet

Use the floating chat bubble with your selected local or remote model service.

Useful shortcuts (macOS uses `Cmd`, Windows uses `Ctrl`):

- `Cmd/Ctrl+Shift+M` — open or close the chat bubble
- `Cmd/Ctrl+Shift+T` — show or hide thinking mode
- `Esc` — close the bubble when input is focused

### Reactions While You Work

TsukuMate can stay beside your workspace and react to coding-agent activity: thinking, working, finishing tasks, waiting for attention, or going idle.

### Model Connections

The model and API settings let you:

- connect a self-hosted local model service
- save multiple OpenAI-compatible API profiles and select one
- configure the endpoint, model name, and encrypted API key
- test the active connection

### Personas

Create and switch between persona prompts from the dedicated Persona settings page.

### Journals

TsukuMate writes a regular daily journal at the configured local time. You can
also ask it to preserve an important event, commitment, goal, decision, or
turning point as a separate **Special Diary** with natural language or
`/diary [focus]`. Special diaries are stored locally, can be edited or deleted
from the Journal drawer, and contribute only compact local summaries to later
relevant conversations.

## Roadmap

- Broader Linux validation.
- More persona presets.
- Clearer model connection diagnostics and compatibility guidance.
- Faster first launch and smaller app footprint.
- Richer desktop-pet narration for long-running coding sessions.

## Known Limitations

- The primary tested release target is macOS Apple Silicon. Windows is supported with a bundled installer; report issues if something does not work on your setup.
- Remote services require network access; a localhost service can work offline once you have installed it yourself.
- Response speed depends on your chip, memory pressure, and selected model.
- Coding-agent reactions depend on each tool's integration behavior and may vary by version.

## Developer Notes

For development setup, packaging, and repository layout, see [`docs/development.md`](docs/development.md).

## Acknowledgments

- Desktop pet UI is based on [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk). Full attribution is listed in [`NOTICE.md`](./NOTICE.md).
- Users are responsible for the licenses and terms of models they connect.
- The bundled neko persona uses the **neko30k** dataset ([liumindmind/NekoQA-30K](https://huggingface.co/datasets/liumindmind/NekoQA-30K)) for fine-tuning data.

## License

This repository is distributed under [GNU AGPL-3.0-only](./LICENSE).

TsukuMate is a derivative work based on [OpenBMB/MiniCPM-Desk-Pet](https://github.com/OpenBMB/MiniCPM-Desk-Pet) and [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk), modified and maintained by Kaito-miku and contributors. The complete source code for this maintained version is available at [Kaito-miku/TsukuMate--deskpet](https://github.com/Kaito-miku/TsukuMate--deskpet). Upstream copyright notices and attribution are preserved in [`NOTICE.md`](./NOTICE.md).

Models connected by users, artwork, third-party code, and datasets keep their own license terms. See [`NOTICE.md`](./NOTICE.md) and [`tsukumate/NOTICE.md`](tsukumate/NOTICE.md) for components distributed with this repository.
