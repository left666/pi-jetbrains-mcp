---
name: pi-extension-dev
description: Build, edit, and debug Pi (pi.dev) extensions — TypeScript modules that extend Pi's behavior with custom tools, commands, event handlers, UI components, providers, and lifecycle hooks. Use this skill whenever the user wants to create or modify a Pi extension (`.ts` files under `~/.pi/agent/extensions/`, `.pi/extensions/`, or passed via `pi -e`), asks about the Pi extension API (`ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `registerTool`, `registerCommand`, `registerProvider`, `registerShortcut`, `registerFlag`, `pi.on`, `sendMessage`, `sendUserMessage`, `appendEntry`, `setActiveTools`, etc.), mentions Pi lifecycle or tool events (`session_start`, `tool_call`, `tool_result`, `before_agent_start`, `input`, `user_bash`, `model_select`, etc.), needs to register LLM-callable tools or slash commands, wants to intercept/modify tool calls, system prompts, provider requests, or user input, build custom TUI components (dialogs, widgets, custom editors, overlays, themes), or set up dynamic tool loading and custom providers. Also trigger proactively when the user references `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, or `typebox` imports, even if they don't explicitly say "extension". Source documentation is a Chinese translation — use Chinese explanations when responding to Chinese-speaking users.
---

# Pi 扩展开发 (Pi Extension Development)

本 skill 帮助开发者构建 Pi (pi.dev) 扩展。Pi 扩展是 TypeScript 模块，通过订阅事件、注册工具/命令/快捷键/标志、自定义 UI 渲染等方式扩展 Pi 的行为。

源文档为 Pi 官方文档的中文翻译，本 skill 沿用其术语。代码标识符、API 名称、文件路径一律使用英文原文。

## 何时使用本 Skill

主动在以下场景触发：

- 用户要创建、修改、调试任何 Pi 扩展（`.ts` 文件位于 `~/.pi/agent/extensions/`、`.pi/extensions/`、或通过 `pi -e ./path.ts` 加载）
- 用户询问 Pi 扩展 API（`ExtensionAPI`、`ExtensionContext`、`registerTool`、`registerCommand`、`pi.on` 等）
- 用户提到 Pi 事件名称（`session_start`、`tool_call`、`tool_result`、`before_agent_start`、`input`、`user_bash` 等）
- 用户提到 Pi 相关 import：`@earendil-works/pi-coding-agent`、`@earendil-works/pi-ai`、`@earendil-works/pi-tui`、`typebox`
- 用户要为 LLM 注册工具、为 Pi 注册斜杠命令、自定义 TUI 渲染、动态加载工具、注册自定义 Provider
- 用户要拦截/修改工具调用、系统提示、Provider 请求、用户输入

## 核心能力概览

| 能力 | 入口 |
| --- | --- |
| 自定义工具（LLM 可调用） | `pi.registerTool()` |
| 事件拦截/订阅 | `pi.on(eventName, handler)` |
| 自定义斜杠命令 | `pi.registerCommand('name', { handler })` |
| 键盘快捷键 | `pi.registerShortcut('ctrl+x', { handler })` |
| CLI 标志 | `pi.registerFlag('name', { type, default })` |
| 自定义 TUI 组件 | `ctx.ui.custom()`、`ctx.ui.setWidget()`、`ctx.ui.setFooter()` |
| 自定义编辑器（vim/emacs 等） | `ctx.ui.setEditorComponent()` |
| 自定义消息/条目渲染 | `pi.registerMessageRenderer()`、`pi.registerEntryRenderer()` |
| 会话持久化（不进 LLM 上下文） | `pi.appendEntry()` |
| 注入 LLM 上下文消息 | `pi.sendMessage()`、`pi.sendUserMessage()` |
| 动态注册模型 Provider | `pi.registerProvider()` |
| 工具激活集管理 | `pi.getActiveTools()`、`pi.setActiveTools()` |

## 扩展位置（关键）

> 扩展以用户完整系统权限运行，仅安装来自信任源的扩展。

| 位置 | 范围 |
| --- | --- |
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地（需项目受信任） |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

- 自动发现位置的扩展可用 `/reload` 热重载
- 快速测试用 `pi -e ./path.ts`
- 通过 `settings.json` 可添加额外路径：`{ "extensions": ["/path/to/file.ts"] }`
- 通过 `pi install` 分发 npm/git 包，运行时依赖必须放在 `dependencies` 中（`devDependencies` 在运行时不可用）

## 可用导入

| 包 | 用途 |
| --- | --- |
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件类型、`isToolCallEventType`、`withFileMutationQueue`、`createBashTool` 等） |
| `typebox` | 工具参数模式定义（`Type.Object`、`Type.String` 等） |
| `@earendil-works/pi-ai` | AI 工具（`StringEnum` 用于 Google 兼容枚举、`createProvider`、`openAICompletionsApi` 等） |
| `@earendil-works/pi-tui` | 自定义渲染的 TUI 组件（`Text`、`Box`、`Component`、`matchesKey`） |

