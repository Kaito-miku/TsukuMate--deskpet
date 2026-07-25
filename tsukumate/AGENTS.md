# AGENTS.md

This file is the entry point for coding agents working in this repository. Keep it short and operational. Deep background lives in `docs/project/`.

## Project Overview

TsukuMate 是一个 Electron 桌宠：通过 hook、日志轮询、plugin 和 extension 感知 AI coding agent 的工作状态，并播放桌宠动画。当前支持 Claude Code、Codex CLI、Copilot CLI、Gemini CLI、Antigravity CLI (agy)、Cursor Agent、CodeBuddy、Kiro CLI、Kimi Code CLI (Kimi-CLI)、Qwen Code、CodeWhale、opencode、Pi、OpenClaw、Hermes Agent、Qoder、Reasonix；支持内置与用户主题、Live2D 以及本地/API 模型连接；平台覆盖 Windows、macOS、Linux。

## Common Commands

```bash
npm start
npm run build
npm run build:win:x64
npm run build:win:arm64
npm run build:win:all
npm run build:mac
npm run build:linux
npm run build:all
npm install
npm test
npm run create-theme

npm run install:claude-hooks
npm run uninstall:claude-hooks
npm run install:cursor-hooks
npm run install:gemini-hooks
npm run install:antigravity-hooks
npm run install:kiro-hooks
npm run install:kimi-hooks
npm run install:qwen-hooks
npm run install:codewhale-hooks
npm run uninstall:codewhale-hooks
npm run install:pi-extension
npm run uninstall:pi-extension
npm run install:openclaw-plugin
npm run uninstall:openclaw-plugin
npm run install:hermes-plugin
npm run uninstall:hermes-plugin
npm run install:qoder-hooks
npm run uninstall:qoder-hooks
npm run install:reasonix-hooks
npm run uninstall:reasonix-hooks
npm run install:codex-hooks
npm run uninstall:codex-hooks
npm run install:codex-debug-hooks
npm run uninstall:codex-debug-hooks
node hooks/codebuddy-install.js
node hooks/opencode-install.js

bash scripts/remote-deploy.sh user@host
bash test-demo.sh [seconds]
bash test-mini.sh [seconds]
bash test-macos.sh
bash test-oneshot-gate.sh [state] [seconds]
```

新安装默认只把 Claude Code 和 Codex 标记为已安装并启用；其他 agent 默认未安装、未启用。正常启动时，Clawd 只会为 `integrationInstalled=true` 且 `enabled=true` 的 agent 自动同步 Claude / Codex / Copilot / Gemini / Antigravity / Cursor / CodeBuddy / Kiro / Kimi / Qwen / CodeWhale / Qoder / Reasonix hooks、opencode / OpenClaw / Hermes plugins 和 Pi extension。Settings Agent 页的 Install 会安装并启用该集成；Uninstall 会卸载 Clawd 管理的 hook/plugin/extension，并同时把该 agent 设为未安装、未启用。单独关闭 enabled 只会跳过启动同步并屏蔽事件/权限入口，不卸载用户已有 hooks / plugins / extensions；重新启用未安装 agent 只打开事件入口，不会写本机集成文件。手动安装命令主要用于调试、重装或远程部署。
Copilot CLI 同步走 `<COPILOT_HOME 或 ~/.copilot>/hooks/hooks.json`，marker-based 增量合并只接管含 `copilot-hook.js` 标记的条目，用户其他 entry / 其他 `hooks/*.json` 文件原样保留；hooks.json 或 `settings.json` 顶层 `disableAllHooks: true` 时 doctor 报 warning（不挂 Fix 按钮）。详见 `docs/guides/copilot-setup.md`。

## Read These Docs

- `docs/project/project-introduction.md`：5 分钟了解项目定位、状态映射和目录结构
- `docs/project/agent-runtime-architecture.md`：集成方式、数据流、多 agent、permission bubble、opencode、终端聚焦、自动同步
- `docs/project/project-architecture.md`：更完整的模块边界和启动/运行时分层
- `docs/project/theme-state-ui.md`：状态机、主题系统、settings、mini mode、素材规则、平台限制、待落地 UI 决策
- `docs/project/release-process.md`：发版 checklist、release note 核对、tag 触发 GitHub 打包和资产确认
- `docs/guides/copilot-setup.md`：Copilot CLI 自动同步说明、`COPILOT_HOME` 兼容性、手动配置备选模板
- `docs/guides/state-mapping.md`：状态 → 动画权威表
- `docs/guides/guide-theme-creation.md`：主题作者指南
- `docs/guides/setup-guide.md`：安装、远程 SSH、各 agent 接入
- `docs/guides/known-limitations.md`：用户向已知限制
- `docs/guides/codex-wsl-clarification.md`：Codex / WSL 路径与 Node 说明

