# Light Chat

轻量化 OpenAI-compatible Web Chat，支持管理员配置服务商、加密保存 API Key、一键查询导入模型、聊天模型流式输出、图片模型自动展示。

## 技术栈

- **框架**: Next.js 15 App Router + TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite + Prisma ORM
- **认证**: 自定义签名 Session Cookie (HMAC-SHA256)
- **加密**: AES-256-GCM 加密保存 API Key
- **流式输出**: Server-Sent Events (SSE)

## 功能特性

### 用户功能
- ✅ 流式聊天输出，支持中断生成
- ✅ 图片生成模型支持（自动展示 URL/base64 图片）
- ✅ Markdown 渲染（代码高亮、表格、列表）
- ✅ 代码块一键复制
- ✅ 消息编辑与重新生成
- ✅ 会话管理（新建、删除、重命名）
- ✅ 会话日期显示
- ✅ 深色模式

### 管理员功能
- ✅ 服务商管理（添加、编辑、删除）
- ✅ 一键查询导入模型（调用 `/v1/models` 接口）
- ✅ 手动添加模型（支持不提供模型列表的服务商）
- ✅ 模型类型标记（chat、image、vision）
- ✅ API Key 加密存储

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，将 `APP_SECRET` 改为至少 32 位的随机字符串：

```env
APP_SECRET="your-random-secret-key-at-least-32-chars"
```

### 3. 初始化数据库

```bash
npm run prisma:generate
npm run prisma:push
```

### 4. 启动服务

**开发模式**:
```bash
npm run dev
```

**生产模式**:
```bash
npm run build
npm run start
```

### 5. 访问应用

浏览器访问 `http://localhost:3000`，首次访问会跳转到 `/setup` 创建管理员账号。

## 配置说明

### 端口设置

默认端口 `3000`，可通过以下方式修改：

**方式 1: 命令行参数**
```bash
npm run dev -- -p 3001
npm run start -- -p 3001
```

**方式 2: 环境变量**
```bash
PORT=3001 npm run dev
```

**Windows PowerShell**:
```powershell
$env:PORT=3001; npm run dev
```

### 低内存模式

服务器内存有限时，可使用低内存脚本限制 Node.js V8 heap：

```bash
# 开发环境 (限制 512MB)
npm run dev:lowmem

# 构建 (限制 1024MB)
npm run build:lowmem

# 生产运行 (限制 384MB)
npm run start:lowmem
```

**说明**:
- `dev:lowmem`: 适合日常开发，复杂页面首次编译可能较慢
- `build:lowmem`: 内存不足时使用，构建失败可改用 `npm run build`
- `start:lowmem`: 适合小内存服务器生产运行

### 跨域配置

默认同源使用，如需开放 API 跨域访问，在 `.env` 中设置：

```env
CORS_ORIGINS="https://example.com,https://app.example.com"
```

**说明**:
- 多个来源用英文逗号分隔，必须包含协议、域名和端口
- 跨域请求携带 Cookie 需前端设置 `credentials: "include"`
- 设置 `CORS_ORIGINS="*"` 可开放任意来源（但不支持携带 Cookie）
- 跨域中间件只作用于 `/api/*` 路由

### Cookie 安全设置

**生产环境 (HTTPS)**:
```env
COOKIE_SECURE="true"  # 或留空，默认为 true
```

**开发环境 (HTTP)**:
```env
COOKIE_SECURE="false"
```

**注意**: 生产环境强烈建议使用 HTTPS，修改 Cookie 配置后需清除浏览器站点数据。

## 使用指南

### 管理员配置

1. 访问 `/admin` 进入管理后台
2. 添加服务商：
   - **名称**: 服务商标识（如 OpenAI、Claude）
   - **Base URL**: API 地址（如 `https://api.openai.com/v1`）
   - **API Key**: 服务商的 API 密钥
3. 点击"查询导入"自动获取模型列表
4. 或手动添加模型（适用于不支持 `/v1/models` 的服务商）

### 模型类型

- **chat**: 聊天模型（如 GPT-4、Claude）
- **image**: 图片生成模型（调用 `/v1/images/generations`）
- **vision**: 多模态模型标记（预留）

### 图片模型

兼容 OpenAI 图片生成 API 响应格式：

```json
{
  "data": [
    {
      "url": "https://...",        // 优先使用
      "b64_json": "iVBORw0KGgo..."  // 降级方案
    }
  ]
}
```

