# Cache API 使用示例

## API 端点

### 1. 设置缓存值
**`POST /api/cache`**

**请求体：**
```json
{
  "key": "user:123",
  "value": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "ttl": 3600
}
```

**响应：**
```json
{
  "success": true,
  "message": "Cache value set successfully",
  "data": {
    "key": "user:123",
    "ttl": 3600
  }
}
```

**cURL 示例：**
```bash
curl -X POST http://localhost:3000/api/cache \
  -H "Content-Type: application/json" \
  -d '{
    "key": "user:123",
    "value": {"name": "John Doe"},
    "ttl": 3600
  }'
```

### 2. 获取缓存值
**`GET /api/cache/:key`**

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "key": "user:123",
    "value": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**响应（未找到）：**
```json
{
  "success": false,
  "error": "Cache key not found"
}
```

**cURL 示例：**
```bash
curl http://localhost:3000/api/cache/user:123
```

### 3. 删除缓存值
**`DELETE /api/cache/:key`**

**响应：**
```json
{
  "success": true,
  "message": "Cache entry deleted",
  "deleted": true
}
```

**cURL 示例：**
```bash
curl -X DELETE http://localhost:3000/api/cache/user:123
```

### 4. 获取缓存统计
**`GET /api/cache/stats`**

**响应：**
```json
{
  "success": true,
  "data": {
    "size": 10,
    "expired": 2,
    "active": 8
  }
}
```

**cURL 示例：**
```bash
curl http://localhost:3000/api/cache/stats
```

### 5. 清空所有缓存
**`DELETE /api/cache`**

**响应：**
```json
{
  "success": true,
  "message": "All cache entries cleared"
}
```

**cURL 示例：**
```bash
curl -X DELETE http://localhost:3000/api/cache
```

## JavaScript/TypeScript 使用示例

### 设置缓存
```typescript
const response = await fetch('http://localhost:3000/api/cache', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    key: 'user:123',
    value: { name: 'John Doe', email: 'john@example.com' },
    ttl: 3600, // 1 hour
  }),
});

const result = await response.json();
console.log(result);
```

### 获取缓存
```typescript
const response = await fetch('http://localhost:3000/api/cache/user:123');
const result = await response.json();

if (result.success) {
  console.log('Cached value:', result.data.value);
} else {
  console.log('Cache miss');
}
```

### 删除缓存
```typescript
const response = await fetch('http://localhost:3000/api/cache/user:123', {
  method: 'DELETE',
});

const result = await response.json();
console.log(result);
```

## 使用场景

### 场景 1: 缓存用户数据
```javascript
// 设置用户数据缓存（1小时）
await fetch('/api/cache', {
  method: 'POST',
  body: JSON.stringify({
    key: `user:${userId}`,
    value: userData,
    ttl: 3600,
  }),
});

// 获取用户数据
const cached = await fetch(`/api/cache/user:${userId}`);
```

### 场景 2: 缓存服务信息
```javascript
// 缓存服务信息（5分钟）
await fetch('/api/cache', {
  method: 'POST',
  body: JSON.stringify({
    key: `service:${serviceId}`,
    value: serviceInfo,
    ttl: 300,
  }),
});
```

### 场景 3: 临时数据存储
```javascript
// 存储临时数据（无过期时间）
await fetch('/api/cache', {
  method: 'POST',
  body: JSON.stringify({
    key: 'temp:session:123',
    value: sessionData,
    // 不设置 ttl，永久存储（直到服务器重启）
  }),
});
```

## 注意事项

1. **TTL 单位**：TTL 以秒为单位
2. **键名规范**：建议使用 `{type}:{id}` 格式，如 `user:123`、`service:0x...`
3. **值类型**：可以存储任何 JSON 可序列化的数据
4. **内存限制**：缓存存储在内存中，服务器重启后会丢失
5. **自动清理**：过期条目会自动清理，也可以手动调用清理

