# OAuth Popup Window 使用说明

这个功能允许你像 Chrome 扩展那样，在右上角打开一个小窗口来进行 OAuth 授权。

## 功能特性

- ✅ 自动调整窗口大小（480x600）
- ✅ 自动定位到屏幕右上角
- ✅ 授权成功后自动关闭窗口并重定向父窗口
- ✅ 支持取消按钮关闭窗口
- ✅ 类似 Chrome 扩展的弹窗体验

## 使用方法

### 方法 1: 使用工具函数（推荐）

```typescript
import { openOAuthWindow } from '../utils/openOAuthWindow'

// 在按钮点击事件中调用
function handleAuthorize() {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  const popup = openOAuthWindow(serviceId)
  
  if (!popup) {
    alert('弹窗被阻止，请允许此网站的弹窗')
  }
}
```

### 方法 2: 使用带回调的函数

```typescript
import { openOAuthWindowWithCallback } from '../utils/openOAuthWindow'

function handleAuthorize() {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  
  openOAuthWindowWithCallback(serviceId, () => {
    console.log('授权窗口已关闭')
    // 在这里处理窗口关闭后的逻辑，比如刷新数据
  })
}
```

### 方法 3: 直接使用 window.open()

```typescript
function openOAuthPopup(serviceId: string) {
  const width = 480
  const height = 600
  const screenWidth = window.screen.availWidth
  const left = screenWidth - width - 20
  const top = 20
  
  const url = `/bowheadwhale/doauth_page_new_window?service=${encodeURIComponent(serviceId)}`
  
  window.open(
    url,
    'oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )
}
```

## 注意事项

1. **弹窗阻止**: 现代浏览器可能会阻止弹窗，除非是在用户直接操作（如点击按钮）时触发。确保 `openOAuthWindow` 是在用户事件处理函数中调用的。

2. **浏览器限制**: 某些浏览器可能会限制 `window.resizeTo()` 和 `window.moveTo()` 的使用。如果这些方法被阻止，窗口仍会打开，但可能不会自动调整大小和位置。

3. **HTTPS 要求**: 在生产环境中，弹窗功能需要 HTTPS 连接才能正常工作。

4. **跨域限制**: 如果父窗口和弹窗不在同一个域，可能会有一些限制。

## 路由配置

确保在 `App.tsx` 中已经配置了路由：

```typescript
<Route path="/bowheadwhale/doauth_page_new_window" element={<DOAuthPageNewWindow />} />
```

## 工作流程

1. 用户点击授权按钮
2. 调用 `openOAuthWindow(serviceId)` 打开弹窗
3. 弹窗自动调整大小和位置到右上角
4. 用户在弹窗中完成授权
5. 授权成功后，弹窗自动关闭，父窗口重定向到回调 URL

## 示例代码

查看 `openOAuthWindow.example.ts` 文件获取更多使用示例。