## Runtime Summary

- 事件主路径：hook / log monitor → `src/main/sessions/server.js` → `src/main/core/state.js` → IPC → `src/renderer/pet/renderer.js`
- 桌宠采用双窗口模型：渲染窗口只负责显示；输入窗口负责 pointer 事件和拖拽
- 多会话 UI 主路径：`src/main/core/state.js` 生成 session snapshot → Dashboard / Session HUD；HUD 贴近桌宠显示当前 live session，Dashboard 负责详情、别名和跳转终端
- `src/main/sessions/server.js` 启动后会为已安装且已启用的 agent 异步同步缺失 hooks / plugins；Codex official hooks 为 primary，JSONL 轮询保留为 fallback
- `src/main/sessions/server.js` 只在 Claude Code 已安装、已启用且 `manageClaudeHooksAutomatically` 打开时 watch `~/.claude/settings.json`，并在 hook 被抹掉时自动重装
- `src/main/integrations/agents/agent-gate.js` 控制各 agent 的安装意图、启用状态、权限气泡开关和 wait-for-input notification 子开关
- 设置系统主链路是 `src/main/settings/prefs.js` → `src/main/settings/settings-controller.js` → `src/main/settings/settings-store.js`，写入 side effects 收敛在 `src/main/settings/settings-actions.js`
- 启动时还会尝试自动安装 VS Code / Cursor terminal-focus extension，并初始化 updater
- 远程场景依赖 Settings Remote SSH runtime / deploy 路径、`scripts/remote-deploy.sh` CLI 备选和 SSH 反向端口转发

## Core Files

更细的背景见 `docs/project/agent-runtime-architecture.md` 和 `docs/project/theme-state-ui.md`。

| File | Responsibility |
|------|------|
| `src/main/index.js` | Electron composition root，窗口、IPC、生命周期和上下文组装 |
| `src/main/paths.js` | 应用、renderer、preload 及顶层资源的统一绝对路径 |
| `src/main/core/` | 桌宠状态机、tick、mini、菜单和运行时协调 |
| `src/main/windows/` | BrowserWindow 创建、定位与生命周期 |
| `src/main/chat/` | 聊天运输、人格、时间上下文与屏幕截图 |
| `src/main/settings/` | 偏好 schema、store、controller、actions 和 Settings IPC |
| `src/main/sessions/` | HTTP 状态服务、session IPC、路由和聚焦交接 |
| `src/main/theme/` | 主题加载、运行时、资源和动画周期 |
| `src/main/integrations/` | Agent、Codex Pet、Telegram、Remote SSH、Apple Music 等外部集成 |
| `src/main/platform/` | macOS / Windows / Linux、任务栏、登录启动与系统唤醒 |
| `src/main/diagnostics/` | doctor、报告与集成检测器 |
| `src/renderer/<surface>/` | 每个窗口的 HTML / CSS / renderer 脚本；Settings tabs 在 `renderer/settings/tabs/` |
| `src/renderer/shared/live2d/` | 多窗口共用的 Live2D 浏览器启动与 bundle |
| `src/preload/` | 按页面命名的受限 IPC bridge |
| `src/shared/` | 无 Electron / DOM 依赖的情绪、主题、session、settings、i18n 与工具算法 |
| `agents/registry.js` | agent 注册表 |
| `agents/codex-log-monitor.js` | Codex JSONL fallback 轮询 |
| `agents/gemini-log-monitor.js` | legacy Gemini session JSON 轮询器；当前 Gemini hook-only 路径不启动 |
| `hooks/clawd-hook.js` + `hooks/copilot-hook.js` | Claude Code / Copilot CLI 状态上报脚本 |
| `hooks/install.js` | Claude hook 注册 / 卸载 |
| `hooks/auto-start.js` | Claude `SessionStart` 自动拉起 Clawd 的 hook |
| `hooks/codex-hook.js` / `hooks/codex-install.js` | Codex official hooks 状态与权限审批、安装 / 卸载 |
| `hooks/cursor-install.js` / `gemini-install.js` / `antigravity-install.js` / `kiro-install.js` / `kimi-install.js` / `qwen-code-install.js` / `codewhale-install.js` / `codebuddy-install.js` / `opencode-install.js` / `pi-install.js` / `openclaw-install.js` / `hermes-install.js` / `qoder-install.js` / `reasonix-install.js` | 各 agent 集成安装逻辑 |
| `hooks/qoder-hook.js` | Qoder state-only 状态上报脚本（Phase 1，stdout 恒为 `{}`） |
| `hooks/codex-remote-monitor.js` | 远程 Codex JSONL 轮询并通过 SSH 隧道回传 |
| `extensions/vscode/extension.js` | VS Code / Cursor 终端 tab 聚焦辅助扩展 |

