# 自定义 UI 参考 (Custom UI Reference)

扩展可以通过 `ctx.ui` 方法与用户交互，并自定义消息/工具的渲染方式。

> **完整组件 API 参见 [tui](https://pi.dev/docs/latest/tui)**，包含可复制粘贴模式：选择对话框（SelectList）、带取消的异步操作（BorderedLoader）、设置开关（SettingsList）、状态指示器（setStatus）、流式传输期间的工作消息/可见性/指示器、编辑器上方/下方的组件、自动补全提供者、自定义底部栏。

## 目录

- [对话框](#对话框)
  - [带倒计时的定时对话框](#带倒计时的定时对话框)
  - [使用 AbortSignal 手动关闭](#使用-abortsignal-手动关闭)
- [组件、状态和底部栏](#组件状态和底部栏)
- [自动补全提供者](#自动补全提供者)
- [自定义组件 (ctx.ui.custom)](#自定义组件-ctxuicustom)
  - [覆盖模式](#覆盖模式实验性)
- [自定义编辑器](#自定义编辑器)
- [消息和条目渲染](#消息和条目渲染)
- [Markdown 转换器](#markdown-转换器)
- [主题颜色](#主题颜色)
- [代码高亮](#代码高亮)

## 对话框

```typescript
// 从选项中选择
const choice = await ctx.ui.select('选择一个：', ['A', 'B', 'C']);

// 确认对话框
const ok = await ctx.ui.confirm('删除？', '此操作无法撤销');

// 文本输入
const name = await ctx.ui.input('姓名：', '占位符');

// 多行编辑器
const text = await ctx.ui.editor('编辑：', '预填充文本');

// 通知（非阻塞）
ctx.ui.notify('完成！', 'info'); // "info" | "warning" | "error"
```

### 带倒计时的定时对话框

对话框支持 `timeout` 选项，会在自动关闭时显示实时倒计时：

```typescript
// 对话框显示 "标题 (5s)" → "标题 (4s)" → ... → 到 0 时自动关闭
const confirmed = await ctx.ui.confirm('定时确认', '此对话框将在 5 秒后自动取消。确认吗？', { timeout: 5000 });

if (confirmed) {
  // 用户已确认
} else {
  // 用户取消或超时
}
```

**超时时的返回值：**

- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

### 使用 AbortSignal 手动关闭

如需更多控制（例如区分超时和用户取消），使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm('定时确认', '此对话框将在 5 秒后自动取消。确认吗？', {
  signal: controller.signal,
});

clearTimeout(timeoutId);

if (confirmed) {
  // 用户已确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按 Escape 或选择"否"）
}
```

参考 `examples/extensions/timed-confirm.ts`。

## 组件、状态和底部栏

```typescript
// 底部栏状态（持久存在，直到清除）
ctx.ui.setStatus('my-ext', '处理中...');
ctx.ui.setStatus('my-ext', undefined); // 清除

// 工作加载器（流式传输期间显示）
ctx.ui.setWorkingMessage('深入思考中...');
ctx.ui.setWorkingMessage(); // 恢复默认
ctx.ui.setWorkingVisible(false); // 隐藏内置工作加载器行
ctx.ui.setWorkingVisible(true); // 显示内置工作加载器行

// 工作指示器（流式传输期间显示）
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg('accent', '●')] }); // 静态点
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg('dim', '·'),
    ctx.ui.theme.fg('muted', '•'),
    ctx.ui.theme.fg('accent', '●'),
    ctx.ui.theme.fg('muted', '•'),
  ],
  intervalMs: 120,
});
ctx.ui.setWorkingIndicator({ frames: [] }); // 隐藏指示器
ctx.ui.setWorkingIndicator(); // 恢复默认旋转器

// 编辑器上方组件（默认）
ctx.ui.setWidget('my-widget', ['第1行', '第2行']);
// 编辑器下方组件
ctx.ui.setWidget('my-widget', ['第1行', '第2行'], { placement: 'belowEditor' });
ctx.ui.setWidget('my-widget', (tui, theme) => new Text(theme.fg('accent', '自定义'), 0, 0));
ctx.ui.setWidget('my-widget', undefined); // 清除

// 自定义底部栏（完全替换内置底部栏）
ctx.ui.setFooter((tui, theme) => ({
  render(width) {
    return [theme.fg('dim', '自定义底部栏')];
  },
  invalidate() {},
}));
ctx.ui.setFooter(undefined); // 恢复内置底部栏

// 终端标题
ctx.ui.setTitle('pi - my-project');

// 编辑器文本
ctx.ui.setEditorText('预填充文本');
const current = ctx.ui.getEditorText();

// 粘贴到编辑器（触发粘贴处理，包括对大内容的折叠）
ctx.ui.pasteToEditor('粘贴的内容');

// 工具输出展开
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// 自定义编辑器（vim 模式、emacs 模式等）
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent(
  (tui, theme, keybindings) => new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings)),
);
ctx.ui.setEditorComponent(undefined); // 恢复默认编辑器

// 主题管理（创建主题参见 themes.md）
const themes = ctx.ui.getAllThemes(); // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme('light'); // 加载而不切换
const result = ctx.ui.setTheme('light'); // 按名称切换
if (!result.success) {
  ctx.ui.notify(`失败：${result.error}`, 'error');
}
ctx.ui.setTheme(lightTheme!); // 或通过 Theme 对象切换
ctx.ui.theme.fg('accent', '带样式的文本'); // 访问当前主题
```

自定义工作指示器帧会原样渲染。如果需要颜色，请自行添加到帧字符串中，例如使用 `ctx.ui.theme.fg(...)`。

## 自动补全提供者

使用 `ctx.ui.addAutocompleteProvider()` 在内置斜杠命令和路径提供者之上堆叠自定义自动补全逻辑。设置 `triggerCharacters` 以使用例如 `$` 这样的自定义自然触发字符。

**典型模式：**

- 检查光标前的文本
- 当您的扩展特定语法匹配时，返回您自己的建议
- 否则委托给 `current.getSuggestions(...)`
- 委托 `applyCompletion(...)`，除非您需要自定义插入行为

```typescript
pi.on('session_start', (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ['#'],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? '';
      const beforeCursor = line.slice(0, cursorCol);
      const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: `#${match[1] ?? ''}`,
        items: [
          { value: '#2983', label: '#2983', description: '用于注册自定义 @ 自动补全提供者的扩展 API' },
          { value: '#2753', label: '#2753', description: '重新加载过时的资源设置' },
        ],
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  }));
});
```

参考 `examples/extensions/github-issue-autocomplete.ts`——使用 `gh issue list` 预加载最新的开放 GitHub Issue，并在本地过滤以实现快速的 `#...` 补全。需要 GitHub CLI（`gh`）和 GitHub 仓库签出。

## 自定义组件 (ctx.ui.custom)

对于复杂 UI，使用 `ctx.ui.custom()`。这会临时用您的组件替换编辑器，直到调用 `done()`：

```typescript
import { Text, Component } from '@earendil-works/pi-tui';

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text('按 Enter 确认，按 Escape 取消', 1, 1);

  text.onKey = (key) => {
    if (key === 'return') done(true);
    if (key === 'escape') done(false);
    return true;
  };

  return text;
});

if (result) {
  // 用户按了 Enter
}
```

回调接收：

- `tui` - TUI 实例（用于屏幕尺寸、焦点管理）
- `theme` - 用于样式的当前主题
- `keybindings` - 应用快捷键管理器（用于检查快捷键）
- `done(value)` - 调用以关闭组件并返回值

完整组件 API 参见 [tui](https://pi.dev/docs/latest/tui)。

### 覆盖模式（实验性）

传递 `{ overlay: true }` 以将组件渲染为浮动模态框，覆盖在现有内容之上，而不清除屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true },
);
```

对于高级定位（锚点、边距、百分比、响应式可见性），传递 `overlayOptions`。使用 `onHandle` 以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: 'top-right', width: '50%', margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // 聚焦此覆盖层并将其带到视觉最前
      // handle.unfocus({ target: editorComponent }); // 将输入释放给指定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    },
  },
);
```

聚焦且可见的覆盖层可在临时非覆盖层自定义 UI 关闭后重新获取输入。如果你希望另一组件在覆盖层保持可见期间继续接收输入，可调用 `handle.unfocus({ target })`。传入 `{ target: null }` 会在未聚焦任何组件的情况下释放覆盖层，直到再次设置焦点。

完整 `OverlayOptions` 和 `OverlayHandle` API 参见 [tui](https://pi.dev/docs/latest/tui)，示例参见 `examples/extensions/overlay-qa-tests.ts`。

## 自定义编辑器

用自定义实现替换主输入编辑器（vim 模式、emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { matchesKey } from '@earendil-works/pi-tui';

class VimEditor extends CustomEditor {
  private mode: 'normal' | 'insert' = 'insert';

  handleInput(data: string): void {
    if (matchesKey(data, 'escape') && this.mode === 'insert') {
      this.mode = 'normal';
      return;
    }
    if (this.mode === 'normal' && data === 'i') {
      this.mode = 'insert';
      return;
    }
    super.handleInput(data); // 应用快捷键 + 文本编辑
  }
}

export default function (pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
  });
}
```

**要点：**

- 继承 `CustomEditor`（而不是基础的 `Editor`）以获得应用快捷键（Escape 中止、ctrl+d、模型切换）
- 对于您不处理的按键，调用 `super.handleInput(data)`
- 工厂接收来自应用的 `tui`、`theme` 和 `keybindings`
- 在 `setEditorComponent()` 前使用 `ctx.ui.getEditorComponent()` 来包装先前配置的自定义编辑器
- 传递 `undefined` 以恢复默认：`ctx.ui.setEditorComponent(undefined)`

要与其他已替换编辑器的扩展组合，在设置您的编辑器之前捕获先前的工厂：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent(
  (tui, theme, keybindings) => new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) }),
);
```

