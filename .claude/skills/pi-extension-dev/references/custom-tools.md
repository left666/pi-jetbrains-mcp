# 自定义工具参考 (Custom Tools Reference)

通过 `pi.registerTool()` 注册 LLM 可调用的工具。工具会出现在系统提示中，并可以自定义渲染。

## 目录

- [工具定义](#工具定义)
- [promptSnippet 与 promptGuidelines](#promptsnippet-与-promptguidelines)
- [prepareArguments](#preparearguments)
- [execute 函数](#execute-函数)
  - [signal 中止](#signal-中止)
  - [onUpdate 流式进度](#onupdate-流式进度)
  - [用量统计](#用量统计)
  - [错误信号](#错误信号)
  - [提前终止](#提前终止)
- [参数模式](#参数模式)
- [状态管理](#状态管理)
- [文件修改并发](#文件修改并发)
- [覆盖内置工具](#覆盖内置工具)
- [远程执行](#远程执行)
- [输出截断](#输出截断)
- [多个工具](#多个工具)
- [自定义渲染](#自定义渲染)
  - [renderCall](#rendercall)
  - [renderResult](#renderresult)
  - [renderShell](#rendershell)
  - [快捷键提示](#快捷键提示)
  - [最佳实践](#最佳实践)
  - [后备](#后备)
- [动态工具加载](#动态工具加载)
  - [支持原生延迟加载的模型](#支持原生延迟加载的模型)
  - [回退行为](#回退行为)
  - [搜索工具示例](#搜索工具示例)

## 工具定义

```typescript
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';
import { Text } from '@earendil-works/pi-tui';

pi.registerTool({
  name: 'my_tool',
  label: '我的工具',
  description: '此工具的功能（展示给 LLM）',
  promptSnippet: '列出或添加项目待办事项中的条目',
  promptGuidelines: [
    '当用户请求任务列表时，使用 my_tool 进行待办规划，而不是直接编辑文件。',
  ],
  parameters: Type.Object({
    action: StringEnum(['list', 'add'] as const),  // 使用 StringEnum 以确保 Google 兼容性
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== 'object') return args;
    const input = args as { action?: string; oldAction?: string };
    if (typeof input.oldAction === 'string' && input.action === undefined) {
      return { ...input, action: input.oldAction };
    }
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    if (signal?.aborted) {
      return { content: [{ type: 'text', text: '已取消' }] };
    }

    onUpdate?.({
      content: [{ type: 'text', text: '工作中...' }],
      details: { progress: 50 },
    });

    const result = await pi.exec('some-command', [], { signal });

    return {
      content: [{ type: 'text', text: '完成' }],  // 发送给 LLM
      details: { data: result },                   // 用于渲染和状态
      // 可选：当该批次中每个最终确定的工具结果也返回 terminate: true 时，在此工具批次后停止
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { /* ... */ },
  renderResult(result, options, theme, context) { /* ... */ },
});
```

## promptSnippet 与 promptGuidelines

- `promptSnippet`：在默认系统提示的 `Available tools` 部分生成简短的一行条目。省略则不出现
- `promptGuidelines`：向默认系统提示的 `Guidelines` 部分添加工具特定的要点。**仅在该工具激活时包含**（例如在 `pi.setActiveTools([...])` 之后）

> **重要：** `promptGuidelines` 的要点以扁平方式追加到 `Guidelines` 部分，**没有工具名称前缀或分组**。每个准则必须明确指出其引用的工具——避免写"使用此工具当..."，因为 LLM 无法判断"此"指代哪个工具。请写"当...时使用 my_tool"。

## prepareArguments

`prepareArguments(args)` 是可选的。如果定义，它在**模式验证之前和 `execute()` 之前**运行。用于在 pi 恢复旧会话时模拟旧的可接受输入形状——旧会话中存储的工具调用参数可能不再匹配当前的模式。返回您希望根据 `parameters` 验证的对象。

保持公开模式的严格性。**不要**仅仅为了让旧的已恢复会话正常工作而向 `parameters` 添加不推荐使用的兼容性字段。

例如：旧会话可能包含带有顶层 `oldText` 和 `newText` 的 `edit` 工具调用，而当前模式只接受 `edits: [{ oldText, newText }]`：

```typescript
pi.registerTool({
  name: 'edit',
  label: '编辑',
  description: '使用精确文本替换编辑单个文件',
  parameters: Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({
        oldText: Type.String(),
        newText: Type.String(),
      }),
    ),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== 'object') return args;

    const input = args as {
      path?: string;
      edits?: Array<{ oldText: string; newText: string }>;
      oldText?: unknown;
      newText?: unknown;
    };

    if (typeof input.oldText !== 'string' || typeof input.newText !== 'string') {
      return args;
    }

    return {
      ...input,
      edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
    };
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: 'text', text: `应用 ${params.edits.length} 个编辑块` }],
      details: {},
    };
  },
});
```

## execute 函数

签名：`async execute(toolCallId, params, signal, onUpdate, ctx)`

### signal 中止

接受 `AbortSignal`。检查 `signal?.aborted` 提前返回，或将 `signal` 传给 `fetch`、模型调用、`pi.exec` 等支持中止的操作：

```typescript
async execute(toolCallId, params, signal) {
  if (signal?.aborted) {
    return { content: [{ type: 'text', text: '已取消' }] };
  }
  const result = await pi.exec('some-command', [], { signal });
  // ...
}
```

### onUpdate 流式进度

通过 `onUpdate?.()` 发出部分更新：

```typescript
onUpdate?.({
  content: [{ type: 'text', text: '工作中...' }],
  details: { progress: 50 },
});
```

### 用量统计

如果工具进行了嵌套 LLM 调用，将其合并的 `Usage` 作为 `usage` 返回。Pi 将其持久化在工具结果上，并计入 footer、`/session` 和 RPC 会话总计。`tool_result` 处理程序可以检查或替换此值。

### 错误信号

**要将工具执行标记为失败（在结果上设置 `isError: true` 并报告给 LLM），从 `execute` 抛出错误。返回值永远不会设置错误标志**，无论返回对象中包含什么属性。

```typescript
// 正确：抛出错误以表示错误
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`无效输入：${params.input}`);
  }
  return { content: [{ type: 'text', text: 'OK' }], details: {} };
}
```

### 提前终止

从 `execute()` 返回 `terminate: true` 以提示应在当前工具批次后跳过自动的后续 LLM 调用。**仅当该批次中每个最终确定的工具结果都是终止性的时才生效**。

参考 `examples/extensions/structured-output.ts`——Agent 在最终结构化输出工具调用后结束的最小示例。

## 参数模式

用 `typebox` 的 `Type.Object()` 定义参数。

> **重要：** 对于字符串枚举，使用 `@earendil-works/pi-ai` 中的 `StringEnum`。`Type.Union`/`Type.Literal` 与 Google 的 API 不兼容。

```typescript
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';

parameters: Type.Object({
  action: StringEnum(['list', 'add'] as const),
  text: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
}),
```

注意：某些模型会在工具路径参数中包含 `@` 前缀。内置工具在解析路径前会去除前导的 `@`。如果您的自定义工具接受路径，也应规范化前导的 `@`。

## 状态管理

有状态的扩展应将状态存储在工具结果的 `details` 中，以支持正确的分支：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // 从会话重建状态
  pi.on('session_start', async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === 'message' && entry.message.role === 'toolResult') {
        if (entry.message.toolName === 'my_tool') {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: 'my_tool',
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push('new item');
      return {
        content: [{ type: 'text', text: '已添加' }],
        details: { items: [...items] }, // 存储以便重建
      };
    },
  });
}
```

## 文件修改并发

如果您的自定义工具修改文件，**必须**使用 `withFileMutationQueue()` 使其与内置的 `edit` 和 `write` 参与相同的按文件队列。这很重要，因为工具调用默认**并行运行**。没有队列，两个工具可能读取相同的旧文件内容，计算不同的更新，然后后写入的那个会覆盖另一个。

**失败示例：**您的自定义工具编辑 `foo.ts`，同时内置 `edit` 在同一助手回合中也更改了 `foo.ts`。如果您的工具不参与队列，两者都读取原始的 `foo.ts`，应用各自的更改，其中一项更改将丢失。

将**实际的目标文件路径**传递给 `withFileMutationQueue()`，而不是原始用户参数。先将其解析为绝对路径，相对于 `ctx.cwd` 或您工具的工作目录。对于现有文件，该辅助方法会通过 `realpath()` 进行规范化，因此同一文件的符号链接别名共享一个队列。对于新文件，它会回退到已解析的绝对路径。

将**整个修改窗口**排入该目标路径的队列。这包括读-改-写逻辑，而不仅仅是最终写入。

```typescript
import { withFileMutationQueue } from '@earendil-works/pi-coding-agent';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, 'utf8');
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, 'utf8');

    return {
      content: [{ type: 'text', text: `已更新 ${params.path}` }],
      details: {},
    };
  });
}
```

## 覆盖内置工具

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式会在发生这种情况时显示警告。

```bash
# 扩展的 read 工具替换内置的 read
pi -e ./tool-override.ts
```

或者，使用 `--no-builtin-tools` 启动时不带任何内置工具，同时保持扩展工具启用：

```bash
pi --no-builtin-tools -e ./my-extension.ts
```

参考 `examples/extensions/tool-override.ts`——展示带日志记录和访问控制的 `read` 覆盖。

**渲染：**内置渲染器继承按插槽解析。执行覆盖和渲染覆盖是**独立**的。如果您的覆盖省略了 `renderCall`，则使用内置的 `renderCall`。如果您的覆盖省略了 `renderResult`，则使用内置的 `renderResult`。如果您的覆盖两者都省略，则自动使用内置渲染器（语法高亮、差异对比等）。这使您可以包装内置工具以进行日志记录或访问控制，而无需重新实现 UI。

**提示元数据：**`promptSnippet` 和 `promptGuidelines` **不会**被内置工具继承。如果您的覆盖应保留这些提示指令，请在覆盖中显式定义它们。

**您的实现必须匹配确切的结果形状**，包括 `details` 类型。UI 和会话逻辑依赖这些形状进行渲染和状态跟踪。

内置工具实现源代码：

- `read.ts` - `ReadToolDetails`
- `bash.ts` - `BashToolDetails`
- `edit.ts`
- `write.ts`
- `grep.ts` - `GrepToolDetails`
- `find.ts` - `FindToolDetails`
- `ls.ts` - `LsToolDetails`

## 远程执行

内置工具支持可插拔的操作，用于委派到远程系统（SSH、容器等）：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from '@earendil-works/pi-coding-agent';

// 使用自定义操作创建工具
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  },
});

// 注册，在执行时检查标志
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**操作接口：**`ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 重用 pi 的本地 Shell 后端，而无需重新实现本地进程启动、Shell 解析和进程树终止。

bash 工具还支持 spawn 钩子，用于在执行前调整命令、cwd 或环境：

```typescript
import { createBashTool } from '@earendil-works/pi-coding-agent';

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: '1' },
  }),
});
```

参考 `examples/extensions/ssh.ts`——完整 SSH 示例，包含 `--ssh` 标志。

`createBashTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 向命令暴露当前会话。注入发生在 `spawnHook` 之前，因此 hook 在 `env` 中收到这些值，并在如上展开现有环境时保留它们。设置 `exposeSessionEnvironment: false` 可禁用：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

## 输出截断

**工具必须截断其输出**，以避免淹没 LLM 上下文。大型输出可能导致：

- 上下文溢出错误（提示过长）
- 压缩失败
- 模型性能下降

内置限制为 **50KB**（约 10k token）和 **2000 行**，以先达到的为准。使用导出的截断工具：

```typescript
import {
  truncateHead,      // 保留前 N 行/字节（适合文件读取、搜索结果）
  truncateTail,      // 保留后 N 行/字节（适合日志、命令输出）
  truncateLine,      // 将单行截断为 maxBytes 并添加省略号
  formatSize,        // 人类可读的大小（例如 "50KB"、"1.5MB"）
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from '@earendil-works/pi-coding-agent';

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // 应用截断
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // 将完整输出写入临时文件
    const tempFile = writeTempFile(output);

    // 告知 LLM 在哪里可以找到完整输出
    result += `\n\n[输出已截断：${truncation.outputLines}/${truncation.totalLines} 行`;
    result += `（${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}）。`;
    result += ` 完整输出已保存至：${tempFile}]`;
  }

  return { content: [{ type: 'text', text: result }] };
}
```

**要点：**

- 对开头重要的内容使用 `truncateHead`（搜索结果、文件读取）
- 对结尾重要的内容使用 `truncateTail`（日志、命令输出）
- 始终告知 LLM 输出何时被截断以及在哪里可以找到完整版本
- 在工具描述中记录截断限制

参考 `examples/extensions/truncated-tool.ts`——包装 `rg`（ripgrep）并带有正确截断的示例。

## 多个工具

一个扩展可以使用共享状态注册多个工具：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: 'db_connect', /* ... */ });
  pi.registerTool({ name: 'db_query', /* ... */ });
  pi.registerTool({ name: 'db_close', /* ... */ });

  pi.on('session_shutdown', async () => {
    connection?.close();
  });
}
```

## 自定义渲染

工具可以提供 `renderCall` 和 `renderResult` 用于自定义 TUI 显示。完整组件 API 参见 [tui](https://pi.dev/docs/latest/tui)，工具行组合方式参见 `tool-execution.ts`。

默认情况下，工具输出包装在 `Box` 中，用于处理内边距和背景。定义的 `renderCall` 或 `renderResult` 必须返回一个 `Component`。如果某个插槽渲染器未定义，`tool-execution.ts` 会为该插槽使用后备渲染。

`renderCall` 和 `renderResult` 各自接收一个 `context` 对象，包含：

- `args` - 当前工具调用参数
- `state` - 跨 `renderCall` 和 `renderResult` 共享的行局部状态
- `lastComponent` - 该插槽先前返回的组件（如果有）
- `invalidate()` - 请求重新渲染此工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 进行跨插槽共享状态。当您希望在多次渲染间重用和修改同一组件实例时，将插槽局部缓存保留在返回的组件实例上。

### renderCall

渲染工具调用或头部：

```typescript
import { Text } from '@earendil-works/pi-tui';

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text('', 0, 0);
  let content = theme.fg('toolTitle', theme.bold('my_tool '));
  content += theme.fg('muted', args.action);
  if (args.text) {
    content += ' ' + theme.fg('dim', `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

### renderResult

渲染工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg('warning', '处理中...'), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg('error', `错误：${result.details.error}`), 0, 0);
  }

  let text = theme.fg('success', '✓ 完成');
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += '\n  ' + theme.fg('dim', item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果某个插槽有意不显示可见内容，返回一个空的 `Component`，例如空的 `Container`。

### renderShell

当工具应渲染自己的外壳而不是使用默认的 `Box` 时，设置 `renderShell: "self"`。这对需要完全控制框架或背景行为的工具很有用，例如在工具稳定后必须保持视觉稳定的大型预览。

```typescript
pi.registerTool({
  name: 'my_tool',
  label: '我的工具',
  description: '自定义外壳示例',
  parameters: Type.Object({}),
  renderShell: 'self',
  async execute() {
    return { content: [{ type: 'text', text: 'ok' }], details: undefined };
  },
  renderCall(args, theme, context) {
    return new Text(theme.fg('accent', '我的自定义外壳'), 0, 0);
  },
});
```

### 快捷键提示

使用 `keyHint()` 显示尊重活动快捷键配置的快捷键提示：

```typescript
import { keyHint } from '@earendil-works/pi-coding-agent';

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg('success', '✓ 完成');
  if (!expanded) {
    text += ` (${keyHint('app.tools.expand', '展开')})`;
  }
  return new Text(text, 0, 0);
}
```

可用函数：

- `keyHint(keybinding, description)` - 格式化已配置的快捷键 ID，如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回快捷键 ID 的原始已配置键文本
- `rawKeyHint(key, description)` - 格式化原始快捷键字符串

使用带命名空间的快捷键 ID：

- 编码代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

快捷键 ID 和默认值的详尽列表参见 [keybindings](https://pi.dev/docs/latest/keybindings)。`keybindings.json` 使用相同的带命名空间 ID。

自定义编辑器和 `ctx.ui.custom()` 组件接收 `keybindings: KeybindingsManager` 作为注入参数。它们应直接使用注入的管理器，而不是调用 `getKeybindings()` 或 `setKeybindings()`。

### 最佳实践

- 使用带内边距 `(0, 0)` 的 `Text`。默认的 `Box` 处理内边距
- 使用 `\n` 处理多行内容
- 处理 `isPartial` 以支持流式进度
- 支持 `expanded` 以按需显示详情
- 保持默认视图紧凑
- 在 `renderResult` 中读取 `context.args`，而不是将 args 复制到 `context.state` 中
- 仅将必须跨调用和结果插槽共享的数据放入 `context.state`
- 当相同组件实例可以原地更新时，重用 `context.lastComponent`
- 仅在默认的盒式外壳妨碍您时使用 `renderShell: "self"`。在自外壳模式下，工具负责自己的框架、内边距和背景

### 后备

如果插槽渲染器未定义或抛出：

- `renderCall`：显示工具名称
- `renderResult`：显示 `content` 中的原始文本

## 动态工具加载

扩展可以注册大量工具，同时只保持少量初始工具处于激活状态。然后工具可以在执行期间通过 `pi.setActiveTools()` 添加更多工具。Pi 检测纯增量更改，在该工具结果上记录新可用的工具名称，并在下一次模型请求之前应用更新后的激活集。

**适用于所有模型。**支持原生延迟加载的模型保留稳定的提示前缀，并在工具结果位置加载新定义。其他模型使用下文描述的回退方案。

**生命周期：**

1. 使用 `pi.registerTool()` 注册每个工具，使其出现在 `pi.getAllTools()` 中
2. 保持加载器工具（如 `search_tools`）处于激活状态，将可搜索工具保持为非激活状态
3. 在加载器执行期间，调用 `pi.setActiveTools([...currentTools, ...matchingTools])`。**更改必须是增量的**：不要在同一调用中移除当前激活的工具
4. Pi 在加载器的工具结果上记录添加了哪些工具
5. 在下一次模型响应之前，Pi 在支持原生延迟加载时使用原生延迟加载暴露添加的定义，否则使用常规激活工具列表

您不需要返回 Provider 特定的工具引用或将加载器标记为特殊的搜索工具。激活工具集的更改就是信号。传递给 `pi.setActiveTools()` 的名称必须已经注册；未知名称会被忽略。

### 支持原生延迟加载的模型

- **Anthropic**
  - **模型：** Sonnet、Opus、Fable 版本 4.5 或更新（不含 Haiku）
  - **原生表示：** 延迟定义使用 `defer_loading`；加载点使用 `tool_reference` 内容
- **OpenAI**
  - **模型：** `gpt-5.4` 及更新系列
  - **原生表示：** Pi 在加载点添加已完成的客户端 `tool_search_call` 和 `tool_search_output` 项

对于已验证的自定义模型或代理，可以通过为 `anthropic-messages` 设置 `compat.supportsToolReferences: true`，或为 `openai-responses` 和 `openai-codex-responses` 设置 `compat.supportsToolSearch: true` 来启用原生处理。除非端点和模型接受相应的原生协议，否则请保持这些选项禁用。

### 回退行为

对于所有其他模型和 Provider，动态激活仍然有效：Pi 在下一次请求中正常发送完整的当前激活工具列表。模型可以调用新激活的工具，但添加其定义可能会使 Provider 的缓存提示前缀失效。

当激活集不是纯增量时（例如用一组工具替换另一组），Pi 也会使用此安全回退。因此工具移除仍然有效，但不会使用延迟加载。

为了获得最佳的缓存行为，请在整个会话中保持加载器工具处于激活状态，并**添加工具而不是替换激活集**。另请注意，激活带有 `promptSnippet` 或 `promptGuidelines` 的工具会重建系统提示；即使 Provider 支持延迟模式，该系统提示更改也可能使前缀失效。延迟加载的工具通常应依赖其工具 `description`，并省略仅激活时的提示元数据。

### 搜索工具示例

以下扩展注册了两个可搜索工具，将它们从初始激活集中移除，并仅保留 `search_tools` 作为其加载器。该示例使用简单的关键词匹配，但搜索实现可以使用 BM25、嵌入、远程目录或项目特定的路由。

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const SEARCHABLE_TOOL_NAMES = new Set(['lookup_weather', 'search_issues']);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'lookup_weather',
    label: '查询天气',
    description: '查询城市的当前天气',
    parameters: Type.Object({ city: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text', text: `${params.city} 的天气：晴朗` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: 'search_issues',
    label: '搜索 Issue',
    description: '按关键词搜索项目 Issue',
    parameters: Type.Object({ query: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text', text: `没有匹配 ${params.query} 的开放 Issue` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: 'search_tools',
    label: '搜索工具',
    description: '搜索并启用与任务相关的工具',
    promptSnippet: '当激活的工具无法执行任务时搜索其他工具',
    promptGuidelines: ['当任务需要当前不可用的能力时使用 search_tools。'],
    parameters: Type.Object({
      query: Type.String({ description: '要搜索的能力或任务' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
    }),
    async execute(_toolCallId, params) {
      const terms = params.query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      const matches = pi
        .getAllTools()
        .filter((tool) => SEARCHABLE_TOOL_NAMES.has(tool.name))
        .map((tool) => ({
          tool,
          score: terms.reduce(
            (score, term) => score + (`${tool.name} ${tool.description}`.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit ?? 3)
        .map((match) => match.tool.name);

      if (matches.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到匹配 ${params.query} 的工具` }],
          details: { matches: [] },
        };
      }

      const active = pi.getActiveTools();
      const added = matches.filter((name) => !active.includes(name));
      pi.setActiveTools([...new Set([...active, ...added])]);

      return {
        content: [
          {
            type: 'text',
            text: added.length > 0 ? `已加载工具：${added.join(', ')}` : `匹配的工具已激活：${matches.join(', ')}`,
          },
        ],
        details: { matches, added },
      };
    },
  });

  pi.on('session_start', () => {
    // 保持可搜索工具已注册但初始不激活。保留内置工具
    // 和其他扩展拥有的工具，并保持加载器本身激活
    const initialTools = pi.getActiveTools().filter((name) => !SEARCHABLE_TOOL_NAMES.has(name));
    pi.setActiveTools([...new Set([...initialTools, 'search_tools'])]);
  });
}
```

当 `search_tools` 添加匹配项时，模型会在紧随其后的请求中收到该定义。在支持原生能力的模型上，定义锚定在搜索结果之后，而不更改初始工具模式前缀。在其他模型上，它出现在同一后续请求的常规工具列表中。
