# 环境变量设置指南

## VITE_API_BASE_URL 配置

`VITE_API_BASE_URL` 用于指定后端 API 的基础 URL。

### 设置方法

#### 方法 1: 创建 `.env.local` 文件（推荐）

在项目根目录创建 `.env.local` 文件：

```bash
# 开发环境（前后端分离）
VITE_API_BASE_URL=http://localhost:3000

# 或者生产环境
VITE_API_BASE_URL=https://api.yourdomain.com
```

#### 方法 2: 创建 `.env` 文件

```bash
VITE_API_BASE_URL=http://localhost:3000
```

#### 方法 3: 使用环境变量（命令行）

```bash
# Linux/Mac
VITE_API_BASE_URL=http://localhost:3000 npm run dev

# Windows (PowerShell)
$env:VITE_API_BASE_URL="http://localhost:3000"; npm run dev
```

### 不同场景的配置

#### 场景 1: 开发环境（前后端分离）
```env
VITE_API_BASE_URL=http://localhost:3000
```
- 前端运行在 `http://localhost:5173` (Vite 默认)
- 后端运行在 `http://localhost:3000`
- API 调用会发送到 `http://localhost:3000/api/...`

#### 场景 2: 生产环境（前后端同域）
```env
VITE_API_BASE_URL=
```
- 留空或设置为空字符串
- 使用相对路径 `/api/...`
- 适用于前后端部署在同一域名下

#### 场景 3: 生产环境（前后端分离）
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```
- 前端部署在 `https://yourdomain.com`
- 后端部署在 `https://api.yourdomain.com`
- API 调用会发送到 `https://api.yourdomain.com/api/...`

### 文件优先级

Vite 会按以下顺序加载环境变量文件（后面的会覆盖前面的）：

1. `.env` - 所有环境
2. `.env.local` - 所有环境（会被 git 忽略）
3. `.env.[mode]` - 特定模式（如 `.env.development`）
4. `.env.[mode].local` - 特定模式（会被 git 忽略）

### 注意事项

1. **必须以 `VITE_` 开头**：只有以 `VITE_` 开头的变量才会暴露给前端代码
2. **重启开发服务器**：修改 `.env` 文件后需要重启 Vite 开发服务器
3. **构建时注入**：环境变量会在构建时注入，运行时无法修改
4. **安全性**：不要在前端环境变量中存储敏感信息（如私钥）

### 验证配置

在代码中检查环境变量是否正确加载：

```typescript
console.log('API Base URL:', (import.meta as any).env?.VITE_API_BASE_URL)
```

### Docker 环境

在 Docker 中，可以通过环境变量或 `.env` 文件设置：

```bash
# docker-compose.yml
environment:
  - VITE_API_BASE_URL=http://localhost:3000
```

或在 Dockerfile 中：
```dockerfile
ENV VITE_API_BASE_URL=http://localhost:3000
```

### 示例文件

项目根目录有 `.env.example` 文件，可以复制并重命名：

```bash
cp .env.example .env.local
# 然后编辑 .env.local 文件
```

