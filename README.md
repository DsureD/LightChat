# Light Chat

轻量化 OpenAI-compatible Web Chat，支持管理员配置服务商、加密保存 API Key、一键查询导入模型、聊天模型流式输出、图片模型自动展示 URL/base64 图片。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS + 轻量 UI 组件
- SQLite + Prisma
- 自定义签名 Session Cookie
- AES-256-GCM 加密保存 API Key
- SSE 流式聊天输出

## 快速启动

1. 安装依赖：

```bash
npm install
```

2. 创建环境变量：

```bash
cp .env.example .env
```

将 `.env` 中的 `APP_SECRET` 改成至少 32 位随机字符串。

3. 初始化数据库：

```bash
npm run prisma:generate
npm run prisma:push
```

4. 启动开发服务：

```bash
npm run dev
```

5. 浏览器访问 `http://localhost:3000`，首次进入会跳转到 `/setup` 创建管理员账号。

## 端口设置

Next.js 默认端口是 `3000`，可以通过启动参数或环境变量修改。

开发环境指定端口：

```bash
npm run dev -- -p 3001
```

生产环境指定端口：

```bash
npm run build
npm run start -- -p 3001
```

PowerShell 也可以临时设置 `PORT`：

```powershell
$env:PORT=3001; npm run dev
```

## 内存占用优化

如果使用 `npm run dev`，看到 Node.js 占用约 300MB–600MB 通常是正常的。开发模式会常驻编译器、HMR、源码映射和路由缓存，内存明显高于生产模式。

推荐生产运行方式：

```bash
npm run build
npm run start -- -p 3000
```

如果服务器内存较小，可以使用低内存脚本限制 Node.js V8 heap：

```bash
npm run build:lowmem
npm run start:lowmem -- -p 3000
```

开发环境也可以使用：

```bash
npm run dev:lowmem -- -p 3000
```

说明：

- `dev:lowmem` 限制 V8 heap 为 `512MB`，适合日常开发，但复杂页面首次编译可能更慢。
- `build:lowmem` 限制 V8 heap 为 `1024MB`，如果构建失败，可改用普通 `npm run build`。
- `start:lowmem` 限制 V8 heap 为 `384MB`，更适合小内存服务器生产运行。
- 本项目已移除外部图标库，改用本地 SVG 图标，减少依赖和开发编译负担。
- 如果需要继续极限优化，可以考虑把 Prisma 替换为更轻的 SQLite 查询层，但会牺牲 ORM 开发体验。

## iOS 浏览器排查

如果 iPhone/iPad 打开出现 `Application error: a client-side exception has occurred`，优先确认以下事项：

- 建议使用 iOS 15+ 的 Safari/Chrome/Edge；较老的 iOS WebView 对部分现代 Web API 兼容性较差。
- 如果手机端提示“暂无可用模型”，但电脑端正常，通常是手机端登录态没有保存或访问了不同域名。
- 请确保手机和电脑访问的是完全相同的协议与域名，例如都使用 `https://site1.example.com`。
- 生产环境推荐使用 HTTPS；如果你临时用 HTTP 访问生产服务，需要在 `.env` 设置 `COOKIE_SECURE="false"` 后重启服务。
- 如果使用 HTTPS，建议保持 `COOKIE_SECURE` 为空或设置为 `true`。
- 修改 Cookie 或域名配置后，建议清理 iOS Safari 对该站点的网站数据后重新登录。

### Loading chunk failed

如果出现 `Loading chunk xxx failed` 或 `_next/static/chunks/...js missing`，通常不是业务代码错误，而是浏览器缓存了旧 HTML，旧 HTML 引用的 JS chunk 在新部署后已经不存在。

处理方式：

- 部署后重启 Node 服务，并确认反向代理没有缓存 `/chat`、`/login` 等 HTML 页面。
- 如果使用 CDN，请清理站点缓存，至少清理 `/chat`、`/login`、`/_next/static/*`。
- Nginx/CDN 可以长期缓存 `/_next/static/*`，但不要缓存页面 HTML。
- 用户侧清理 Safari 网站数据，或给 URL 加查询参数强制请求新页面，例如 `/chat?t=1`。

### 反向代理跳转到 localhost

如果表单提交后跳转到 `localhost`，通常是反向代理没有把原始域名传给 Node 服务，建议正确配置 Nginx：

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 跨域设置

默认同源使用，不需要额外配置跨域。如果需要让其他前端域名调用本项目的 `/api/*`，在 `.env` 中设置 `CORS_ORIGINS`：

```env
CORS_ORIGINS="http://localhost:5173,https://chat.example.com"
```

说明：

- `CORS_ORIGINS` 为空时，不额外开放跨域。
- 多个来源用英文逗号分隔，必须包含协议、域名和端口。
- 如果跨域请求需要携带登录 Cookie，前端 `fetch` 要加 `credentials: "include"`。
- 可以设置 `CORS_ORIGINS="*"` 开放任意来源，但浏览器不会允许通配符模式携带 Cookie。
- 跨域中间件只匹配 `/api/:path*`，不会影响页面路由。

## 使用说明

- 进入 `/admin` 添加服务商：填写名称、`baseURL`、`APIKey`。
- `baseURL` 支持 `https://api.example.com` 或 `https://api.example.com/v1`。
- 点击“查询导入”会请求服务商的 `/v1/models` 并自动导入模型。
- 如果服务商不支持 `/v1/models`，可在后台手动添加模型。
- 模型类型：`chat` 用于聊天，`image` 用于图片生成，`vision` 预留多模态能力标记。

## 图片模型

图片模型会调用 OpenAI-compatible 的 `/v1/images/generations`，兼容返回：

- `data[0].url`
- `data[0].b64_json`

前端会自动渲染图片，并提供下载入口。

## 安全说明

- API Key 只保存在服务端数据库，不会返回给前端。
- API Key 使用 `APP_SECRET` 派生密钥进行 AES-256-GCM 加密。
- Session Cookie 使用 HMAC-SHA256 签名，并设置 `httpOnly`。
- 请勿在生产环境更换 `APP_SECRET`，否则已保存 API Key 和登录状态将无法解密/验证。
