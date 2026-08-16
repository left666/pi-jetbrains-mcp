# Pi 事件参考 (Events Reference)

所有事件通过 `pi.on(eventName, handler)` 订阅。处理器签名：`async (event, ctx) => { ... return result?; }`。

## 目录

- [生命周期概览](#生命周期概览)
- [启动事件](#启动事件)
  - [project_trust](#project_trust)
  - [resources_discover](#resources_discover)
- [会话事件](#会话事件)
  - [session_start](#session_start)
  - [session_info_changed](#session_info_changed)
  - [session_before_switch](#session_before_switch)
  - [session_before_fork](#session_before_fork)
  - [session_before_compact / session_compact](#session_before_compact--session_compact)
  - [session_before_tree / session_tree](#session_before_tree--session_tree)
  - [session_shutdown](#session_shutdown)
- [Agent 事件](#agent-事件)
  - [before_agent_start](#before_agent_start)
  - [agent_start / agent_end / agent_settled](#agent_start--agent_end--agent_settled)
  - [turn_start / turn_end](#turn_start--turn_end)
  - [message_start / message_update / message_end](#message_start--message_update--message_end)
  - [tool_execution_start / tool_execution_update / tool_execution_end](#tool_execution_start--tool_execution_update--tool_execution_end)
  - [context](#context)
  - [before_provider_headers](#before_provider_headers)
  - [before_provider_request](#before_provider_request)
  - [after_provider_response](#after_provider_response)
- [模型事件](#模型事件)
  - [model_select](#model_select)
  - [thinking_level_select](#thinking_level_select)
- [工具事件](#工具事件)
  - [tool_call](#tool_call)
  - [类型化自定义工具输入](#类型化自定义工具输入)
  - [tool_result](#tool_result)
- [用户 Bash 事件](#用户-bash-事件)
  - [user_bash](#user_bash)
- [输入事件](#输入事件)
  - [input](#input)

## 生命周期概览

```
pi 启动
  │
  ├─► project_trust（仅全局和 CLI 扩展参与，在项目资源加载前触发）
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
用户发送提示 ─────────────────────────────────────────┐
  │                                                        │
  ├─► （先检查扩展命令，如匹配则绕过）                         │
  ├─► input（可以拦截、转换或处理）                            │
  ├─► （如未处理，进行 skill/模板扩展）                         │
  ├─► before_agent_start（可注入消息、修改系统提示）              │
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── 回合（LLM 调用工具时重复） ───┐                    │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context（可修改消息）                     │       │
  │   ├─► before_provider_headers（可修改请求头）            │       │
  │   ├─► before_provider_request（可检查或替换负载）          │       │
  │   ├─► after_provider_response（状态+标头，流消费前）      │       │
  │   │                                            │       │
  │   │   LLM 响应，可能调用工具：                     │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call（可阻止）                 │       │
  │   │     ├─► tool_execution_update               │       │
  │   │     ├─► tool_result（可修改）                │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled（无剩余重试/压缩/follow-up）           │
                                                           │
用户发送另一个提示 ◄────────────────────────────────────────┘

/new（新会话）或 /resume（切换会话）
  ├─► session_before_switch（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork 或 /clone
  ├─► session_before_fork（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name 或 pi.setSessionName()
  └─► session_info_changed

/compact 或自动压缩
  ├─► session_before_compact（可取消或自定义）
  └─► session_compact

/tree 导航
  ├─► session_before_tree（可取消或自定义）
  └─► session_tree

/model 或 Ctrl+P（模型选择/切换）
  ├─► thinking_level_select（如果模型更改会调整/限制思考级别）
  └─► model_select

思考级别更改（设置、快捷键、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C、Ctrl+D、SIGHUP、SIGTERM）
  └─► session_shutdown
```

## 启动事件

### project_trust

在 Pi 决定是否信任包含动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。启动时和会话替换进入未解决信任的 cwd 时运行。**仅全局扩展和 CLI `-e` 扩展参与**；项目本地扩展在信任解决之前不会加载。

```typescript
pi.on('project_trust', async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 具有有限的信任上下文：cwd、mode、hasUI，以及 select/confirm/input/notify UI 助手
  if (await ctx.ui.confirm('信任项目？', event.cwd)) {
    return { trusted: 'yes', remember: true };
  }
  return { trusted: 'undecided' };
});
```

返回值：`{ trusted: "yes" | "no" | "undecided" }`。

- 返回 `"yes"` 或 `"no"` 的全局/CLI 扩展拥有该决策；第一个 yes/no 决策获胜并抑制内置信任提示
- `remember: true` 持久化 yes/no 决策；否则仅对当前进程生效
- `"undecided"` 让后续处理程序或内置信任流程决定
- 提示之前检查 `ctx.hasUI`
- 无 yes/no 时按 `trust.json` → `defaultProjectTrust` 解析

### resources_discover

`session_start` 后触发，让扩展贡献额外的 skill、prompt 和主题路径。启动用 `reason: "startup"`，重载用 `reason: "reload"`。

```typescript
pi.on('resources_discover', async (event, _ctx) => {
  // event.cwd, event.reason
  return {
    skillPaths: ['/path/to/skills'],
    promptPaths: ['/path/to/prompts'],
    themePaths: ['/path/to/themes'],
  };
});
```

## 会话事件

会话存储内部细节参见 [Session Format](https://pi.dev/docs/latest/session-format)。

### session_start

会话启动、加载或重新加载时触发。

```typescript
pi.on('session_start', async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - 在 "new"、"resume" 和 "fork" 时存在
  ctx.ui.notify(`会话：${ctx.sessionManager.getSessionFile() ?? '临时'}`, 'info');
});
```

### session_info_changed

通过 `/name`、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发。

```typescript
pi.on('session_info_changed', async (event, ctx) => {
  // event.name - 当前规范化名称，清除后为 undefined
  ctx.ui.notify(`会话重命名：${event.name ?? '(无)'}`, 'info');
});
```

### session_before_switch

在 `/new` 或 `/resume` 之前触发。**可取消。**

```typescript
pi.on('session_before_switch', async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 要切换到的会话（仅 "resume"）

  if (event.reason === 'new') {
    const ok = await ctx.ui.confirm('清空？', '删除所有消息？');
    if (!ok) return { cancel: true };
  }
});
```

成功切换或新建后：旧扩展实例触发 `session_shutdown`，新会话重新加载绑定扩展，然后以 `reason: "new" | "resume"` 和 `previousSessionFile` 触发 `session_start`。

### session_before_fork

通过 `/fork` 分叉或 `/clone` 克隆时触发。**可取消。**

```typescript
pi.on('session_before_fork', async (event, ctx) => {
  // event.entryId - 所选条目的 ID
  // event.position - "/fork" 为 "before"，"/clone" 为 "at"
  return { cancel: true }; // 取消
  return { skipConversationRestore: true }; // 保留用于未来的对话恢复控制
});
```

### session_before_compact / session_compact

压缩时触发。详情参见 [compaction](https://pi.dev/docs/latest/compaction)。

```typescript
pi.on('session_before_compact', async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual"（/compact）、"threshold" 或 "overflow"
  // willRetry - 压缩后是否重试被中止的轮次（溢出恢复）

  return { cancel: true }; // 取消

  // 自定义摘要：
  return {
    compaction: {
      summary: '...',
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；计入会话总计
    },
  };
});

pi.on('session_compact', async (event, ctx) => {
  // event.compactionEntry - 保存的压缩
  // event.fromExtension - 是否由扩展提供
  // event.reason, event.willRetry
});
```

### session_before_tree / session_tree

`/tree` 导航时触发。树导航概念参见 [Sessions](https://pi.dev/docs/latest/sessions)。

```typescript
pi.on('session_before_tree', async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // 或提供自定义摘要：
  return {
    summary: {
      summary: '...',
      // usage: summaryResponse.usage, // 可选
      details: {},
    },
  };
});

pi.on('session_tree', async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

### session_shutdown

已启动会话运行时被销毁前触发。用于清理 `session_start` 或其他会话级钩子打开的资源。

```typescript
pi.on('session_shutdown', async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - 会话替换流程的目标会话
  // 清理、保存状态等
});
```

## Agent 事件

### before_agent_start

用户提交提示后、Agent 循环开始前触发。**可注入消息和/或修改系统提示。**

```typescript
pi.on('before_agent_start', async (event, ctx) => {
  // event.prompt - 用户的提示文本
  // event.images - 附带的图片（如果有）
  // event.systemPrompt - 当前为此处理程序链式拼接的系统提示
  // event.systemPromptOptions - 用于构建系统提示的结构化选项
  //   .customPrompt - 任何自定义系统提示（来自 --system-prompt、SYSTEM.md 或自定义模板）
  //   .selectedTools - 当前在提示中激活的工具
  //   .toolSnippets - 每个工具的一行描述
  //   .promptGuidelines - 自定义准则要点
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件和其他加载的上下文文件
  //   .skills - 已加载的 skill

  return {
    // 注入持久消息（存储在会话中，发送给 LLM）
    message: {
      customType: 'my-extension',
      content: '给 LLM 的额外上下文',
      display: true,
    },
    // 为此轮替换系统提示（在扩展间链式拼接）
    systemPrompt: event.systemPrompt + '\n\n此轮的额外指令...',
  };
});
```

`systemPromptOptions` 字段提供与 Pi 构建系统提示相同的结构化数据——可检查 Pi 加载的内容而无需重新发现资源或重新解析标志。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理程序链式系统提示。后面的处理程序仍可再次修改。

### agent_start / agent_end / agent_settled

- `agent_start`：底层 agent 运行开始时触发
- `agent_end`：该运行结束时触发，但 Pi 可能仍会自动重试、自动压缩后重试或继续排队的 follow-up 消息
- `agent_settled`：需要知道 Pi 不会再自动继续运行时使用

```typescript
pi.on('agent_start', async (_event, ctx) => {});

pi.on('agent_end', async (event, ctx) => {
  // event.messages - 此次底层运行产生的消息
});

pi.on('agent_settled', async (_event, ctx) => {
  // 除非另一个扩展启动了新的运行，否则此处 ctx.isIdle() 为 true
});
```

### turn_start / turn_end

每个回合（一次 LLM 响应 + 工具调用）触发一次。

```typescript
pi.on('turn_start', async (event, ctx) => {
  // event.turnIndex, event.timestamp
});

pi.on('turn_end', async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

### message_start / message_update / message_end

- `message_start` 和 `message_end` 对用户、助手和 toolResult 消息触发
- `message_update` 对助手流式更新触发
- `message_end` 处理程序可返回 `{ message }` 替换最终消息（必须保持相同 `role`）

```typescript
pi.on('message_start', async (event, ctx) => {
  // event.message
});

pi.on('message_update', async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent（逐 token 流事件）
});

pi.on('message_end', async (event, ctx) => {
  if (event.message.role !== 'assistant') return;

  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: { ...event.message.usage.cost, total: 0.123 },
      },
    },
  };
});
```

### tool_execution_start / tool_execution_update / tool_execution_end

工具执行生命周期更新时触发。

**并行工具模式下：**

- `tool_execution_start` 在预检阶段按助手源顺序发出
- `tool_execution_update` 事件可能在不同工具间交错
- `tool_execution_end` 在每个工具完成后按工具完成顺序发出
- 最终的 `toolResult` 消息事件仍在稍后按助手源顺序发出

```typescript
pi.on('tool_execution_start', async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on('tool_execution_update', async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on('tool_execution_end', async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

### context

每次 LLM 调用前触发。以非破坏性方式修改消息。消息类型参见 [Session Format](https://pi.dev/docs/latest/session-format)。

```typescript
pi.on('context', async (event, ctx) => {
  // event.messages - 深拷贝，可安全修改
  const filtered = event.messages.filter((m) => !shouldPrune(m));
  return { messages: filtered };
});
```

### before_provider_headers

出站 HTTP 请求头组装完成后触发。用于添加、覆盖或移除请求头。处理程序直接修改 `event.headers`：设置为字符串即添加/覆盖，设置为 `null` 即删除。

```typescript
pi.on('before_provider_headers', (event, ctx) => {
  // 添加或覆盖
  event.headers['x-session-id'] = ctx.sessionManager.getSessionId();
  // 删除
  event.headers['X-OpenRouter-Title'] = null;
});
```

每个 Provider 请求只触发一次；重试复用相同请求头，不重新触发该钩子。

### before_provider_request

构建 Provider 特定负载后、请求发送前触发。处理程序按扩展加载顺序运行。返回 `undefined` 保持负载不变；返回其他值替换后续处理程序和实际请求的负载。

可重写 Provider 级别系统指令或完全删除它们。这些负载级更改**不会**反映在 `ctx.getSystemPrompt()` 中（后者报告 Pi 的系统提示字符串，而非最终序列化的 Provider 负载）。

```typescript
pi.on('before_provider_request', (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));
  // 可选：替换负载
  // return { ...event.payload, temperature: 0 };
});
```

主要用于调试 Provider 序列化和缓存行为。

### after_provider_response

收到 HTTP 响应后、消费其流内容前触发。处理程序按扩展加载顺序运行。

```typescript
pi.on('after_provider_response', (event, ctx) => {
  // event.status - HTTP 状态码
  // event.headers - 规范化的响应标头
  if (event.status === 429) {
    console.log('频率受限', event.headers['retry-after']);
  }
});
```

标头可用性取决于 Provider 和传输层。抽象 HTTP 响应的 Provider 可能不暴露标头。

## 模型事件

### model_select

通过 `/model`、模型切换（`Ctrl+P`）或会话恢复更改模型时触发。

```typescript
pi.on('model_select', async (event, ctx) => {
  // event.model - 新选择的模型
  // event.previousModel - 之前的模型（首次选择时为 undefined）
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel ? `${event.previousModel.provider}/${event.previousModel.id}` : '无';
  const next = `${event.model.provider}/${event.model.id}`;
  ctx.ui.notify(`模型已更改（${event.source}）：${prev} -> ${next}`, 'info');
});
```

用于活动模型更改时更新 UI 元素或执行模型特定的初始化。

### thinking_level_select

思考级别更改时触发。**仅通知**；处理程序返回值被忽略。

```typescript
pi.on('thinking_level_select', async (event, ctx) => {
  // event.level - 新选择的思考级别
  // event.previousLevel - 之前的思考级别
  ctx.ui.setStatus('thinking', `思考级别：${event.level}`);
});
```

`pi.setThinkingLevel()`、模型更改或内置思考级别控件更改活动思考级别时触发，用于更新扩展 UI。

## 工具事件

### tool_call

`tool_execution_start` 之后、工具执行之前触发。**可以阻止。** 用 `isToolCallEventType` 缩小范围并获得类型化输入。

`tool_call` 运行前，pi 会等待先前发出的 Agent 事件通过 `AgentSession` 完成排空。因此 `ctx.sessionManager` 已更新至当前助手工具调用消息。

**并行工具模式下：**来自同一条助手消息的兄弟工具调用会按顺序预检，然后并发执行。`tool_call` 不保证能在 `ctx.sessionManager` 中看到来自同一条助手消息的兄弟工具结果。

`event.input` **可变**。原地修改以在工具执行前修补工具参数。

**行为保证：**

- 对 `event.input` 的修改会影响实际的工具执行
- 后面的 `tool_call` 处理程序可以看到之前处理程序所做的修改
- 修改后不会重新进行验证
- `tool_call` 返回值通过 `{ block: true, reason?: string, terminate?: boolean }` 控制阻止
- `terminate` 仅适用于被阻止的调用；只有当批次中所有最终化的结果都是终止性时，agent 才会提前停止

```typescript
import { isToolCallEventType } from '@earendil-works/pi-coding-agent';

pi.on('tool_call', async (event, ctx) => {
  // event.toolName - "bash"、"read"、"write"、"edit" 等
  // event.toolCallId
  // event.input - 工具参数（可变）

  // 内置工具：不需要类型参数
  if (isToolCallEventType('bash', event)) {
    // event.input 是 { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes('rm -rf')) {
      return { block: true, reason: '危险命令', terminate: true };
    }
  }

  if (isToolCallEventType('read', event)) {
    // event.input 是 { path: string; offset?: number; limit?: number }
    console.log(`读取：${event.input.path}`);
  }
});
```

### 类型化自定义工具输入

自定义工具应导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

使用带显式类型参数的 `isToolCallEventType`：

```typescript
import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
import type { MyToolInput } from 'my-extension';

pi.on('tool_call', (event) => {
  if (isToolCallEventType<'my_tool', MyToolInput>('my_tool', event)) {
    event.input.action; // 有类型
  }
});
```

### tool_result

工具执行完成后、`tool_execution_end` 和最终 toolResult 消息事件发出之前触发。**可以修改结果。**

**并行工具模式下：**`tool_result` 和 `tool_execution_end` 可能按工具完成顺序交错，而最终的 `toolResult` 消息事件稍后按助手源顺序发出。

`tool_result` 处理程序像中间件一样链式拼接：

- 处理程序按扩展加载顺序运行
- 每个处理程序看到之前处理程序更改后的最新结果
- 处理程序可返回部分补丁（`content`、`details`、`isError` 或 `usage`）；省略的字段保持当前值

使用 `ctx.signal` 在处理程序内部执行嵌套异步工作。这让 Esc 可取消扩展启动的模型调用、`fetch()` 和其他支持中止感知的操作。

```typescript
import { isBashToolResult } from '@earendil-works/pi-coding-agent';

pi.on('tool_result', async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details 是 BashToolDetails 类型
  }

  const response = await fetch('https://example.com/summarize', {
    method: 'POST',
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // 修改结果：
  return { content: [...], details: {...}, isError: false, usage: nestedModelUsage };
});
```

## 用户 Bash 事件

### user_bash

用户执行 `!` 或 `!!` 命令时触发。**可以拦截。**

```typescript
import { createLocalBashOperations } from '@earendil-works/pi-coding-agent';

pi.on('user_bash', (event, ctx) => {
  // event.command - bash 命令
  // event.excludeFromContext - 如果使用 !! 前缀则为 true
  // event.cwd - 工作目录

  // 选项 1：提供自定义操作（例如 SSH）
  return { operations: remoteBashOps };

  // 选项 2：包装 Pi 的内置本地 bash 后端
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      },
    },
  };

  // 选项 3：完全替换——直接返回结果
  return { result: { output: '...', exitCode: 0, cancelled: false, truncated: false } };
});
```

## 输入事件

### input

收到用户输入后、扩展命令检查之后、skill 和模板扩展之前触发。事件看到的是原始输入文本，因此 `/skill:foo` 和 `/template` 尚未被扩展。

**处理顺序：**

1. 先检查扩展命令（`/cmd`）——如果找到，处理程序运行，跳过 input 事件
2. `input` 事件触发——可以拦截、转换或处理
3. 如果未处理：skill 命令（`/skill:name`）扩展为 skill 内容
4. 如果未处理：提示模板（`/template`）扩展为模板内容
5. Agent 处理开始（`before_agent_start` 等）

```typescript
pi.on('input', async (event, ctx) => {
  // event.text - 原始输入（在 skill/模板扩展之前）
  // event.images - 附带的图片（如果有）
  // event.source - "interactive"（键入）、"rpc"（API）或 "extension"（通过 sendUserMessage）
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   空闲时为 undefined，"steer" 表示流中中断，
  //   "followUp" 表示 agent 完成前排队的消息

  // 转换：在扩展前重写输入
  if (event.text.startsWith('?quick ')) return { action: 'transform', text: `简要回复：${event.text.slice(7)}` };

  // 处理：不经过 LLM 直接回复
  if (event.text === 'ping') {
    ctx.ui.notify('pong', 'info');
    return { action: 'handled' };
  }

  // 按来源路由：跳过扩展注入消息的处理
  if (event.source === 'extension') return { action: 'continue' };

  // 在扩展前拦截 skill 命令
  if (event.text.startsWith('/skill:')) {
    // 可以转换、阻止或让其通过
  }

  return { action: 'continue' }; // 默认：通过到扩展
});
```

**结果：**

- `continue`——保持不变通过（默认）
- `transform`——修改文本/图片，然后继续到扩展
- `handled`——完全跳过 Agent（第一个返回此值的处理程序生效）

转换在处理程序间链式拼接。参考 `input-transform.ts` 和 `input-transform-streaming.ts`（streamingBehavior 感知路由）。