参考 `examples/extensions/modal-editor.ts`——包含模式指示器的完整示例。

## 消息和条目渲染

为具有您的 `customType` 的消息注册自定义渲染器。**对于应参与 LLM 上下文的内容，使用消息渲染器：**

```typescript
import { Text } from '@earendil-works/pi-tui';

pi.registerMessageRenderer('my-extension', (message, options, theme) => {
  const { expanded, outputPad } = options;
  let text = theme.fg('accent', `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += '\n' + theme.fg('dim', JSON.stringify(message.details, null, 2));
  }

  return new Text(text, outputPad, 0);
});
```

消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: 'my-extension',  // 匹配 registerMessageRenderer
  content: '状态更新',
  display: true,               // 在 TUI 中显示
  details: { /* ... */ },      // 在渲染器中可用
});
```

**对于不应发送给 LLM 的 TUI 专用内容，应改为渲染自定义条目：**

```typescript
pi.registerEntryRenderer('my-card', (entry, options, theme) => {
  return new Text(theme.fg('accent', JSON.stringify(entry.data)));
});

pi.appendEntry('my-card', { status: 'done' });
```

## Markdown 转换器

通过 `pi.registerMarkdownTransformer()` 为普通用户文本、助手文本和 thinking 块中的 Markdown 注册转换器。参见 [api-methods.md](api-methods.md#piregistermarkdowntransformertransformer)。

**重要：**此 hook 仅用于显示：原始消息在会话和模型上下文中保持不变。

## 主题颜色

所有渲染函数都接收一个 `theme` 对象。创建自定义主题和完整色彩 palette 参见 [themes](https://pi.dev/docs/latest/themes)。

```typescript
// 前景色
theme.fg('toolTitle', text); // 工具名称
theme.fg('accent', text); // 高亮
theme.fg('success', text); // 成功（绿色）
theme.fg('error', text); // 错误（红色）
theme.fg('warning', text); // 警告（黄色）
theme.fg('muted', text); // 次要文本
theme.fg('dim', text); // 三级文本

// 文本样式
theme.bold(text);
theme.italic(text);
theme.strikethrough(text);
```

## 代码高亮

在自定义工具渲染器中用于语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from '@earendil-works/pi-coding-agent';

// 使用显式语言高亮代码
const highlighted = highlightCode('const x = 1;', 'typescript', theme);

// 从文件路径自动检测语言
const lang = getLanguageFromPath('/path/to/file.rs'); // "rust"
const highlighted = highlightCode(code, lang, theme);
```
