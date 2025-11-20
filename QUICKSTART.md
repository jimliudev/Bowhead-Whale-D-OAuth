# Quick Start Guide

## 本地开发

### 前端开发
```bash
npm install
npm run dev
```

### 后端开发
```bash
cd server
npm install
npm run dev
```

## Docker 构建和运行

### 方法 1: 使用构建脚本
```bash
./build-docker.sh
docker run -d -p 3000:3000 --name bowhead-whale bowhead-whale:latest
```

### 方法 2: 使用 Docker Compose
```bash
docker-compose up -d
```

### 方法 3: 手动构建
```bash
# 构建镜像
docker build -t bowhead-whale:latest .

# 运行容器
docker run -d \
  --name bowhead-whale \
  -p 3000:3000 \
  -e NODE_ENV=production \
  bowhead-whale:latest
```

## 访问应用

- 前端: http://localhost:3000
- API: http://localhost:3000/api/health

## API 端点

- `GET /api/health` - 健康检查
- `GET /api/services` - 获取所有服务
- `GET /api/services/:serviceId` - 获取服务详情
- `GET /api/grants` - 获取授权列表
- `POST /api/grants` - 创建新授权

## 查看日志

```bash
# Docker 容器日志
docker logs bowhead-whale

# Docker Compose 日志
docker-compose logs -f
```

## 停止服务

```bash
# 停止 Docker 容器
docker stop bowhead-whale
docker rm bowhead-whale

# 或使用 Docker Compose
docker-compose down
```

