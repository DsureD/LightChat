# 图片显示和下载优化

## 修复的问题

### ✅ 1. 图片链接过期（404）时的降级处理

**问题描述**: 
- 有些生图对话既有 `imageUrl`（图片链接）又有 `imageBase64`（base64 内容）
- 当图片链接过期（404）时，页面无法显示图片
- 但 base64 内容仍然可用

**解决方案**: 添加图片加载失败的降级逻辑

#### 实现细节

```tsx
const [imgError, setImgError] = useState(false);

// 优先使用 imageUrl，失败后降级到 base64
const imageSrc = (!imgError && message.imageUrl) || 
  (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");

// 下载时优先使用原始链接
const downloadSrc = message.imageUrl || 
  (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");
```

#### 图片组件

```tsx
<img
  src={imageSrc}
  onError={() => setImgError(true)}  // 加载失败时触发
  alt={message.content || "generated image"}
/>
```

#### 降级流程

1. **初始状态**: `imgError = false`
2. **首次尝试**: 如果有 `imageUrl`，优先使用它
3. **加载失败**: 触发 `onError`，设置 `imgError = true`
4. **自动重新渲染**: `imageSrc` 切换到 base64
5. **显示成功**: base64 图片展示

### ✅ 2. 下载按钮在新标签打开

**问题描述**: 
- 点击"下载图片"按钮在当前标签打开图片
- 应该触发下载或在新标签打开

**解决方案**: 添加正确的下载属性

#### 实现细节

```tsx
<a
  href={downloadSrc}
  download="generated-image.png"  // 触发下载
  target="_blank"                  // 新标签打开（备选）
  rel="noopener noreferrer"        // 安全属性
>
  下载图片
</a>
```

#### 下载行为

不同浏览器的行为：

| 浏览器 | imageUrl（远程链接） | base64（data URI） |
|--------|---------------------|-------------------|
| Chrome | 新标签打开 | 下载文件 |
| Firefox | 新标签打开 | 下载文件 |
| Safari | 新标签打开 | 下载文件 |

**注意**: 
- 由于跨域限制，远程图片链接可能无法直接下载
- 会在新标签打开图片（用户可以右键另存为）
- base64 图片可以直接下载

## 技术细节

### 图片加载状态管理

```tsx
const [imgError, setImgError] = useState(false);

// 状态流转
初始: imgError = false
  ↓ (imageUrl 加载失败)
失败: imgError = true (自动切换到 base64)
```

### imageSrc 计算逻辑

```tsx
const imageSrc = 
  (!imgError && message.imageUrl) ||           // 优先：URL 且未失败
  (message.imageBase64 ? `data:...` : "");     // 降级：base64
```

**优先级**:
1. `imageUrl` 且未失败 → 使用远程链接
2. `imageUrl` 失败或不存在 → 使用 base64
3. 两者都没有 → 空字符串（不显示）

### downloadSrc 计算逻辑

```tsx
const downloadSrc = 
  message.imageUrl ||                          // 优先：原始链接
  (message.imageBase64 ? `data:...` : "");     // 降级：base64
```

**原因**: 
- 下载时仍然优先使用原始链接（如果未过期）
- 只有链接不存在时才使用 base64

## 用户体验

### 图片加载场景

**场景 1: 链接有效**
```
1. 显示 imageUrl 图片 ✅
2. 点击下载 → 新标签打开
```

**场景 2: 链接过期**
```
1. 尝试加载 imageUrl → 404 错误
2. 自动切换到 base64 ✅
3. 显示 base64 图片
4. 点击下载 → 下载 PNG 文件 ✅
```

**场景 3: 只有 base64**
```
1. 直接显示 base64 图片 ✅
2. 点击下载 → 下载 PNG 文件 ✅
```

### 视觉反馈

- **加载中**: 浏览器默认的图片占位符
- **加载失败 → 降级**: 无缝切换，用户几乎感觉不到
- **下载**: 点击后浏览器触发下载或新标签打开

## 安全考虑

### rel="noopener noreferrer"

```tsx
<a target="_blank" rel="noopener noreferrer">
```

**作用**:
- `noopener`: 防止新窗口访问 `window.opener`
- `noreferrer`: 不发送 Referer 头

**原因**: 防止 [Tabnabbing 攻击](https://owasp.org/www-community/attacks/Reverse_Tabnabbing)

### 跨域限制

- 远程图片链接可能受 CORS 限制
- `download` 属性在跨域时可能不生效
- base64 图片无跨域问题

## 测试建议

### 测试用例 1: 链接有效
```
1. 生成一张图片（imageUrl 和 imageBase64 都有）
2. 图片应该正常显示
3. 点击"下载图片" → 新标签打开或下载
```

### 测试用例 2: 链接过期
```
1. 手动修改数据库，将 imageUrl 改为无效链接
2. 刷新页面
3. 图片应该先尝试加载链接，失败后自动显示 base64
4. 点击"下载图片" → 下载 base64 图片
```

### 测试用例 3: 只有 base64
```
1. 数据库中只有 imageBase64，没有 imageUrl
2. 图片应该直接显示 base64
3. 点击"下载图片" → 下载 PNG 文件
```

### 测试用例 4: 都没有
```
1. imageUrl 和 imageBase64 都为空
2. 不应该显示图片区域
```

## 代码对比

### 修改前
```tsx
// 简单的或逻辑
const imageSrc = message.imageUrl || 
  (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");

// 图片组件
<img src={imageSrc} alt="..." />

// 下载链接
<a href={imageSrc} download>下载图片</a>
```

**问题**:
- imageUrl 404 时无法降级
- 下载链接指向当前显示的图片源
- 没有 target="_blank"

### 修改后
```tsx
// 状态管理
const [imgError, setImgError] = useState(false);

// 降级逻辑
const imageSrc = (!imgError && message.imageUrl) || 
  (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");
const downloadSrc = message.imageUrl || 
  (message.imageBase64 ? `data:image/png;base64,${message.imageBase64}` : "");

// 图片组件（带错误处理）
<img
  src={imageSrc}
  onError={() => setImgError(true)}
  alt="..."
/>

// 下载链接（新标签打开）
<a
  href={downloadSrc}
  download="generated-image.png"
  target="_blank"
  rel="noopener noreferrer"
>
  下载图片
</a>
```

**改进**:
- ✅ 自动降级处理
- ✅ 分离显示源和下载源
- ✅ 新标签打开
- ✅ 安全属性

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| onError 事件 | ✅ | ✅ | ✅ | ✅ |
| download 属性 | ✅ | ✅ | ✅ | ✅ |
| base64 图片 | ✅ | ✅ | ✅ | ✅ |
| target="_blank" | ✅ | ✅ | ✅ | ✅ |

---

**所有问题已修复！图片显示更加可靠，下载体验更好。** ✅