## Constraints

- Claude Code / CodeBuddy 的阻塞式权限审批走 `POST /permission` HTTP hook；普通状态事件走 command hook
- Codex 的阻塞式权限审批走 official `PermissionRequest` command hook：hook 脚本长连接 `POST /permission`，只允许 stdout 返回 sanitized `behavior/message`，`updatedInput` / `updatedPermissions` / `interrupt` 必须 omit
- hook 脚本只允许依赖 Node 内置模块，以及同目录的 `server-config.js`、`shared-process.js`、`json-utils.js`、`codex-subagent-fields.js`
- hook 脚本需要稳定终端 PID 时，必须走 `getStablePid()` 进程树解析；不要用 `process.ppid` 做简化替代
- opencode 权限不走 `permission.ask` hook，而是 event hook + reverse bridge
- Pi 通过 `~/.pi/agent/extensions/clawd-on-desk` 的 global extension 推送状态；Clawd 对 Pi 是 **state-only**，不接管权限、不弹权限气泡，也不把 Pi 的默认 YOLO 流程改成手动确认
- OpenClaw 通过 `~/.openclaw/openclaw.json` plugin 路径做 state-only 集成；Phase 1 不做 permission bubble / terminal focus，主要支持本地 `openclaw tui --local`
- Antigravity CLI (agy) 通过 `~/.gemini/config/hooks.json` 做 **state-only** hook 集成（PreInvocation / PostToolUse / PostInvocation / Stop），**不注册 PreToolUse**。agy LLM 会主动调内置 `ask_permission` 工具，触发 agy 自己的 5 选项 native menu（含 "Persist to settings.json" 持久白名单），Clawd 不插手权限决策也不双层确认。`agents/antigravity-cli.js` `capabilities.permissionApproval` / `interactiveBubble` 均为 false。
- Qwen Code 通过 `~/.qwen/settings.json` 做 hook-only 集成（SessionStart / SessionEnd / UserPromptSubmit / PreToolUse / PostToolUse / Stop / Notification / PermissionRequest），支持状态与阻塞式 `PermissionRequest` 权限气泡；`disableAllHooks: true` 时注册条目不会触发。
- Qoder 通过 `~/.qoder/settings.json` 做 **state-only** hook 集成（Phase 1：SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / PostToolUseFailure / Stop / Notification / PermissionRequest / PermissionDenied / SessionEnd）。Clawd 只把 `PermissionRequest` / `PermissionDenied` 当 notification 观察，**不替 Qoder 做权限决策**，hook stdout 恒为 `{}`，由 Qoder 原生权限流程接管；`agents/qoder.js` 的 `capabilities.permissionApproval` / `interactiveBubble` 均为 false。Windows 命令走 PowerShell `-EncodedCommand` 包装（与 Qwen / Antigravity 同款 cmd 引号剥离规避）。session id 命名空间是 `qoder:<raw>`；启动恢复只认 CLI 进程 `qodercli` / `qoder-cli`，不认 IDE 进程 `qoder.exe`。真实 Qoder CLI/IDE smoke 尚未完成。
- HTTP 服务端口范围固定为 `127.0.0.1:23333-23337`；运行时端口写入 `~/.clawd/runtime.json`
- Remote SSH 的远端 Node 探测要求 Node >= 14；`scripts/remote-deploy.sh` 与 `src/main/integrations/remote-ssh/remote-ssh-node.js` 的 probe 顺序、候选路径、版本判断和输出字段必须保持行为对齐
- 注册 Claude Code hook 时只能追加，不能覆盖用户已有 hook 数组
- Copilot CLI hooks 走按需自动同步：`hooks/copilot-install.js` 在本地启动仅当 Copilot CLI 已安装且已启用时调用；`scripts/remote-deploy.sh --remote` 仍会在远端部署路径里调用。路径解析尊重 `COPILOT_HOME` env（trimmed 非空才生效，否则 fallback 到 `~/.copilot`）；`hooks/copilot-hook.js` 的 session-state resolver 同样走 env
- 禁用 agent 不应卸载 hooks / plugins / extensions：只停止对应 monitor、清理 session / bubble、让 HTTP hook 入口快速 fallback；重新启用未安装 agent 不触发本机 integration sync。卸载集成必须走 Settings Agent 页的 Uninstall / 对应 uninstall 命令，并同时清掉 `integrationInstalled`
- Kiro 的 `sessionId="default"` 会复用；session alias key 必须按 cwd scope 区分，同时保留旧 `local|kiro-cli|default` 只读 fallback
- Windows NSIS release 必须产出明确架构的 x64 / ARM64 安装包：`win.artifactName` 保留 `${arch}`，`nsis.buildUniversalInstaller` 保持 `false`
- 主进程资源路径必须从 `src/main/paths.js` 导出的 root 解析，不得假定调用文件仍在 `src/` 根目录
- 依赖方向限定为 `main/preload/renderer → shared`；`shared` 不得引入 Electron、DOM 或具体窗口，renderer 不得引入 main 或 Node 系统模块
- 需要编辑发布素材时，先复制到 `assets/source/` 再改，不要直接改工作素材来源不明的文件
- `assets/source/cloudling-pointer-bridge/` 是 Cloudling 指针桥素材的保留源文件目录；运行时逻辑已内联进主题 SVG，不要把这个 source 目录当临时文件清理
- 主题状态、sleep/DND、mini mode、状态映射的细节在 `docs/project/theme-state-ui.md`
- Settings 体系里，store 是唯一真相，controller 是唯一写入者；不要绕开 `settings-controller.js`

