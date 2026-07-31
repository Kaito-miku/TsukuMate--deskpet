<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg" alt="AGPL-3.0-only"></a>
  <img src="https://img.shields.io/badge/Desktop-macOS%20%7C%20Windows-lightgrey" alt="macOS and Windows">
  <img src="https://img.shields.io/badge/Inference-Local%20%7C%20OpenAI%20Compatible-7c6cf2" alt="Local or OpenAI-compatible API">
</p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

<p align="center">
  一个会陪你聊天、记住重要事情，并对工作状态与情绪作出反应的开源 AI 桌宠。
</p>

> [!IMPORTANT]
> TsukuMate 仍处于积极开发阶段。这是一份 README 初稿，部分界面、功能名称与安装方式可能继续调整。

## TsukuMate 是什么

TsukuMate 是一款基于 Electron 的桌面 AI 伙伴。它可以连接用户自行部署的本地模型服务，也可以连接 OpenAI Chat Completions 兼容 API。桌宠支持精灵主题与 Live2D 外观，并能显示聊天情绪、编程 Agent 状态和 Codex 实时任务进展。

所有对话记录、日记、人格及非敏感配置均保存在本机；API Key 使用 Electron `safeStorage` 加密，不会交给渲染页面。

## 主要功能

### 对话与记忆

- 用户自备的本地模型服务与 OpenAI 兼容 API 两种连接方式。
- 保存多套 API 配置，并选择其中一套作为当前服务。
- 多人格管理，可为每个人格配置独立提示词。
- 按天保存聊天记录、平常日记、AI 特殊日记与“记住这件事”形成的长期笔记。
- 平常日记按设置时间自动整理当天对话；输入“帮我记一篇日记”或 `/diary [重点]` 可让 AI 建立独立的特殊日记，并在后续相关对话中作为本地长期记忆参考。
- 在系统提示中注入当前日期与时间。
- API 模式下可经用户主动授权，截取指定显示器并附加到下一条视觉消息；截图不落盘，也不进入后续历史。
- 支持 Apple Music 控制与模糊歌曲搜索。

### 桌宠与 Live2D

- 精灵图主题和 Live2D 模型两种显示方式。
- 透明、置顶、可缩放、可拖动的桌宠窗口。
- 点击桌宠打开四宫格快捷菜单：问答、休眠（免打扰）、设置、关闭菜单。
- 点击、拖拽、思考、工作、完成、失败、睡眠等状态动作。
- 八维复合即时情绪识别，并通过 API 在后台校正。
- 独立的持续心情状态；即时反应结束后恢复当前心情，并可由后续互动缓解或化解。
- Live2D 使用主情绪选择动作，并通过连续 VAD 参数混合面部、视线与姿态。

### Codex 与编程 Agent

- 读取现有官方 hooks 与本地会话事件，不伪造进度。
- Codex 工作时自动显示实时任务卡，展示当前任务与最近工具活动。
- 支持 Claude Code、Codex 及多种可选 Agent 集成。
- 等待权限、工作、完成、失败等状态可驱动桌宠动作与提示。

## 安装

### 从源码运行

需要 Node.js 20+。首次安装 Electron 依赖需要联网。

```bash
git clone https://github.com/Kaito-miku/TsukuMate--deskpet.git
cd TsukuMate--deskpet/tsukumate
npm install
npm start
```

如果 Electron 下载速度过慢，可以临时使用 npm 镜像后重新安装：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

### 安装包

预构建版本将在 [GitHub Releases](https://github.com/Kaito-miku/TsukuMate--deskpet/releases) 提供。当前主要开发与验证平台为 macOS Apple Silicon；Windows 功能也在持续验证中。

## 初次使用

1. 启动 TsukuMate，点击桌宠打开快捷菜单。
2. 在“设置 → 模型与 API”中选择自己的本地模型服务或远程 API。
3. 填写兼容服务的完整 Chat Completions 地址、模型名；需要鉴权时再填写 API Key。
4. 在“人格”中选择或创建角色提示词。
5. 使用 `Cmd/Ctrl + Shift + M` 打开问答窗口，使用 `Cmd/Ctrl + Enter` 发送消息。

屏幕读取、外部 Agent 集成和 Apple Music 控制都需要用户主动启用；应用不会在未授权时持续读取屏幕。

## 数据与隐私

- 聊天记录、日记和笔记保存在应用的本地用户数据目录，可从设置页直接打开对应文件夹。
- 平常日记与特殊日记使用独立目录保存；特殊日记可在工作台日记抽屉的“特殊日记”标签中查看、编辑或删除。
- API Key 单独加密保存，设置页面只读取“已配置”状态，不回显明文。
- 屏幕截图仅保存在内存中，并只发送给当前启用的 API 服务一次。
- 使用远程 API 时，消息内容会发送到你配置的服务商，请自行阅读其隐私政策。
- 用户自行准备的本地模型、权重和服务配置不会提交到本仓库。

## 开发与测试

```bash
cd tsukumate
npm test
npm run build:live2d
```

开发说明见 [`docs/development.md`](docs/development.md)。提交问题前请避免附带 API Key、私人聊天记录、日记、模型文件或其他敏感数据。

## 当前限制

- 部分 OpenAI 兼容服务并不支持 SSE、视觉消息或标准字段，实际能力取决于服务商与模型。
- 屏幕理解需要所连接的服务和模型支持图像输入。
- Live2D 动作效果取决于模型本身提供的参数、表情和 motion 文件。
- Coding Agent 的可见进度受各工具 hook 与会话格式限制。
- 项目尚未承诺稳定配置格式，升级前建议备份本地数据。

## 路线图

- 完善 macOS 与 Windows 安装包和自动更新。
- 改进设置页面、首次启动流程与多语言文案。
- 继续优化复合情绪、持续心情与 Live2D 动作映射。
- 增强聊天记录、日记和记忆管理体验。
- 补充用户文档、贡献指南与隐私说明。

## 开源协议与归属

本仓库代码以 [GNU AGPL-3.0-only](./LICENSE) 发布。通过网络向用户提供修改后的程序功能时，也需要按照 AGPL 提供对应版本源码。

TsukuMate 是基于 [OpenBMB/MiniCPM-Desk-Pet](https://github.com/OpenBMB/MiniCPM-Desk-Pet) 与 [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 的二次开发版本，由 Kaito-miku 及贡献者修改和维护。完整版权和第三方归属见 [`NOTICE.md`](NOTICE.md) 与 [`tsukumate/NOTICE.md`](tsukumate/NOTICE.md)。

用户自行连接的模型及其权重、Live2D 模型、美术资源、字体和其他第三方素材可能适用各自独立协议；AGPL 代码许可不自动授予这些素材的商用或再分发权利。

## 贡献

欢迎提交 Issue 与 Pull Request。较大的功能改动建议先开 Issue 说明目标、交互和数据迁移方式。参与贡献即表示你有权提交相关代码或素材，并同意其按本项目适用的许可证发布。