**特性**:
- 自动展示图片（URL 或 base64）
- URL 失败时自动降级到 base64
- 支持一键下载

## 反向代理配置

### Nginx 示例

```nginx
server {
  listen 80;
  server_name chat.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    
    # 必需：传递原始域名和协议
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # SSE 流式输出配置
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
  }

  # 静态资源缓存
  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, immutable";
  }
}
```

**注意**: 不要缓存页面 HTML（如 `/chat`、`/login`），否则部署后可能出现 `Loading chunk failed` 错误。

## 故障排查

### Loading chunk failed

**原因**: 浏览器缓存了旧版本 HTML，引用的 JS chunk 已不存在

**解决方案**:
1. 部署后重启 Node 服务
2. 清理 CDN/反向代理缓存
3. 用户清除浏览器站点数据
4. 临时方案：URL 加查询参数 `/chat?t=1`

### 表单提交跳转到 localhost

**原因**: 反向代理未传递原始域名

**解决方案**: 确保 Nginx 配置包含：
```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

### 移动端登录状态丢失

**原因**: 手机和电脑访问了不同域名，或 Cookie 配置不正确

**解决方案**:
1. 确保访问完全相同的域名（包括协议）
2. HTTPS 站点设置 `COOKIE_SECURE="true"`
3. HTTP 站点设置 `COOKIE_SECURE="false"`
4. 清除移动端浏览器站点数据后重新登录

## 安全说明

### 数据加密
- **API Key**: 使用 AES-256-GCM 加密存储，密钥从 `APP_SECRET` 派生
- **Session**: 使用 HMAC-SHA256 签名，设置 `httpOnly` 和 `secure` 标志
- **密钥派生**: 使用 PBKDF2 (10万次迭代) 从 `APP_SECRET` 派生加密密钥

### 安全建议
- ⚠️ 生产环境务必使用强随机 `APP_SECRET`（至少 32 字符）
- ⚠️ 切勿在生产环境更换 `APP_SECRET`（会导致所有加密数据失效）
- ⚠️ 生产环境强烈建议使用 HTTPS
- ⚠️ API Key 只保存在服务端，不会发送到前端

## 项目结构

```
.
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── admin/           # 管理后台
│   │   ├── api/             # API 路由
│   │   ├── chat/            # 聊天页面
│   │   ├── login/           # 登录页面
│   │   └── setup/           # 初始化页面
│   ├── components/          # 共享组件
│   ├── lib/                 # 工具函数
│   │   ├── crypto.ts       # 加密工具
│   │   ├── session.ts      # Session 管理
│   │   └── prisma.ts       # Prisma 客户端
│   └── middleware.ts        # Next.js 中间件
├── prisma/
│   └── schema.prisma        # 数据库模型
├── public/                  # 静态资源
└── .env                     # 环境变量
```

## 数据库结构

### User (用户表)
- `id`: 主键
- `username`: 用户名（唯一）
- `passwordHash`: 密码哈希

### Provider (服务商表)
- `id`: 主键
- `name`: 服务商名称
- `baseUrl`: API 地址
- `apiKey`: 加密后的 API Key

### Model (模型表)
- `id`: 主键
- `providerId`: 服务商 ID
- `name`: 模型标识
- `displayName`: 显示名称
- `type`: 模型类型 (chat/image/vision)

### Conversation (会话表)
- `id`: 主键
- `userId`: 用户 ID
- `title`: 会话标题
- `createdAt`: 创建时间

### Message (消息表)
- `id`: 主键
- `conversationId`: 会话 ID
- `role`: 角色 (user/assistant)
- `content`: 消息内容
- `modelName`: 使用的模型
- `imageUrl`: 图片 URL（仅图片消息）
- `imageBase64`: 图片 base64（仅图片消息）

## 开发说明

### 代码规范
- 使用 TypeScript 严格模式
- 使用 ESLint + Prettier 格式化
- 组件使用 React Server Components 优先

### 提交规范
```bash
# 功能开发
git commit -m "feat: 添加消息编辑功能"

# Bug 修复
git commit -m "fix: 修复图片加载失败问题"

# 文档更新
git commit -m "docs: 更新 README"
```

## License

MIT License

---

**项目状态**: 生产可用 ✅

如有问题或建议，欢迎提交 Issue。
