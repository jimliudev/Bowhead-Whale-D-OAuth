# 通过 HTTP 请求触发 OAuth 弹窗

## 概述

通过 HTTP GET 请求访问触发端点，自动打开 OAuth 授权弹窗。这种方式允许第三方服务通过简单的 HTTP 重定向来触发授权流程。

## 使用方法

### 方法 1: 直接 HTTP GET 请求

第三方服务可以通过重定向用户到以下 URL 来触发弹窗：

```
GET /bowheadwhale/oauth_trigger?service=SERVICE_ID
```

**完整 URL 示例：**
```
http://localhost:5173/bowheadwhale/oauth_trigger?service=0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21
```

### 方法 2: 带额外参数

```
GET /bowheadwhale/oauth_trigger?service=SERVICE_ID&auto_close=true&redirect=REDIRECT_URL
```

**参数说明：**
- `service` (必需): OAuth 服务 ID
- `auto_close` (可选): 设置为 `true` 时，授权完成后自动关闭触发页面
- `redirect` (可选): 授权完成后的重定向 URL

**完整示例：**
```
http://localhost:5173/bowheadwhale/oauth_trigger?service=0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21&auto_close=true&redirect=https://example.com/callback
```

## 工作流程

1. **第三方服务重定向用户**
   ```
   用户点击"授权"按钮
   ↓
   第三方服务重定向到: /bowheadwhale/oauth_trigger?service=SERVICE_ID
   ```

2. **触发页面自动打开弹窗**
   ```
   OAuthTriggerPage 加载
   ↓
   自动调用 openOAuthWindow(serviceId)
   ↓
   弹窗在右上角打开（480x600）
   ```

3. **用户在弹窗中完成授权**
   ```
   用户连接钱包
   ↓
   选择要授权的资源
   ↓
   点击"授权"按钮
   ```

4. **授权完成后的处理**
   ```
   弹窗发送 postMessage 给父窗口
   ↓
   父窗口接收消息并处理
   ↓
   弹窗自动关闭
   ↓
   重定向到第三方服务的回调 URL
   ```

## 代码示例

### 第三方服务端（Node.js/Express）

```javascript
// Express 路由示例
app.get('/authorize', (req, res) => {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  const oauthTriggerUrl = `http://localhost:5173/bowheadwhale/oauth_trigger?service=${serviceId}&auto_close=true&redirect=${encodeURIComponent('https://example.com/callback')}`
  
  // 重定向到触发页面
  res.redirect(oauthTriggerUrl)
})
```

### 第三方服务端（PHP）

```php
<?php
$serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21';
$redirectUrl = urlencode('https://example.com/callback');
$oauthTriggerUrl = "http://localhost:5173/bowheadwhale/oauth_trigger?service={$serviceId}&auto_close=true&redirect={$redirectUrl}";

header("Location: {$oauthTriggerUrl}");
exit;
?>
```

### 第三方服务端（Python/Flask）

```python
from flask import redirect

@app.route('/authorize')
def authorize():
    service_id = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
    redirect_url = 'https://example.com/callback'
    oauth_trigger_url = f'http://localhost:5173/bowheadwhale/oauth_trigger?service={service_id}&auto_close=true&redirect={redirect_url}'
    
    return redirect(oauth_trigger_url)
```

### 前端 JavaScript（直接链接）

```html
<a href="http://localhost:5173/bowheadwhale/oauth_trigger?service=0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21">
  授权访问
</a>
```

### 前端 JavaScript（AJAX 请求）

```javascript
// 注意：由于浏览器安全限制，AJAX 请求无法直接打开弹窗
// 但可以通过 window.open 或重定向来实现

function triggerOAuth() {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  const url = `http://localhost:5173/bowheadwhale/oauth_trigger?service=${serviceId}`
  
  // 方法 1: 直接打开（推荐）
  window.open(url, 'oauth_trigger', 'width=500,height=400')
  
  // 方法 2: 重定向当前页面
  // window.location.href = url
}
```

## 消息通信

弹窗和父窗口之间通过 `postMessage` API 进行通信：

### 授权成功消息

```javascript
{
  type: 'OAUTH_SUCCESS',
  accessToken: '...',
  grantId: '...',
  redirectUrl: 'https://example.com/callback?access_token=...',
  serviceId: '0x...'
}
```

### 授权取消消息

```javascript
{
  type: 'OAUTH_CANCELLED'
}
```

## 安全注意事项

1. **Origin 验证**: 所有 postMessage 都验证了 origin，确保消息来自正确的源
2. **HTTPS**: 在生产环境中必须使用 HTTPS
3. **服务 ID 验证**: 确保服务 ID 来自可信来源
4. **重定向 URL 验证**: 验证重定向 URL 是否在白名单中

## 测试

### 测试 URL

```
http://localhost:5173/bowheadwhale/oauth_trigger?service=0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21
```

### 测试步骤

1. 在浏览器中访问上述 URL
2. 应该看到"Opening Authorization Window..."页面
3. 弹窗应该自动在右上角打开
4. 在弹窗中完成授权流程
5. 弹窗关闭后，触发页面应该自动关闭或重定向

## 故障排除

### 弹窗没有打开

1. 检查浏览器是否阻止了弹窗
2. 查看浏览器控制台的错误信息
3. 确认 `openOAuthWindow` 函数正常工作

### 消息没有传递

1. 确认两个窗口在同一 origin
2. 检查 postMessage 的 origin 验证
3. 查看浏览器控制台的错误信息

### 重定向失败

1. 确认重定向 URL 格式正确
2. 检查是否有 CORS 限制
3. 验证重定向 URL 是否在白名单中

