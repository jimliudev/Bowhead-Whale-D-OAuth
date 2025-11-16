# Walrus + Seal React 範例

這是一個展示如何使用 Walrus 去中心化存儲和 Seal 加密服務的 React.js 前端應用範例。

## 功能特點

- 🔐 使用 Seal 進行客戶端加密
- 📦 將加密數據存儲到 Walrus 去中心化存儲
- 🔓 從 Walrus 下載並使用 Seal 解密數據
- 💼 集成 Sui 錢包連接

## 技術棧

- **React 18** - UI 框架
- **TypeScript** - 類型安全
- **Vite** - 構建工具
- **@mysten/wallet-kit** - Sui 錢包集成
- **Walrus SDK** - Walrus 存儲服務
- **Seal SDK** - Seal 加密服務

## 安裝

```bash
# 安裝依賴
npm install
```

## 配置

在 `src/App.tsx` 中配置以下參數：

```typescript
const WALRUS_CONFIG = {
  aggregatorUrl: 'https://your-walrus-aggregator-url.com',
  publisherUrl: 'https://your-walrus-publisher-url.com', // 可選
}

const SEAL_CONFIG = {
  keyServerUrl: 'https://your-seal-key-server-url.com',
  accessPolicyPackageId: '0x...', // 可選：Sui Move package ID
}
```

### 獲取 Walrus Aggregator URL

可以從以下來源獲取測試網 aggregator URL：

- [Nami Cloud Mainnet Publisher](https://github.com/MystenLabs/awesome-walrus#mainnet-publisher)
- [Staketab Mainnet Publisher](https://walrus-mainnet-publisher-1.staketab.org:443)

### 獲取 Seal Key Server URL

請參考 [Seal 文檔](https://seal-docs.wal.app/) 獲取 Seal Key Server 的 URL。

## 運行

```bash
# 開發模式
npm run dev

# 構建生產版本
npm run build

# 預覽生產構建
npm run preview
```

## 使用流程

1. **連接錢包**：點擊「連接 Sui 錢包」按鈕，選擇並連接您的 Sui 錢包

2. **加密並上傳**：
   - 在文本框中輸入要加密的數據
   - 點擊「加密並上傳到 Walrus」按鈕
   - 系統會使用 Seal 加密數據，然後上傳到 Walrus
   - 獲得一個 Blob Reference ID

3. **下載並解密**：
   - 使用獲得的 Blob Reference ID
   - 點擊「從 Walrus 下載並解密」按鈕
   - 系統會從 Walrus 下載加密數據，然後使用 Seal 解密

## 項目結構

```
.
├── src/
│   ├── App.tsx              # 主應用組件
│   ├── App.css              # 樣式文件
│   ├── main.tsx             # 應用入口
│   ├── index.css            # 全局樣式
│   └── services/
│       ├── walrusService.ts # Walrus 服務封裝
│       └── sealService.ts   # Seal 服務封裝
├── index.html               # HTML 模板
├── package.json             # 項目配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md                # 本文件
```

## 重要說明

⚠️ **這是示例代碼**，當前使用模擬實現。實際使用時需要：

### 1. 集成實際的 SDK

當前代碼使用模擬實現。要使用實際的 SDK，需要：

#### Seal SDK 集成

根據 [Seal SDK 文檔](https://github.com/MystenLabs/awesome-walrus#sdks)，更新 `src/services/sealService.ts`：

```typescript
import { SealClient } from '@seal-io/sdk'; // 或實際的 Seal SDK 包名

// 在 SealService 類中使用實際的 SDK
const client = new SealClient({ 
  keyServerUrl: this.keyServerUrl 
});

// 使用實際的加密方法
const encrypted = await client.encrypt(data, publicKeys);
```

#### Walrus SDK 集成

根據 [Walrus SDK 文檔](https://github.com/MystenLabs/awesome-walrus#sdks)，更新 `src/services/walrusService.ts`：

```typescript
import { WalrusClient } from '@walrus-sdk/core'; // 或實際的 Walrus SDK 包名

// 使用實際的 Walrus SDK 方法
const client = new WalrusClient({ aggregatorUrl: this.aggregatorUrl });
const reference = await client.upload(data);
```

### 2. 實現 Sui Move 訪問策略

- 創建一個 Sui Move 包來定義訪問控制策略
- 參考 [Seal 文檔 - Access Policy Example Patterns](https://seal-docs.wal.app/developer-guide/access-policy-example-patterns/)
- 部署 Move 包並獲取 Package ID
- 在配置中設置 `accessPolicyPackageId`

### 3. 配置正確的服務端點

- 替換示例中的 URL 為實際的 Walrus Aggregator 和 Seal Key Server URL
- 可以使用 `src/config.example.ts` 作為配置模板
- 或使用環境變量（參考 `src/config.example.ts` 中的 `getConfigFromEnv` 函數）

### 4. 處理錯誤和邊界情況

- 網絡錯誤處理
- 錢包連接狀態管理
- 加密/解密失敗處理
- 訪問控制驗證失敗處理

## 參考資源

- [Awesome Walrus](https://github.com/MystenLabs/awesome-walrus) - Walrus 工具和資源列表
- [Seal 文檔](https://seal-docs.wal.app/) - Seal 官方文檔
- [Sui 開發者文檔](https://docs.sui.io/) - Sui 區塊鏈開發文檔

## 許可證

MIT

blob ref
文字
ktvJXSG2aV3-wNFeTb16c-A0AYUec7P1SCbvOxl7lGs

1044
fszGJwF0ay6upGdSJCHBtmyR0d9BxmvBQLvcfOHCQt0

圖片 肥毛衝刺
tfB1DU7BTqijwW7smxUiZuH2wAVt04efChNlYF9lAZk