Node.js 内置模块（`node:fs`、`node:path` 等）也可用。扩展通过 [jiti](https://github.com/unjs/jiti) 加载，TypeScript 无需编译。

## 最小示例

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export default function (pi: ExtensionAPI) {
  // 响应事件
  pi.on('session_start', async (_event, ctx) => {
    ctx.ui.notify('扩展已加载！', 'info');
  });

  // 拦截危险命令
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName === 'bash' && event.input.command?.includes('rm -rf')) {
      const ok = await ctx.ui.confirm('危险操作！', '允许执行 rm -rf 吗？');
      if (!ok) return { block: true, reason: '用户已阻止' };
    }
  });

  // 注册自定义工具
  pi.registerTool({
    name: 'greet',
    label: '问候',
    description: '按姓名向某人问好',
    parameters: Type.Object({ name: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text', text: `你好，${params.name}！` }],
        details: {},
      };
    },
  });

  // 注册命令
  pi.registerCommand('hello', {
    description: '说你好',
    handler: async (args, ctx) => {
      ctx.ui.notify(`你好 ${args || '世界'}！`, 'info');
    },
  });
}
```

测试：`pi -e ./my-extension.ts`

## 扩展结构

扩展导出默认工厂函数，接收 `ExtensionAPI`。可以是同步或异步：

```typescript
export default function (pi: ExtensionAPI) { /* ... */ }
export default async function (pi: ExtensionAPI) { /* 异步初始化 */ }
```

异步工厂会阻塞启动，适合一次性启动工作（如获取远程模型列表）。**不要**从工厂启动后台资源（进程、socket、文件监听、定时器）；推迟到 `session_start` 或需要的命令/工具/事件中。注册幂等的 `session_shutdown` 处理程序清理会话级资源。

三种结构风格：

1. **单文件**——`my-extension.ts`（小型扩展）
2. **带 `index.ts` 的目录**——多文件扩展，辅助模块自由组织
3. **带依赖的包**——`package.json` 声明依赖和入口点：

```json
{
  "name": "my-extension",
  "dependencies": { "zod": "^3.0.0" },
  "pi": { "extensions": ["./src/index.ts"] }
}
```

## 开发工作流

构建新扩展时的推荐步骤：

1. **明确目标**：扩展要做什么？需要哪些核心能力（工具、命令、事件、UI）？
2. **选择结构**：单文件 / 目录 / 带依赖的包。小型扩展用单文件即可。
3. **写工厂函数骨架**：`export default function (pi: ExtensionAPI) { ... }`
4. **按需订阅事件、注册工具/命令/快捷键/标志**——按主题查阅下方参考文件
5. **管理状态**：有状态扩展把状态存在工具结果的 `details` 中，从 `session_start` 重建。详见 [custom-tools.md](references/custom-tools.md) 的"状态管理"
6. **处理并发**：自定义工具若修改文件，必须用 `withFileMutationQueue()` 与内置 `edit`/`write` 共享同一文件队列
7. **截断输出**：工具输出必须截断（默认 50KB / 2000 行），用 `truncateHead` / `truncateTail`
8. **测试**：`pi -e ./my-extension.ts` 快速测试，或放到自动发现位置后用 `/reload` 热重载
9. **错误处理**：工具失败用 `throw new Error(...)`（不要靠返回值设 `isError`）；扩展错误会被记录，Agent 继续

## 常见模式速查

### 拦截工具调用并阻止

```typescript
pi.on('tool_call', async (event, ctx) => {
  if (event.toolName === 'bash' && event.input.command?.includes('rm -rf')) {
    return { block: true, reason: '危险命令', terminate: true };
  }
});
```

`event.input` 可变，原地修改可修补工具参数。`terminate: true` 仅在被阻止的调用上生效。

### 修改系统提示

```typescript
pi.on('before_agent_start', async (event, ctx) => {
  return {
    systemPrompt: event.systemPrompt + '\n\n此轮的额外指令...',
    message: { customType: 'my-ext', content: '给 LLM 的额外上下文', display: true },
  };
});
```

### 持久化扩展状态（不进 LLM 上下文）

```typescript
pi.appendEntry('my-state', { count: 42 });

