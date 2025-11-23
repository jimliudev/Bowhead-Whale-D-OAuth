# 解密问题调试指南

## 问题诊断

你之前的解密代码失败，原因是参数使用错误：

### ❌ 错误的代码

```typescript
const { data: encryptedBlob } = await walrusApiService.readFromWalrus(
  '0x3ab70185b67d88f9f83438105fd6e2b23e7110122d22aa359ff5c9a17f4c155a'
)

const decryptedBytes = await sealService.decrypt(
  encryptedBlob,
  newSessionKey,
  sealService.getEncryptionSealId(),
  '0xf931bf9c1af57ade91605fda615bef74c00b69507451cc2b49c29549b860ae6e', // vaultId
  '0x3ab70185b67d88f9f83438105fd6e2b23e7110122d22aa359ff5c9a17f4c155a', // ❌ 错误：这是 blobId!
  currentAccount.address
)
```

### 🔍 问题分析

1. **混淆了 Blob ID 和 Data Object ID**
   - `blobId`: Walrus 存储的加密数据的 ID（用于下载数据）
   - `itemId` (Data Object ID): Sui 链上 Data 对象的 ID（用于权限验证）
   
2. **缺少数据验证步骤**
   - 没有先从链上获取 Data item 信息
   - 直接使用硬编码的 ID

## ✅ 正确的解密流程

### 数据关系图

```
链上 Data 对象
├── Object ID: 0xabc... (itemId - 用于解密权限验证)
├── name: "My Secret"
├── vaultId: 0xdef... (所属 Vault)
└── value: 0x3ab7... (Blob ID - Walrus 存储地址)
           │
           └──> Walrus 存储
                └── Encrypted Data (加密的实际内容)
```

### 正确的代码

```typescript
// Step 1: 从链上获取 Data item 信息
const itemInfo = await contractService.getDataInfo(suiClient, dataObjectId)
// 返回: { id, vaultId, name, value (blobId), ... }

// Step 2: 使用 blobId 从 Walrus 下载加密数据
const { data: encryptedBlob } = await walrusApiService.readFromWalrus(itemInfo.value)

// Step 3: 使用正确的参数解密
const decryptedBytes = await sealService.decrypt(
  encryptedBlob,
  sessionKey,
  sealService.getEncryptionSealId(),
  itemInfo.vaultId,  // ✅ 从 itemInfo 获取
  itemInfo.id,       // ✅ Data Object ID（不是 blobId）
  currentAccount.address
)
```

## 🔧 如何使用修正后的代码

### 1. 打开开发者控制台

在浏览器中按 `F12` 或 `Cmd+Option+I` (Mac) 打开控制台。

### 2. 触发测试

在 DOAuth 页面点击"Generate Access Token"按钮，代码会：

1. **自动查找你的所有数据**
   ```
   📦 找到 1 个 Vault:
   📁 Vault: My Secrets
      ID: 0xdef...
      包含 2 个数据项:
      📄 Test Data
         - Data Object ID: 0xabc123...
         - Blob ID: 0x3ab701...
         - Vault ID: 0xdef...
   ```

2. **自动使用第一个数据项进行测试**
   - 如果找到数据，会自动解密并显示内容
   - 如果没有数据，会提示你先创建

### 3. 查看解密结果

- 成功：弹出 alert 显示解密后的内容
- 失败：控制台会显示详细的错误信息

## 📝 解密参数说明

### sealService.decrypt() 参数

```typescript
await sealService.decrypt(
  encryptedData,    // Uint8Array - 从 Walrus 下载的加密数据
  sessionKey,       // SessionKey - 用户的会话密钥
  sealId,          // string - 加密时使用的 Seal ID
  vaultId,         // string - Data 所属的 Vault Object ID
  itemId,          // string - Data Object ID (⚠️ 不是 blobId!)
  accessAddress    // string - 访问者的地址
)
```

### 在 Move 合约中的验证

```move
public fun seal_approve(
    seal_id: vector<u8>,
    vault: &DataVault,      // 验证 vaultId
    data: &Data,            // 验证 itemId (Data Object ID)
    accessor: address,      // 验证访问者地址
    clock: &Clock
)
```

## 🐛 常见错误

### 错误 1: "Invalid object ID"
**原因**: 使用了 blobId 作为 itemId
**解决**: 使用 Data Object ID (从 `contractService.getDataInfo()` 获取)

### 错误 2: "Object not found"
**原因**: Data Object ID 不存在或已被删除
**解决**: 检查链上是否存在该对象

### 错误 3: "Access denied"
**原因**: SessionKey 的地址与访问者地址不匹配
**解决**: 确保 SessionKey 是用当前钱包地址创建的

### 错误 4: "Decryption failed"
**原因**: sealId 不匹配或加密数据损坏
**解决**: 
- 确认 sealId 与加密时使用的相同
- 检查 Walrus 数据是否完整

## 🎯 测试步骤

### 1. 准备测试数据（如果还没有）

在 UserPage:
1. 创建一个 Vault (Category)
2. 添加一个 Data item（文本或图片）

### 2. 运行解密测试

在 DOAuthPage:
1. 连接钱包
2. 点击"Generate Access Token"
3. 查看控制台输出，确认找到你的数据
4. 等待解密完成

### 3. 验证结果

- ✅ 成功：看到解密后的数据内容
- ❌ 失败：查看控制台的详细错误信息

## 🔐 Seal 加密/解密流程总览

### 加密流程 (UserPage)

```
原始数据
  ↓
JSON.stringify + TextEncoder
  ↓
Uint8Array
  ↓
sealService.encrypt(sealId, data)
  ↓
加密的 Uint8Array
  ↓
上传到 Walrus
  ↓
获得 blobId
  ↓
在链上创建 Data 对象 (包含 blobId)
```

### 解密流程 (DOAuthPage/UserPage)

```
从链上读取 Data 对象 (包含 blobId, vaultId 等)
  ↓
使用 blobId 从 Walrus 下载加密数据
  ↓
创建 SessionKey
  ↓
构建 seal_approve 交易 (使用 vaultId, itemId)
  ↓
sealService.decrypt(encryptedData, sessionKey, sealId, vaultId, itemId, address)
  ↓
解密的 Uint8Array
  ↓
TextDecoder + JSON.parse
  ↓
原始数据
```

## 📚 相关文件

- **加密实现**: `src/services/sealService.ts` (encrypt, decrypt 方法)
- **合约服务**: `src/services/contractService.ts` (getDataInfo 方法)
- **Walrus API**: `src/services/walrusApiService.ts` (uploadToWalrus, readFromWalrus)
- **Move 合约**: `move/bowhead/sources/seal_private_data.move` (seal_approve 函数)
- **加密示例**: `src/pages/UserPage.tsx` (handleAddItem 函数)
- **解密示例**: `src/pages/UserPage.tsx` (handleViewItem 函数)
- **测试代码**: `src/pages/DOAuthPage.tsx` (handleGenerateAccessToken 函数)

## 💡 提示

1. **永远先从链上获取 Data 信息**，不要硬编码 ID
2. **区分 blobId 和 itemId**：前者用于下载数据，后者用于权限验证
3. **使用相同的 sealId**：解密时必须使用加密时的 sealId
4. **检查控制台日志**：详细的日志会帮助你定位问题

## 🚀 下一步

1. 测试修正后的代码
2. 如果成功，可以继续实现 OAuth 授权流程
3. 如果失败，查看控制台的详细错误信息并根据本文档排查

---

**最后更新**: 2025-11-23
**相关问题**: 解密失败 - 参数使用错误
**状态**: ✅ 已修复

