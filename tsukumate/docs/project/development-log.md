# TsukuMate 开发日志

本日志根据项目提交记录与开发对话整理。日期表示功能完成或提交的日期；只有已创建的 Pull Request 才标注 PR 编号。历史发布说明仍以 `docs/releases/` 为准。

## 2026-07-20

- 建立桌宠 API、记忆、日记与基础控制能力。

## 2026-07-23

- 加入 Live2D 桌宠与可视化对话基础。
- 加入实时聊天情绪状态、情绪词库与流式 API 情绪细化。
- 修复 Live2D 设置持久化与设置页渲染恢复问题。

## 2026-07-24

- 加入快捷启动器。
- 加入持久情绪反应。

## 2026-07-25

- 完成应用品牌统一为 TsukuMate，并整理 README、许可归属与用户自管兼容模型服务说明。
- 修复旧适配器初始化、模型/记忆设置布局及 Live2D 任务卡定位。
- 加入稳定版 Live2D 大问答工作台：工作台独立镜头、会话/日记基础与受限 IPC。

  PR：[PR #1 — stable Live2D chat workspace](https://github.com/Kaito-miku/TsukuMate--deskpet/pull/1)（已合并）

## 2026-07-26

- 重构 Electron 源码职责边界：主进程、渲染器、preload 与 shared 分层，并同步调整测试结构。
- 修复目录移动后的 Live2D 启动问题。
- 扩展大问答工作台：学习会话、附件、历史/日记切换、富学习卡片与会话标题。
- 优化工作台导航：悬浮“回到最新”、用户消息定位轨道、Live2D 构图与页面切换稳定性。
- 修复工作台切换时桌宠可见性与导航布局问题。

## 2026-07-27

- 完成学习工作区界面、笔记/资源/练习入口、日记可靠性与 Apple 风格 UI 的一轮整理。
- 完成目录重构、学习工作区和日记可靠性相关变更的合并。

  PR：[PR #2 — learning workspace, polished UI, and diary reliability](https://github.com/Kaito-miku/TsukuMate--deskpet/pull/2)（已合并）

## 2026-07-28

- 接入 UniStudy 风格富消息渲染：Markdown、消息级 CSS 作用域、流式 stable/tail 更新、受限 HTML/Three.js 预览与 A2UI 组件。
- 增加受控媒体、3D 与富内容的基础运行时；AI 生成内容不能获得 Electron、任意文件或任意网络权限。
- 修复流式聊天造成的气泡频闪：不再在每个增量重插用户/助手消息节点；结束流式时不重建整个气泡。
- 将远程 OpenAI 兼容接口的网络静默超时从 30 秒提高到 90 秒，降低第三方服务短暂排队导致的失败概率。

  PR：[PR #4 — adopt UniStudy rich message renderer](https://github.com/Kaito-miku/TsukuMate--deskpet/pull/4)（待合并，目标分支为 `codex/source-layout-reorganization`）

## 维护约定

- 新功能、用户可见修复或重要架构调整完成后，在对应日期下追加一条。
- 已创建 PR 时记录 PR 编号、标题和状态；没有 PR 的本地更新只记录内容。
- 关闭但未合并的 PR 不作为正式交付记录；必要时可在条目中说明替代 PR。
