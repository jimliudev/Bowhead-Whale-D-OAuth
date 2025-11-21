# 故障排除指南

## 常见问题

### 1. 模块导入错误

**错误信息：**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module './cache'
```

**解决方案：**
- 确保导入路径包含 `.js` 扩展名
- 例如：`import { cache } from './cache.js';`

### 2. 端口被占用

**错误信息：**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案：**

**方法 1: 停止占用端口的进程**
```bash
# 查找占用端口的进程
lsof -ti:3000

# 停止进程（替换 PID 为实际进程 ID）
kill -9 <PID>

# 或者直接停止
kill -9 $(lsof -ti:3000)
```

**方法 2: 使用不同的端口**
```bash
# 设置环境变量
PORT=3001 node src/index.js

# 或在 .env 文件中设置
PORT=3001
```

**方法 3: 修改代码中的默认端口**
编辑 `server/src/index.js`，修改：
```javascript
const PORT = process.env.PORT || 3001; // 改为其他端口
```

### 3. 依赖未安装

**错误信息：**
```
Cannot find module '@mysten/sui/client'
```

**解决方案：**
```bash
cd server
npm install
```

### 4. 环境变量未设置

**错误信息：**
```
WALRUS_PRIVATE_KEY is not defined
```

**解决方案：**
- 创建 `.env` 文件（从 `env.example` 复制）
- 设置必要的环境变量

### 5. ES 模块语法错误

**确保：**
- `package.json` 中包含 `"type": "module"`
- 导入语句使用 `.js` 扩展名
- 使用 `import/export` 而不是 `require/module.exports`

## 快速检查清单

- [ ] 已安装所有依赖：`npm install`
- [ ] 端口 3000 未被占用
- [ ] `.env` 文件已创建并配置
- [ ] 导入路径包含 `.js` 扩展名
- [ ] `package.json` 中设置了 `"type": "module"`

## 测试服务器

```bash
# 检查服务器是否运行
curl http://localhost:3000/api/health

# 应该返回：
# {"status":"ok","message":"Bowhead Whale API is running",...}
```

