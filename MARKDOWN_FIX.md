# Markdown 渲染优化说明

## 问题修复

### 1. 代码块双重黑框问题
**原因**: ReactMarkdown 默认会将代码包裹在 `<pre><code>` 标签中，而我们的自定义 CodeBlock 又添加了一层 pre 标签，导致双重渲染。

**解决方案**:
- 在 ReactMarkdown 的 `components` 中添加自定义 `pre` 渲染器，直接返回 children
- 让 CodeBlock 组件完全接管代码块的渲染
- 使用专用的 `.code-block-pre` 类名，避免全局 pre 样式冲突

```tsx
components={{
  pre({ children }) {
    return <>{children}</>;
  }
}}
```

### 2. 表格多余空列问题
**原因**: 表格使用 `display: block` 导致布局异常。

**解决方案**:
- 移除 `display: block`
- 将表格包裹在带 `overflow-x: auto` 的 div 中实现横向滚动
- 使用 `overflow: hidden` 配合 `border-radius` 实现圆角效果

```tsx
components={{
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  }
}}
```

### 3. 表格内代码渲染问题
**原因**: 表格单元格内的代码块会撑开表格宽度。

**解决方案**:
- 添加 `.prose-chat td code { white-space: nowrap; }` 防止代码换行
- 设置 `vertical-align: top` 确保单元格内容顶部对齐
- 使用 `word-break: break-word` 处理超长文本

### 4. 文字被代码框挤压问题
**原因**: 缺少合适的文本溢出处理。

**解决方案**:
- 在 `.prose-chat` 容器添加 `word-break: break-word`
- 确保代码块宽度不会超出容器
- 使用 `overflow-x: auto` 让代码块可横向滚动

## 新增功能

### 消息复制按钮
- **用户消息**: 悬停时在右下方显示编辑和复制按钮
- **AI 消息**: 底部显示复制和重新生成按钮
- 使用 `navigator.clipboard.writeText()` 实现一键复制

## CSS 优化

### 代码块样式
```css
.code-block-pre {
  background: hsl(40 7% 9%);
  border-radius: 0 0 0.5rem 0.5rem; /* 只有底部圆角 */
  padding: 1rem 1.15rem;
  margin: 0; /* 避免多余间距 */
}
```

### 表格样式
```css
.prose-chat table {
  border-collapse: collapse;
  border-radius: 0.5rem;
  overflow: hidden; /* 圆角生效 */
  /* 移除了 display: block */
}

.prose-chat td {
  vertical-align: top; /* 单元格内容顶部对齐 */
}

.prose-chat td code {
  white-space: nowrap; /* 表格内代码不换行 */
}
```

## 技术细节

### ReactMarkdown 自定义渲染器
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    // 防止代码块双层包裹
    pre({ children }) {
      return <>{children}</>;
    },
    // 表格横向滚动
    table({ children }) {
      return (
        <div className="my-4 overflow-x-auto">
          <table>{children}</table>
        </div>
      );
    },
    // 自定义代码块
    code({ inline, className, children, ...props }) {
      const content = String(children).replace(/\n$/, "");
      return inline ? (
        <code className={className} {...props}>
          {children}
        </code>
      ) : (
        <CodeBlock className={className}>{content}</CodeBlock>
      );
    }
  }}
>
  {message.content}
</ReactMarkdown>
```

### 代码块组件结构
```tsx
<div className="code-block-wrapper">
  {/* 顶部工具栏 */}
  <div className="bg-[#2d2d2d] rounded-t-lg">
    <span>{language}</span>
    <button>复制</button>
  </div>
  {/* 代码内容 */}
  <pre className="code-block-pre !rounded-t-none">
    <code>{children}</code>
  </pre>
</div>
```

## 用户体验改进

1. **清晰的代码呈现**: 单层黑框，顶部显示语言类型
2. **正常的表格布局**: 无多余空列，支持横向滚动
3. **表格内代码**: 不换行，不破坏布局
4. **便捷的复制功能**: 每条消息都可一键复制
5. **响应式设计**: 表格过宽时自动显示滚动条

## 参考 Claude.ai 官方设计

- **代码块**: 深色背景 (#2d2d2d)，圆角设计，顶部工具栏
- **表格**: 简洁边框，悬停高亮，圆角处理
- **按钮**: 小巧的图标按钮，悬停时高亮
- **布局**: 不破坏文字流，自然的间距

## 浏览器兼容性

- 复制功能需要 HTTPS 或 localhost 环境
- 使用现代 CSS Grid 和 Flexbox 布局
- 支持 Chrome 90+、Firefox 90+、Safari 14+、Edge 90+
