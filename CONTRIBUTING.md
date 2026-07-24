# Contributing to TsukuMate

Thanks for your interest in this project. This file is the operational
entry point for developers; deeper background lives in
[docs/development.md](docs/development.md) and
[tsukumate/AGENTS.md](tsukumate/AGENTS.md).

> The Electron desktop pet layer (`tsukumate/`) is a vendored fork of
> [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk)
> and is governed by the same AGPL-3.0-only license. When touching code
> under `tsukumate/`, please keep the upstream coding conventions and
> avoid unnecessary divergence — see [`NOTICE.md`](./NOTICE.md) for the
> exact upstream commit we forked from.

> Looking to just use the app? Grab a prebuilt installer from
> [Releases](https://github.com/Kaito-miku/TsukuMate--deskpet/releases). This
> document is only relevant if you plan to modify the code.

## Quickstart (dev mode)

```bash
git clone git@github.com:Kaito-miku/TsukuMate--deskpet.git
cd TsukuMate--deskpet

./go.sh start     # install Node dependencies when needed, then launch Electron
./go.sh test      # run the Node test suite

# Or out a packaged installer (mac arm64 dmg):
./go.sh build
```

Configure a complete OpenAI Chat Completions-compatible URL and model name in
the app. Localhost services may omit the API Key. The project does not manage
model files or launch an inference process.

## Repository layout

```
TsukuMate--deskpet/
├── tsukumate/          Electron desktop client
├── docs/               Developer and release documentation
├── skills/             Optional integration skills
└── go.sh               One-shot dev launcher + build entry point
```

## Tests

Before opening a PR, run the test suite:

```bash
cd tsukumate && npm test
```

If you change CI workflows under `.github/workflows/`, run them via
`workflow_dispatch` on your fork to verify before merging.

## Commit style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: ...` — new user-visible feature
- `fix: ...` — bug fix
- `refactor: ...` — non-functional code change
- `chore: ...` — tooling, dependencies, build, docs
- `docs: ...` — documentation only

Scope is optional, e.g. `feat(models): add connection validation`.

## Pull request checklist

- [ ] Branch is based on the latest target branch
- [ ] `npm test` passes locally
- [ ] If you touch model connections or packaging, please
      include a short test plan (commands run, platform verified) in
      the PR description
- [ ] No model weights, credentials, `node_modules`, or `dist/` artifacts
      committed

## Issue templates

See `.github/ISSUE_TEMPLATE/` (TBD) for bug-report / feature-request
forms. For now, please include:

- OS + architecture (e.g. macOS 14.5 / arm64)
- App version (from About menu) or git commit if running from source
- Steps to reproduce + observed vs expected behaviour
- Relevant log excerpts from
  `~/Library/Application Support/Clawd on Desk/logs/main.log` (macOS)
  or the equivalent on Linux/Windows

## License

By contributing, you agree that your contributions will be licensed
under the [AGPL-3.0-only](LICENSE) license that covers the project.
This matches the license of our upstream
[rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk),
so contributions touching `tsukumate/` remain compatible with
upstream contribution flows.
