# 示例索引 (Examples Reference)

所有示例位于 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)。本文件按类别索引这些示例，便于快速查找特定能力的参考实现。

## 目录

- [工具 (Tools)](#工具-tools)
- [命令 (Commands)](#命令-commands)
- [事件和门控 (Events & Gating)](#事件和门控-events--gating)
- [压缩和会话 (Compaction & Sessions)](#压缩和会话-compaction--sessions)
- [UI 组件 (UI Components)](#ui-组件-ui-components)
- [复杂扩展 (Complex Extensions)](#复杂扩展-complex-extensions)
- [远程和沙箱 (Remote & Sandbox)](#远程和沙箱-remote--sandbox)
- [游戏 (Games)](#游戏-games)
- [Provider](#provider)
- [消息和通信 (Messaging & Communication)](#消息和通信-messaging--communication)
- [会话元数据 (Session Metadata)](#会话元数据-session-metadata)
- [其他 (Other)](#其他-other)

## 工具 (Tools)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `hello.ts` | 最小工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`、`ui.select` |
| `questionnaire.ts` | 多步向导工具 | `registerTool`、`ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`、`appendEntry`、`renderResult`、会话事件 |
| `dynamic-tools.ts` | 启动后和命令期间注册工具 | `registerTool`、`session_start`、`registerCommand` |
| `structured-output.ts` | 带 `terminate: true` 的最终结构化输出工具 | `registerTool`、终止性工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`、`truncateHead` |
| `tool-override.ts` | 覆盖内置 read 工具 | `registerTool`（与内置相同名称） |

## 命令 (Commands)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `pirate.ts` | 每轮修改系统提示 | `registerCommand`、`before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`、`ui.custom` |
| `handoff.ts` | 跨 Provider 模型切换 | `registerCommand`、`ui.editor`、`ui.custom` |
| `qna.ts` | 带自定义 UI 的问答 | `registerCommand`、`ui.custom`、`setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`、`sendUserMessage` |
| `reload-runtime.ts` | 重载命令和 LLM 工具切换 | `registerCommand`、`ctx.reload()`、`sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`、`shutdown()` |

## 事件和门控 (Events & Gating)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`、`ui.confirm` |
| `project-trust.ts` | 从全局或 CLI 扩展决定或推迟项目信任 | `on("project_trust")`、信任 UI、必需的信任结果 |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话更改 | `on("session_before_switch")`、`on("session_before_fork")` |
| `dirty-repo-guard.ts` | 在 Git 仓库脏时警告 | `on("session_before_*")`、`exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 感知流式行为的输入转换 | `on("input")`、`streamingBehavior` |
| `model-status.ts` | 响应模型更改 | `on("model_select")`、`setStatus` |
| `provider-payload.ts` | 检查负载和 Provider 响应标头 | `on("before_provider_request")`、`on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示信息 | `on("agent_start")`、`getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`、`on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知的工具指导 | `on("before_agent_start")`、`BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监听器触发消息 | `sendMessage` |

## 压缩和会话 (Compaction & Sessions)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | 在轮次中使用 Git stash | `on("turn_start")`、`on("session_before_fork")`、`exec` |
| `git-merge-and-resolve.ts` | 拉取、合并和解决冲突 | `on("agent_end")`、`exec`、`sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时提交 | `on("session_shutdown")`、`exec` |

## UI 组件 (UI Components)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `status-line.ts` | 底部栏状态指示器 | `setStatus`、会话事件 |
| `working-indicator.ts` | 自定义流式工作指示器 | `setWorkingIndicator`、`registerCommand` |
| `github-issue-autocomplete.ts` | 通过预加载 `gh issue list` 中的最近开放 Issue，在内置自动补全之上添加 `#1234` Issue 补全 | `addAutocompleteProvider`、`on("session_start")`、`exec` |
| `custom-footer.ts` | 完全替换底部栏 | `registerCommand`、`setFooter` |
| `custom-header.ts` | 替换启动头部 | `on("session_start")`、`setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`、`CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的组件 | `setWidget` |
| `overlay-test.ts` | 覆盖组件 | 带覆盖选项的 `ui.custom` |
| `overlay-qa-tests.ts` | 全面覆盖测试 | `ui.custom`、所有覆盖选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | 带超时/信号的 `ui.confirm` |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`、`exec` |

## 复杂扩展 (Complex Extensions)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `plan-mode/` | 完整计划模式实现 | 所有事件类型、`registerCommand`、`registerShortcut`、`registerFlag`、`setStatus`、`setWidget`、`sendMessage`、`setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思考） | `registerCommand`、`registerShortcut`、`registerFlag`、`setModel`、`setActiveTools`、`setThinkingLevel`、`appendEntry` |
| `tools.ts` | 工具开关 UI | `registerCommand`、`setActiveTools`、`SettingsList`、会话事件 |

## 远程和沙箱 (Remote & Sandbox)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `ssh.ts` | SSH 远程执行 | `registerFlag`、`on("user_bash")`、`on("before_agent_start")`、工具操作 |
| `interactive-shell.ts` | 持久 Shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `subagent/` | 生成子 Agent | `registerTool`、`exec` |

## 游戏 (Games)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`、`ui.custom`、键盘处理 |
| `space-invaders.ts` | 太空入侵者游戏 | `registerCommand`、`ui.custom` |
| `doom-overlay/` | 覆盖模式下的 Doom 游戏 | 带覆盖的 `ui.custom` |

## Provider

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | 带 OAuth 的 `registerProvider` |

## 消息和通信 (Messaging & Communication)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`、`sendMessage` |
| `entry-renderer.ts` | 仅 TUI 的自定义条目渲染 | `registerEntryRenderer`、`appendEntry` |
| `event-bus.ts` | 扩展间事件 | `pi.events` |

## 会话元数据 (Session Metadata)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `session-name.ts` | 为选择器命名会话 | `setSessionName`、`getSessionName` |
| `bookmark.ts` | 为 /tree 标记条目 | `setLabel` |

## 其他 (Other)

| 示例 | 说明 | 关键 API |
| --- | --- | --- |
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 在执行前调整 bash 命令、cwd 和环境 | `createBashTool`、`spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 带 `package.json` 的包结构 |

---

## 选择示例的提示

- **写第一个工具**：从 `hello.ts` 开始；需要交互看 `question.ts`；需要状态看 `todo.ts`
- **拦截工具调用**：`permission-gate.ts`（危险命令）、`protected-paths.ts`（路径保护）、`inline-bash.ts`（注入 bash）
- **修改系统提示**：`pirate.ts`（简单）、`prompt-customizer.ts`（基于 `systemPromptOptions`）、`claude-rules.ts`（从文件加载）
- **会话管理**：`handoff.ts`（跨会话切换）、`git-checkpoint.ts`（Git stash 检查点）、`auto-commit-on-exit.ts`（关闭时提交）
- **自定义 TUI**：`status-line.ts`（底部栏）、`custom-footer.ts`（完全替换底部栏）、`widget-placement.ts`（编辑器上下组件）
- **自定义编辑器**：`modal-editor.ts`（Vim 模式）、`rainbow-editor.ts`（自定义样式）
- **动态工具**：`dynamic-tools.ts`（启动后注册）、参考 [custom-tools.md](custom-tools.md#动态工具加载) 的搜索工具示例
- **远程/沙箱**：`ssh.ts`（SSH 远程执行完整示例）、`sandbox/`（沙箱化）、`subagent/`（子 Agent）
- **自定义 Provider**：`custom-provider-anthropic/`（Anthropic 代理）、`custom-provider-gitlab-duo/`（OAuth 集成）
- **覆盖层**：`overlay-test.ts`（基础）、`overlay-qa-tests.ts`（全面测试）、`doom-overlay/`（游戏示例）

## 法律声明

本 skill 源自 pi.dev 官方文档的中文翻译版本，仅供学习参考。与 [pi.dev](https://pi.dev/) 及 Earendil Inc. 无任何法律关系。
