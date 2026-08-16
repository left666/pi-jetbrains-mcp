# ExtensionAPI 方法参考 (pi.* Methods)

所有方法通过工厂函数接收的 `pi: ExtensionAPI` 调用。

## 目录

- [pi.on(event, handler)](#pionevent-handler)
- [pi.registerTool(definition)](#piregistertooldefinition)
- [消息注入](#消息注入)
  - [pi.sendMessage(message, options?)](#pisendmessagemessage-options)
  - [pi.sendUserMessage(content, options?)](#pisendusermessagecontent-options)
- [pi.appendEntry(customType, data?)](#piappendentrycustomtype-data)
- [会话名称与标签](#会话名称与标签)
  - [pi.setSessionName(name) / pi.getSessionName()](#pisetsessionnamename--pigetsessionname)
  - [pi.setLabel(entryId, label)](#pisetlabelentryid-label)
- [命令](#命令)
  - [pi.registerCommand(name, options)](#piregistercommandname-options)
  - [pi.getCommands()](#pigetcommands)
- [渲染器注册](#渲染器注册)
  - [pi.registerMessageRenderer(customType, renderer)](#piregistermessagerenderercustomtype-renderer)
  - [pi.registerMarkdownTransformer(transformer)](#piregistermarkdowntransformertransformer)
  - [pi.registerEntryRenderer(customType, renderer)](#piregisterentryrenderercustomtype-renderer)
- [快捷键和标志](#快捷键和标志)
  - [pi.registerShortcut(shortcut, options)](#piregistershortcutshortcut-options)
  - [pi.registerFlag(name, options)](#piregisterflagname-options)
- [pi.exec(command, args, options?)](#piexeccommand-args-options)
- [工具激活集管理](#工具激活集管理)
  - [pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)](#pigetactivetools--pigetalltools--pisetactivetoolsnames)
- [模型与思考级别](#模型与思考级别)
  - [pi.setModel(model)](#pisetmodelmodel)
  - [pi.getThinkingLevel() / pi.setThinkingLevel(level)](#pigetthinkinglevel--pisetthinkinglevellevel)
- [pi.events](#pievents)
- [Provider](#provider)
  - [pi.registerProvider(name | provider, config?)](#piregisterprovidername--provider-config)
  - [pi.unregisterProvider(name)](#piunregisterprovidername)

## pi.on(event, handler)

订阅事件。事件类型和返回值参见 [events.md](events.md)。

## pi.registerTool(definition)

注册 LLM 可调用的自定义工具。完整详情参见 [custom-tools.md](custom-tools.md)。

`pi.registerTool()` 在扩展加载期间和启动后都可以工作。可在 `session_start`、命令处理程序或其他事件处理程序中调用它。新工具在同一会话中立即刷新，会出现在 `pi.getAllTools()` 中，无需 `/reload` 即可被 LLM 调用。

使用 `pi.setActiveTools()` 在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 将自定义工具选择为 `Available tools` 中的一行条目，使用 `promptGuidelines` 在工具激活时向默认 `Guidelines` 部分追加特定于工具的要点。

> **重要：** `promptGuidelines` 的要点以扁平方式追加到 `Guidelines` 部分，没有工具名称前缀。每个准则必须明确指出其引用的工具——避免写"使用此工具当..."，因为 LLM 无法判断"此"指代哪个工具。请写"当...时使用 my_tool"。

```typescript
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';

pi.registerTool({
  name: 'my_tool',
  label: '我的工具',
  description: '此工具的功能',
  promptSnippet: '根据操作汇总或转换文本',
  promptGuidelines: ['当用户要求汇总之前生成的文本时使用 my_tool。'],
  parameters: Type.Object({
    action: StringEnum(['list', 'add'] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选兼容性 shim。在模式验证前运行。
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 流式进度
    onUpdate?.({ content: [{ type: 'text', text: '工作中...' }] });

    return {
      content: [{ type: 'text', text: '完成' }],
      details: { result: '...' },
      // usage: nestedModelResponse.usage,          // 可选嵌套 LLM 用量
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { /* ... */ },
  renderResult(result, options, theme, context) { /* ... */ },
});
```

## 消息注入

### pi.sendMessage(message, options?)

向会话注入自定义消息。自定义消息参与 LLM 上下文。对于不应发送给 LLM 的持久 TUI 专用内容，请使用带 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer) 的 [`pi.appendEntry()`](#piappendentrycustomtype-data)。

```typescript
pi.sendMessage({
  customType: 'my-extension',
  content: '消息文本',
  display: true,
  details: { /* ... */ },
}, {
  triggerTurn: true,
  deliverAs: 'steer',
});
```

**选项：**

- `deliverAs` - 传递模式：
  - `"steer"`（默认）- 在流式传输时排队。在当前助手回合完成工具调用后、下一次 LLM 调用之前传递
  - `"followUp"` - 等待 Agent 完成。仅当 Agent 不再有工具调用时传递
  - `"nextTurn"` - 排队用于下一次用户提示。不中断或触发任何操作
- `triggerTurn: true` - 如果 Agent 空闲，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（`"nextTurn"` 忽略此选项）

### pi.sendUserMessage(content, options?)

向 Agent 发送用户消息。不同于 `sendMessage()` 发送自定义消息，此方法发送一条实际用户消息，看起来像是用户键入的。**始终触发一个回合。**

```typescript
// 纯文本消息
pi.sendUserMessage('2+2 等于多少？');

// 带内容数组（文本 + 图片）
pi.sendUserMessage([
  { type: 'text', text: '描述这张图片：' },
  { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: '...' } },
]);

// 流式传输期间 - 必须指定传递模式
pi.sendUserMessage('关注错误处理', { deliverAs: 'steer' });
pi.sendUserMessage('然后进行汇总', { deliverAs: 'followUp' });

// 启用扩展命令分派和 skill/prompt 模板展开
pi.sendUserMessage('/review src/index.ts', { expandPromptTemplates: true });
```

**选项：**

- `deliverAs` - Agent 正在流式传输时需要：
  - `"steer"` - 将消息排队，在当前助手回合完成工具调用后传递
  - `"followUp"` - 等待 Agent 完成所有工具
- `expandPromptTemplates` - 分派扩展命令，并展开 Skill 命令和 Prompt 模板。默认为 `false`

不在流式传输时，消息会立即发送并触发新回合。在流式传输时如果未提供 `deliverAs`，会抛出错误。

## pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目**不参与 LLM 上下文**。在交互模式下，当与 `pi.registerEntryRenderer()` 配合使用时，它们也可以在聊天记录中渲染。

```typescript
pi.appendEntry('my-state', { count: 42 });
pi.appendEntry('status-card', { title: '已索引文件', count: 17 });

// 在重载时恢复
pi.on('session_start', async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === 'custom' && entry.customType === 'my-state') {
      // 从 entry.data 重建
    }
  }
});
```

## 会话名称与标签

### pi.setSessionName(name) / pi.getSessionName()

设置/获取会话显示名称（在会话选择器中显示，而不是第一条消息）。

```typescript
pi.setSessionName('重构认证模块');

const name = pi.getSessionName();
if (name) {
  console.log(`会话：${name}`);
}
```

### pi.setLabel(entryId, label)

设置或清除条目上的标签。标签是用户定义的标记，用于书签和导航（在 `/tree` 选择器中显示）。

```typescript
// 设置标签
pi.setLabel(entryId, 'checkpoint-before-refactor');

// 清除标签
pi.setLabel(entryId, undefined);

// 通过 sessionManager 读取标签
const label = ctx.sessionManager.getLabel(entryId);
```

标签在会话中持久保存，并在重启后保留。用于标记对话树中的重要点（回合、检查点）。

## 命令

### pi.registerCommand(name, options)

注册命令。如果多个扩展注册了相同的命令名称，pi 会全部保留，并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand('stats', {
  description: '显示会话统计',
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} 个条目`, 'info');
  },
});
```

可选：为 `/command ...` 添加参数自动补全：

```typescript
import type { AutocompleteItem } from '@earendil-works/pi-tui';

pi.registerCommand('deploy', {
  description: '部署到环境',
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ['dev', 'staging', 'prod'];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`部署到：${args}`, 'info');
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、prompt 模板和 skill 命令。列表顺序与 RPC `get_commands` 一致：扩展优先，然后是模板，最后是 skill。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === 'extension');
const userScoped = commands.filter((command) => command.sourceInfo.scope === 'user');
```

每个条目的结构：

```typescript
{
  name: string; // 可调用的命令名称，不含前导斜杠。可能带有后缀如 "review:1"
  description?: string;
  source: 'extension' | 'prompt' | 'skill';
  sourceInfo: {
    path: string;
    source: string;
    scope: 'user' | 'project' | 'temporary';
    origin: 'package' | 'top-level';
    baseDir?: string;
  };
}
```

使用 `sourceInfo` 作为规范来源字段。**不要**从命令名称或临时路径解析推断所有权。

内置交互命令（如 `/model` 和 `/settings`）不包括在此列表中。它们仅在交互模式下处理，通过 `prompt` 发送不会执行。

## 渲染器注册

### pi.registerMessageRenderer(customType, renderer)

为具有您的 `customType` 的自定义消息注册自定义 TUI 渲染器。自定义消息通过 `pi.sendMessage()` 创建并参与 LLM 上下文。参见 [custom-ui.md](custom-ui.md)。

### pi.registerMarkdownTransformer(transformer)

为普通用户文本、助手文本和 thinking 块中的 Markdown 注册转换器。转换器按扩展加载顺序执行，每个转换器接收上一个转换器返回的 Markdown。链执行完毕后，Pi 使用内置渲染器渲染转换后的内容。

转换器接收 Markdown 字符串和一个上下文对象：

- `messageType` — `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 对部分助手更新为 `true`；对用户、已完成的助手和恢复的消息为 `false`
- `availableWidth` — 转换后 Markdown 内容可用的精确终端列数

返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === 'assistant-thinking') return markdown;
  return markdown.replaceAll('-->', '→');
});
```

如果转换器抛出异常，Pi 保留目前生成的 Markdown 并继续执行下一个转换器。**此 hook 仅用于显示**：原始消息在会话和模型上下文中保持不变。它在新用户消息、助手流式更新、恢复的会话消息和终端宽度变化时运行，因此转换器应保持同步且开销低廉。

### pi.registerEntryRenderer(customType, renderer)

为具有您的 `customType` 的自定义条目注册自定义 TUI 渲染器。自定义条目通过 `pi.appendEntry()` 创建，**不参与 LLM 上下文**。

```typescript
import { Box, Text } from '@earendil-works/pi-tui';

pi.registerEntryRenderer('status-card', (entry, { expanded }, theme) => {
  const data = entry.data as { title: string; count: number };
  const box = new Box(1, 1, (text) => theme.bg('customMessageBg', text));
  box.addChild(new Text(`${theme.bold(data.title)}: ${data.count}`));
  if (expanded) {
    box.addChild(new Text(theme.fg('dim', JSON.stringify(data, null, 2))));
  }
  return box;
});

pi.appendEntry('status-card', { title: '已索引文件', count: 17 });
```

## 快捷键和标志

### pi.registerShortcut(shortcut, options)

注册键盘快捷键。快捷键格式和内置快捷键参见 [keybindings](https://pi.dev/docs/latest/keybindings)。

```typescript
pi.registerShortcut('ctrl+shift+p', {
  description: '切换计划模式',
  handler: async (ctx) => {
    ctx.ui.notify('已切换！', 'info');
  },
});
```

### pi.registerFlag(name, options)

注册 CLI 标志。

```typescript
pi.registerFlag('plan', {
  description: '以计划模式启动',
  type: 'boolean',
  default: false,
});

// 检查值
if (pi.getFlag('plan')) {
  // 计划模式已启用
}
```

## pi.exec(command, args, options?)

执行 Shell 命令。

```typescript
const result = await pi.exec('git', ['status'], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

## 工具激活集管理

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。适用于内置工具和动态注册的工具。

- `pi.getActiveTools()` 返回活跃工具名称，类型为 `string[]`
- `pi.getAllTools()` 返回所有已配置工具的元数据

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "读取文件内容...",
//   parameters: ...,
//   promptGuidelines: ["Use read to examine files instead of cat or sed."],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === 'builtin');
const extensionTools = all.filter((t) => t.sourceInfo.source !== 'builtin' && t.sourceInfo.source !== 'sdk');
pi.setActiveTools([...new Set([...active, 'my_custom_tool'])]); // 保留当前工具并启用 my_custom_tool
pi.setActiveTools(['read', 'bash']); // 切换到只读
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

典型的 `sourceInfo.source` 值：

- `builtin` 用于内置工具
- `sdk` 用于通过 `createAgentSession({ customTools })` 传递的工具
- 扩展源元数据用于扩展注册的工具

## 模型与思考级别

### pi.setModel(model)

设置当前模型。如果模型没有可用 API 密钥，返回 `false`。自定义模型配置参见 [models](https://pi.dev/docs/latest/models)。

```typescript
const model = ctx.modelRegistry.find('anthropic', 'claude-sonnet-4-5');
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify('此模型没有 API 密钥', 'error');
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取或设置思考级别。级别会被限制到模型能力范围内（非推理模型始终使用 `"off"`）。更改会触发 `thinking_level_select`。

```typescript
const current = pi.getThinkingLevel(); // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel('high');
```

## pi.events

扩展间通信的共享事件总线：

```typescript
pi.events.on('my:event', (data) => { /* ... */ });
pi.events.emit('my:event', { /* ... */ });
```

## Provider

### pi.registerProvider(name | provider, config?)

动态注册或覆盖模型 Provider。适用于代理、自定义端点或团队范围的模型配置。

在扩展工厂函数中进行的调用会排队，并在运行器初始化时应用。之后进行的调用——例如来自用户设置流程后的命令处理程序——立即生效，无需 `/reload`。

动态 Provider 可以实现 `refreshModels`。Pi 在模型刷新期间调用它，通过 Provider 同步发布返回的列表，并传入规范的凭证/已存储目录/网络/信号上下文。扩展通过经过代际检查的 `context.publish({ persist: entry })` 决定是否持久化目录元数据；如 llama.cpp 等实时服务器可以直接返回模型而不持久化它们。

`context.signal` 始终是具体的信号，Provider 回调必须将其传给阻塞 I/O。公开的 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 调用接受可选信号，省略时不受时限约束。取消会停止调用方的等待（即使 Provider 忽略信号），但停止底层工作仍需要配合。

需要原生 Provider 认证、过滤、刷新或流行为的扩展可以从 `@earendil-works/pi-ai` 注册一个完整的 `Provider`。该 Provider 成为组合基础，`models.json` 覆盖仍然在其之上应用。

```typescript
import { createProvider, openAICompletionsApi } from '@earendil-works/pi-ai';

const provider = createProvider({
  id: 'local-server',
  name: 'Local Server',
  baseUrl: 'http://localhost:8080/v1',
  auth: {
    apiKey: {
      name: 'Local server setup',
      async login(interaction) {
        return {
          type: 'api_key',
          key: await interaction.prompt({ type: 'secret', message: 'API key' }),
        };
      },
      async resolve({ credential }) {
        return credential?.key
          ? { auth: { apiKey: credential.key }, source: 'stored API key' }
          : undefined;
      },
    },
  },
  models: [],
  api: openAICompletionsApi(),
});

pi.registerProvider(provider);
```

#### 旧版配置形式

```typescript
// 使用自定义模型注册新 Provider
pi.registerProvider('my-proxy', {
  name: '我的代理',
  baseUrl: 'https://proxy.example.com',
  apiKey: '$PROXY_API_KEY',  // 环境变量引用
  api: 'anthropic-messages',
  models: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude 4 Sonnet（代理）',
      reasoning: false,
      input: ['text', 'image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384,
    },
  ],
});

// 覆盖现有 Provider 的 baseUrl（保留所有模型）
pi.registerProvider('anthropic', {
  baseUrl: 'https://proxy.example.com',
});

// 注册不持久化已发现模型的实时 llama.cpp 目录
pi.registerProvider('llama.cpp', {
  baseUrl: 'http://localhost:8080/v1',
  apiKey: 'local',
  api: 'openai-completions',
  async refreshModels({ signal }) {
    const response = await fetch('http://localhost:8080/v1/models', { signal });
    const { data } = await response.json();
    return data.map(({ id }) => ({
      id,
      name: id,
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384,
    }));
  },
});

// 注册支持 OAuth 的 Provider 以支持 /login
pi.registerProvider('corporate-ai', {
  baseUrl: 'https://ai.corp.com',
  api: 'openai-responses',
  models: [/* ... */],
  oauth: {
    name: '企业 AI（SSO）',
    async login(callbacks) {
      callbacks.onAuth({ url: 'https://sso.corp.com/...' });
      const code = await callbacks.onPrompt({ message: '输入代码：' });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials, signal) {
      signal.throwIfAborted();
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    },
  },
});
```

对象形式接受完整的 pi-ai `Provider`，包括原生 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**旧版配置选项：**

- `name` - Provider 在 UI 中（如 `/login`）的显示名称
- `baseUrl` - API 端点 URL。定义模型时需要
- `apiKey` - API 密钥字面值、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`）或前导 `!command`。定义模型时需要（除非提供了 `oauth`）。`$$` 转义 `$`，`$!` 转义字面 `!` 而不触发命令执行
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等
- `headers` - 要包含在请求中的自定义标头
- `authHeader` - 如果为 true，自动添加 `Authorization: Bearer` 标头
- `models` - 模型定义数组。如果提供，替换此 Provider 的所有现有模型。模型定义可以设置 `baseUrl` 以覆盖该模型的 Provider 端点
- `refreshModels` - 异步动态发现回调。其返回的模型替换扩展提供的模型。`context.stored` 包含已持久化的 Provider 快照；仅在需要更新目录数据时使用经过代际检查的 `context.publish({ persist: entry })`。使用 `persist: null` 删除该快照
- `oauth` - 支持 `/login` 的 OAuth Provider 配置。提供后，该 Provider 会出现在登录菜单中
- `streamSimple` - 用于非标准 API 的自定义流式实现

高级主题（自定义流式 API、OAuth 详情、模型定义参考）参见 [custom-provider](https://pi.dev/docs/latest/custom-provider)。

### pi.unregisterProvider(name)

移除先前注册的 Provider 及其模型。被该 Provider 覆盖的内置模型会被恢复。如果该 Provider 未注册，则无效果。

与 `registerProvider` 类似，在初始加载阶段之后调用时立即生效，无需 `/reload`。

```typescript
pi.registerCommand('my-setup-teardown', {
  description: '移除自定义代理 Provider',
  handler: async (_args, _ctx) => {
    pi.unregisterProvider('my-proxy');
  },
});
```