pi.on('session_start', async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === 'custom' && entry.customType === 'my-state') {
      // 从 entry.data 重建
    }
  }
});
```

### 转换用户输入

```typescript
pi.on('input', async (event, ctx) => {
  if (event.text.startsWith('?quick ')) {
    return { action: 'transform', text: `简要回复：${event.text.slice(7)}` };
  }
  if (event.text === 'ping') {
    ctx.ui.notify('pong', 'info');
    return { action: 'handled' };
  }
  return { action: 'continue' };
});
```

### 自定义 Provider

```typescript
pi.registerProvider('my-proxy', {
  baseUrl: 'https://proxy.example.com',
  apiKey: '$PROXY_API_KEY',
  api: 'anthropic-messages',
  models: [/* ... */],
});
```

## 重要约定与陷阱

- **路径常量**：构造项目本地配置路径时用 `CONFIG_DIR_NAME` 而非硬编码 `.pi`
- **项目信任**：项目本地扩展仅在 `ctx.isProjectTrusted()` 返回 true 时加载；读项目本地配置前先检查
- **TUI 守卫**：仅 TUI 功能（`ctx.ui.custom()`、组件工厂、终端输入）用 `ctx.mode === "tui"`；对话框和通知用 `ctx.hasUI`（TUI 和 RPC 模式都为 true）
- **`promptGuidelines` 扁平追加**：每条准则必须明确指出引用的工具——写"当...时使用 my_tool"而非"使用此工具当..."
- **枚举用 `StringEnum`**：`Type.Union`/`Type.Literal` 与 Google API 不兼容
- **路径 `@` 前缀**：自定义工具接受路径时应规范化前导 `@`（内置工具会自动去除）
- **会话替换生命周期**：`withSession` 回调中只使用传入的新 `ctx`，不要重复使用捕获的旧 `pi` / 旧 `ctx` 的会话绑定对象
- **`ctx.reload()` 后**：当前处理程序仍在旧调用帧继续，但不得假设旧扩展内存状态仍有效；最佳做法是 `await ctx.reload(); return;`
- **工具 `execute` 错误**：必须 `throw`；返回值不会设置 `isError`
- **长生命周期资源**：不要从工厂函数启动后台资源；放到 `session_start` 或按需启动，`session_shutdown` 中清理
- **动态工具加载**：用增量 `pi.setActiveTools([...current, ...new])`（不要在同一调用中移除当前激活工具）以保留 Provider 缓存前缀

## 详细参考（按主题查阅）

针对深入问题，阅读对应参考文件：

| 主题 | 文件 | 何时查阅 |
| --- | --- | --- |
| 所有事件类型、生命周期、处理器返回值 | [references/events.md](references/events.md) | 用户问"什么时候触发 X 事件"或"如何拦截 Y" |
| `ExtensionContext` 和 `ExtensionCommandContext` 的所有字段/方法 | [references/context.md](references/context.md) | 用户问 `ctx.X` 是什么、能做什么 |
| `pi.*` API 方法（`registerTool`、`sendMessage`、`registerProvider` 等） | [references/api-methods.md](references/api-methods.md) | 用户问 `pi.X` 方法签名或选项 |
| 自定义工具：定义、覆盖内置、远程执行、截断、动态加载、渲染 | [references/custom-tools.md](references/custom-tools.md) | 用户要写工具、覆盖 `read`/`bash`、做动态工具加载 |
| 自定义 UI：对话框、组件、编辑器、消息/条目渲染、主题、覆盖层 | [references/custom-ui.md](references/custom-ui.md) | 用户要做自定义对话框、底部栏、vim 模式编辑器、自定义消息渲染 |
| 完整示例索引（按类别） | [references/examples.md](references/examples.md) | 用户要找某个能力的参考实现 |

## 工作准则

1. **先理解再写代码**：扩展涉及大量事件和上下文。先阅读相关参考文件，确认 API 形状，再开始写。
2. **遵循源文档术语**：用中文解释时，沿用源文档的中译术语（如"会话"、"条目"、"回合"、"压缩"、"分叉"）。
3. **代码用英文标识符**：所有 API 名、变量名、文件路径、事件名保持英文原样。
4. **保持扩展精简**：不要添加用户没要求的工具、命令或事件处理。仅实现所需功能。
5. **提示用户验证**：扩展涉及运行时行为，写完后告诉用户如何测试（`pi -e` 或 `/reload`）。
6. **指出陷阱**：如果用户代码涉及会话替换、文件并发、输出截断、错误信号等已知陷阱，主动提醒。
7. **不臆造 API**：不确定的 API 形状必须先查参考文件，不要凭印象写。

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 说明 |
| --- | --- | --- | --- |
| 交互 | `"tui"` | `true` | 完整 TUI |
| RPC | `"rpc"` | `true` | JSON 协议对话框/通知；`custom()` 返回 `undefined` |
| JSON | `"json"` | `false` | 事件流到 stdout；UI 方法无操作 |
| 打印（`-p`） | `"print"` | `false` | 扩展运行但不能提示 |

## 错误处理

- 扩展错误会被记录，Agent 继续运行
- `tool_call` 错误会阻止该工具（故障安全）
- 工具 `execute` 错误必须 `throw`；抛出的错误会被捕获，以 `isError: true` 报告给 LLM，执行继续
