# ExtensionContext / ExtensionCommandContext 参考

所有事件处理程序接收 `ctx: ExtensionContext`。命令处理程序接收 `ExtensionCommandContext`（扩展了 `ExtensionContext` 并添加会话控制方法）。

## 目录

- [ExtensionContext](#extensioncontext)
  - [ctx.ui](#ctxui)
  - [ctx.mode](#ctxmode)
  - [ctx.hasUI](#ctxhasui)
  - [ctx.cwd](#ctxcwd)
  - [ctx.isProjectTrusted()](#ctxisprojecttrusted)
  - [ctx.sessionManager](#ctxsessionmanager)
  - [ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels](#ctxmodelregistry--ctxmodel--ctxthinkinglevel--ctxscopedmodels)
  - [ctx.signal](#ctxsignal)
  - [ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()](#ctxisidle--ctxabort--ctxhaspendingmessages)
  - [ctx.shutdown()](#ctxshutdown)
  - [ctx.getContextUsage()](#ctxgetcontextusage)
  - [ctx.compact()](#ctxcompact)
  - [ctx.getSystemPrompt()](#ctxgetsystemprompt)
- [ExtensionCommandContext](#extensioncommandcontext)
  - [ctx.getSystemPromptOptions()](#ctxgetsystempromptoptions)
  - [ctx.waitForIdle()](#ctxwaitforidle)
  - [ctx.newSession(options?)](#ctxnewsessionoptions)
  - [ctx.fork(entryId, options?)](#ctxforkentryid-options)
  - [ctx.navigateTree(targetId, options?)](#ctxnavigatetreetargetid-options)
  - [ctx.switchSession(sessionPath, options?)](#ctxswitchsessionsessionpath-options)
  - [ctx.reload()](#ctxreload)
- [会话替换生命周期及陷阱](#会话替换生命周期及陷阱)

## ExtensionContext

### ctx.ui

用户交互的 UI 方法。完整详情参见 [custom-ui.md](custom-ui.md)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。用 `ctx.mode === "tui"` 守卫仅终端功能（`custom()`、组件工厂、终端输入、直接 TUI 渲染）。

### ctx.hasUI

- TUI 和 RPC 模式下为 `true`
- 打印模式（`-p`）和 JSON 模式下为 `false`

用此属性守卫对话框方法（`select`、`confirm`、`input`、`editor`）和即发即弃方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`）——这些方法在 TUI 和 RPC 模式下均可工作。RPC 模式下某些 TUI 特定方法是无操作或返回默认值。

### ctx.cwd

当前工作目录。

构造项目本地配置路径时用 `CONFIG_DIR_NAME` 而非硬编码 `.pi`。重新分发的发行版可使用不同配置目录名。

```typescript
import { CONFIG_DIR_NAME, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { join } from 'node:path';

export default function (pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    const projectConfigPath = join(ctx.cwd, CONFIG_DIR_NAME, 'my-extension.json');
    // ...
  });
}
```

### ctx.isProjectTrusted()

返回项目本地信任在当前会话上下文中是否生效。**包括临时信任决策和 CLI 信任覆盖**，而不仅仅是全局信任存储中保存的决策。

在读取只应对受信任项目生效的项目本地扩展配置之前使用此方法。

### ctx.sessionManager

对会话状态的只读访问。完整 SessionManager API 和条目类型参见 [Session Format](https://pi.dev/docs/latest/session-format)。

对于 `tool_call`，此状态在处理程序运行前已通过当前助手消息同步。并行工具执行模式下仍不能保证包含同一条助手消息中的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries(); // 所有条目
ctx.sessionManager.getBranch(); // 当前分支
ctx.sessionManager.buildContextEntries(); // 应用了压缩的活跃分支条目
ctx.sessionManager.getLeafId(); // 当前叶子条目 ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

访问模型、Provider 和已解析认证信息。

- `ctx.modelRegistry.getProvider(id)`：返回有效的 pi-ai Provider
- `ctx.modelRegistry.getProviderAuth(id)`：解析其当前的 API Key、请求头、base URL 和 Provider 作用域环境变量，无需加载模型
- `ctx.model`：当前活动模型
- `ctx.thinkingLevel`：当前有效的 thinking 级别

`ctx.scopedModels` 是限定到当前会话的只读模型列表——与 `/scoped-models` 命令显示的内容相同。会话启动时通过 `--models` CLI 标志和 `enabledModels` 设置解析（与可用目录进行 minimatch 匹配，匹配 `provider/modelId` 或纯 `modelId`）。未配置作用域时为空，表示所有可用模型均可使用。每个条目为 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在某个模式明确指定时才设置（例如 `anthropic/*:high`）。使用它可以构建与内置选择器一致的模型选择器，无需通过 `ctx.modelRegistry.getAvailable()` 枚举整个目录。

### ctx.signal

当前的 Agent 中止信号，如果未激活 Agent 回合则为 `undefined`。

将此用于扩展处理程序启动的、支持中止感知的嵌套工作：

- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程辅助函数

`ctx.signal` 通常在活动回合事件（如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`）期间定义。在空闲或非回合上下文（如会话事件、扩展命令以及在 pi 空闲时触发的快捷键）中通常为 `undefined`。

```typescript
pi.on('tool_result', async (event, ctx) => {
  const response = await fetch('https://example.com/api', {
    method: 'POST',
    body: JSON.stringify(event),
    signal: ctx.signal,
  });
  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

控制流辅助方法。当 Pi 正在处理 agent 运行、自动重试、自动压缩重试或排队的继续消息时，`ctx.isIdle()` 为 false。

### ctx.shutdown()

请求优雅关闭 pi。

- **交互模式：**延迟到 Agent 变为空闲后（处理完所有排队的引导和后续消息后）
- **RPC 模式：**延迟到下一个空闲状态（完成当前命令响应后，等待下一个命令时）
- **打印模式：**无操作。进程在处理完所有提示后自动退出

在退出前向所有扩展发出 `session_shutdown` 事件。在所有上下文中可用（事件处理程序、工具、命令、快捷键）。

```typescript
pi.on('tool_call', (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前活动模型的上下文使用情况。在可用时使用最后一次的助手使用数据，然后估算尾部消息的 token 数。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发压缩但不等待完成。用 `onComplete` 和 `onError` 进行后续操作。

```typescript
ctx.compact({
  customInstructions: '关注最近的更改',
  onComplete: (result) => {
    ctx.ui.notify('压缩完成', 'info');
  },
  onError: (error) => {
    ctx.ui.notify(`压缩失败：${error.message}`, 'error');
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示字符串。

- 在 `before_agent_start` 期间，反映当前回合到目前为至链式拼接的系统提示更改
- 不包括后续 `context` 消息的修改
- 不包括 `before_provider_request` 负载重写
- 如果在您的扩展之后加载了其他扩展，它们仍可以更改最终发送的内容

```typescript
pi.on('before_agent_start', (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`系统提示长度：${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理程序接收 `ExtensionCommandContext`，它扩展了 `ExtensionContext` 并添加了会话控制方法。这些方法**仅在命令中可用**——在事件处理程序中调用可能导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

形状和可变性与 `before_agent_start` 的 `event.systemPromptOptions` 相同：自定义提示、活跃工具、工具代码片段、提示指南、追加的系统提示文本、cwd、已加载的上下文文件和已加载的 Skill。它可能包含完整的上下文文件内容，因此请将其视为敏感的扩展本地数据，避免通过命令列表、日志或自动补全元数据暴露它。

报告当前的基础提示输入。不包括每轮 `before_agent_start` 链式系统提示更改、后续的 `context` 事件消息修改或 `before_provider_request` 负载重写。

### ctx.waitForIdle()

等待 Agent 完全 settled，包括自动重试、自动压缩重试和排队的继续消息：

```typescript
pi.registerCommand('my-cmd', {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // Agent 现在空闲，可以安全修改会话
  },
});
```

### ctx.newSession(options?)

创建新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = '在替换会话中继续';

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: 'user',
      content: [{ type: 'text', text: '来自前一个会话的上下文...' }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // 在此处只使用替换会话的 ctx
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 扩展取消了新会话
}
```

**选项：**

- `parentSession`：要在新会话标头中记录的父会话文件
- `setup`：在 `withSession` 运行前修改新会话的 `SessionManager`
- `withSession`：针对新的替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [会话替换生命周期及陷阱](#会话替换生命周期及陷阱)

### ctx.fork(entryId, options?)

从特定条目分叉，创建新的会话文件：

```typescript
const result = await ctx.fork('entry-id-123', {
  withSession: async (ctx) => {
    // 在此处只使用替换会话的 ctx
    ctx.ui.notify('现在在分叉会话中', 'info');
  },
});
if (result.cancelled) {
  // 扩展取消了分叉
}

const cloneResult = await ctx.fork('entry-id-456', { position: 'at' });
if (cloneResult.cancelled) {
  // 扩展取消了克隆
}
```

**选项：**

- `position`：`"before"`（默认）在选定的用户消息之前分叉，将该提示恢复到编辑器中
- `position`：`"at"` 复制经过所选条目的活动路径，但不恢复编辑器文本
- `withSession`：针对新的替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`

### ctx.navigateTree(targetId, options?)

导航到会话树中的不同点：

```typescript
const result = await ctx.navigateTree('entry-id-456', {
  summarize: true,
  customInstructions: '关注错误处理更改',
  replaceInstructions: false, // true = 完全替换默认提示
  label: 'review-checkpoint',
});
```

**选项：**

- `summarize`：是否为被遗弃的分支生成摘要
- `customInstructions`：摘要器的自定义指令
- `replaceInstructions`：如果为 true，`customInstructions` 替换默认提示而不是附加
- `label`：要附加到分支摘要条目（如果未摘要则为目标条目）的标签

### ctx.switchSession(sessionPath, options?)

切换到不同的会话文件：

```typescript
const result = await ctx.switchSession('/path/to/session.jsonl', {
  withSession: async (ctx) => {
    await ctx.sendUserMessage('在替换会话中恢复工作');
  },
});
if (result.cancelled) {
  // 扩展通过 session_before_switch 取消了切换
}
```

**选项：**

- `withSession`：针对新的替换会话上下文运行切换后工作。不要使用捕获的旧 `pi` / 命令 `ctx`

要发现可用会话，使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

```typescript
import { SessionManager } from '@earendil-works/pi-coding-agent';

pi.registerCommand('switch', {
  description: '切换到其他会话',
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select('选择会话：', sessions.map((s) => s.file));
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify('会话已切换', 'info');
        },
      });
    }
  },
});
```

### ctx.reload()

执行与 `/reload` 相同的重载流程。

```typescript
pi.registerCommand('reload-runtime', {
  description: '重载扩展、Skill、Prompt、主题和上下文文件',
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

**重要行为：**

- `await ctx.reload()` 为当前扩展运行时发出 `session_shutdown`
- 然后重新加载资源并发出带有 `reason: "reload"` 的 `session_start` 和带有 `"reload"` 原因的 `resources_discover`
- 当前运行的命令处理程序仍在旧调用帧中继续
- `await ctx.reload()` 之后的代码仍从重载前的版本运行
- `await ctx.reload()` 之后的代码**不得**假设旧的扩展内存状态仍然有效
- 处理程序返回后，未来的命令/事件/工具调用将使用新的扩展版本

为获得可预测的行为，将重载视为该处理程序的终结点（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此它们不能直接调用 `ctx.reload()`。使用命令作为重载入口点，然后暴露一个将该命令排入后续用户消息的工具。

LLM 可调用的触发重载的工具示例：

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export default function (pi: ExtensionAPI) {
  pi.registerCommand('reload-runtime', {
    description: '重载扩展、Skill、Prompt、主题和上下文文件',
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: 'reload_runtime',
    label: '重载运行时',
    description: '重载扩展、Skill、Prompt 和主题',
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage('/reload-runtime', { deliverAs: 'followUp' });
      return {
        content: [{ type: 'text', text: '已将 /reload-runtime 排队为后续命令。' }],
      };
    },
  });
}
```

## 会话替换生命周期及陷阱

`withSession` 接收一个全新的 `ReplacedSessionContext`，它扩展了 `ExtensionCommandContext` 并增加了绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法。

**生命周期和陷阱：**

- `withSession` 仅在旧会话发出 `session_shutdown`、旧运行时被拆除、替换会话已重新绑定且新的扩展实例已收到 `session_start` 后运行
- 回调仍在原始闭包中执行，而不是在新扩展实例内部。这意味着您的旧扩展实例可能在 `withSession` 开始前已经运行了关闭清理
- 捕获的旧 `pi` / 旧命令 `ctx` 的会话绑定对象在替换后已过时，使用时会抛出错误。**仅使用传递给 `withSession` 的 `ctx`** 进行会话绑定工作
- 先前提取的原始对象仍然是您的责任。例如，如果您在替换前捕获 `const sm = ctx.sessionManager`，`sm` 仍然是旧的 `SessionManager` 对象。替换后不要重复使用它
- `withSession` 中的代码应假设您 `session_shutdown` 处理程序已使其失效的任何状态都已不存在。只捕获能干净应对关闭的普通数据，如字符串、ID 和序列化配置

**安全模式：**

```typescript
pi.registerCommand('handoff', {
  handler: async (_args, ctx) => {
    const kickoff = '从替换会话继续';
    await ctx.newSession({
      withSession: async (ctx) => {
        await ctx.sendUserMessage(kickoff);
      },
    });
  },
});
```

**不安全模式（不要这样做）：**

```typescript
pi.registerCommand('handoff', {
  handler: async (_args, ctx) => {
    const oldSessionManager = ctx.sessionManager;
    await ctx.newSession({
      withSession: async (_ctx) => {
        // 旧的已过时对象：不要这样做
        oldSessionManager.getSessionFile();
        pi.sendUserMessage('wrong');
      },
    });
  },
});
```