## Testing

- 自动化测试使用 Node 内置 test runner：`npm test`
- 测试按 `test/main|renderer|preload|shared|integrations|packaging` 分类，`test/helpers|fakes|fixtures` 不会被当作测试直接执行；`npm test` 递归发现 `test/**/*.test.js`
- 当前开发环境是 Windows-first；macOS 特定路径无法在这里手动 QA，改到 mac 逻辑时要用 code-review-first 的方式说明行为变化和残余风险
- 涉及 Claude Code hook payload 的改动（尤其 `/permission`、`permission_suggestions`、`updatedPermissions`、elicitation 输入）至少用一次真实 Claude Code 验证；`curl` 自编 payload 不够
- 透明窗口、托盘、真实拖拽、跨平台前台聚焦等 Electron 行为仍以手动验证为主

## High-Risk Gotchas

- `hitWin.focusable = true` 是修复 Windows 拖拽 bug 的关键，不要轻易改回去
- `miniTransitioning` 期间，所有窗口定位路径都必须先检查保护标志，否则 `setPosition()` 可能并发崩
- DND 会屏蔽 hook 事件并压住 bubble，但**不应替用户做权限决定**：opencode 走 silent drop 回到 TUI 提示，Claude Code / CodeBuddy 走断连回到内置聊天/终端确认，Codex official hook 走 no-decision `{}` 回到原生审批提示；Pi 是 state-only，不进入权限审批链路
- 隐藏桌宠（petHidden）≠ 免打扰：隐藏只收起宠物/HUD/update bubble/当时 pending 的权限气泡，**隐藏期间新到的权限请求仍照常弹气泡，这是有意设计、不要当 bug 修**；要静默权限气泡走 DND（见上条）。详见 `docs/project/theme-state-ui.md` State Machine 节
- Session HUD 显示所有非 headless、非 sleeping 的 live session，包括 badge=Done 的 idle session；不要再按 `state !== "idle"` 过滤，否则完成后的 Claude Code 会话会从 HUD 消失
- update bubble 跟随桌宠时要同时避让 Session HUD 和 permission stack；permission bubble 增删、测高、deny-and-focus 后都要触发 update bubble 重排
- `mini-working` 是可选主题能力，缺失时必须优雅降级
- `contextMenuOwner` 必须保留 `parent: win`；配合 `closable:false` 才不会把退出流程卡死
- Windows 前台窗口锁依赖 ALT trick + `koffi` FFI；相关回归通常不是单点逻辑 bug
- `~/.claude/settings.json` 的 hook 恢复 watcher 必须盯目录而不是文件；原子替换会让文件级 watch 在 Windows 上静默失效
- Claude watcher 必须同时受 `manageClaudeHooksAutomatically`、`claude-code.integrationInstalled` 和 `claude-code.enabled` 保护；不要让未安装或禁用 Claude Code 后的 watcher 重新写回 hooks
- opencode 的 `permission.ask` hook 目前不可用，权限只能走 event hook + bridge
- Codex CLI official hooks 已接入；JSONL 轮询仍是 fallback，用于 hook 不可用、hook 未覆盖事件（如 WebSearch / compaction / abort）和历史兼容。Windows command 必须用 PowerShell `& "node" ...` 格式，裸 `"node" "hook.js"` 会 exit 1
- Kiro 没有 global hooks，只能注入到 `~/.kiro/agents/*.json`
- `src/renderer/pet/renderer.js` 里给 `<img>` SVG 追加的 `?_t=` cache-bust query 不能删；Chromium 会复用同 URL SVG 的动画时间线，一次性动画会停在末帧

## Do Not Revisit

Language 子菜单底部截断是 Electron 透明窗口 + Windows DWM 的底层兼容问题。不要再尝试通过切换 `alwaysOnTop`、透明窗策略或 JS 菜单布局修它。
