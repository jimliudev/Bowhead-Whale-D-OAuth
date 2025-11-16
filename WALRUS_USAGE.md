# Walrus 寫入數據使用指南

> 參考：[官方 Walrus SDK 文檔](https://sdk.mystenlabs.com/walrus#walrusblobs)

本專案支持兩種方式將數據寫入 Walrus：

## 方式 1: 使用 HTTP API（簡單，推薦用於快速原型）

通過 Aggregator/Publisher 服務上傳數據，無需直接與 Sui 鏈交互。

**注意**：使用 Aggregator/Publisher 可以避免直接與 Walrus 存儲節點交互，減少請求數量（直接使用 SDK 需要 ~2200 個請求來寫入一個 blob，~335 個請求來讀取一個 blob）。

### 配置

```typescript
const WALRUS_CONFIG = {
  aggregatorUrl: 'https://walrus-mainnet-publisher-1.staketab.org:443',
  publisherUrl: 'https://walrus-mainnet-publisher-1.staketab.org:443', // 可選
}
```

### 使用示例

```typescript
import { WalrusService } from './services/walrusService'

const walrusService = new WalrusService({
  aggregatorUrl: 'https://walrus-mainnet-publisher-1.staketab.org:443',
})

// 上傳數據
const data = new TextEncoder().encode('Hello, Walrus!')
const blobRef = await walrusService.uploadBlob(data)
console.log('Blob Reference:', blobRef)

// 下載數據
const downloaded = await walrusService.downloadBlob(blobRef)
const text = new TextDecoder().decode(downloaded)
console.log('Downloaded:', text)
```

## 方式 2: 使用 Walrus SDK（完整功能，推薦用於生產環境）

直接使用 `@mysten/walrus` SDK，需要 SuiClient 和 Signer。

### 安裝

```bash
npm install --save @mysten/walrus @mysten/sui
```

### 配置

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { walrus } from '@mysten/walrus';

const WALRUS_CONFIG = {
  // 不提供 aggregatorUrl 將自動使用 SDK 模式
  network: 'testnet', // 'mainnet' | 'testnet' | 'devnet' | 'localnet'
  
  // 可選：自定義 Sui RPC URL
  // suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
  
  // 可選：使用 Upload Relay 來減少客戶端請求（強烈推薦）
  // Upload Relay 可以大幅減少寫入時的請求數量
  uploadRelay: {
    host: 'https://upload-relay.testnet.walrus.space',
    sendTip: {
      // 方式 1: 自動計算小費（推薦）
      max: 1000, // 最大小費（MIST）
      
      // 方式 2: 固定小費
      // address: '0x...', // 接收小費的地址
      // kind: {
      //   const: 105, // 固定小費（MIST）
      // },
      
      // 方式 3: 線性小費（根據文件大小）
      // address: '0x...',
      // kind: {
      //   linear: {
      //     base: 105,        // 基礎小費
      //     perEncodedKib: 10, // 每編碼 KiB 的小費
      //   },
      // },
    },
  },
  
  // 可選：自定義網絡請求配置
  storageNodeClientOptions: {
    timeout: 60_000, // 超時時間（毫秒）
    onError: (error) => {
      // 處理個別節點的錯誤
      console.log('Storage node error:', error);
    },
  },
}
```

**重要提示**：
- 直接使用 SDK 寫入一個 blob 需要約 **2200 個請求**
- 直接使用 SDK 讀取一個 blob 需要約 **335 個請求**
- 使用 Upload Relay 可以大幅減少寫入時的請求數量
- 對於大多數應用，建議使用 Aggregator/Publisher 而不是直接使用 SDK

### 使用示例

#### 基本用法（上傳單個 Blob）

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { walrus } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';

// 創建 SuiClient 並擴展 Walrus SDK
const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet', // 必須設置 network
}).$extend(walrus());

// 創建 Signer（示例使用 Keypair，實際應用中應使用錢包 Signer）
const keypair = Ed25519Keypair.fromSecretKey(fromB64('your-base64-private-key'));

// 上傳數據
const file = new TextEncoder().encode('Hello, Walrus!');

const { blobId } = await client.walrus.writeBlob({
  blob: file,
  deletable: false, // 是否可刪除
  epochs: 3,        // 存儲 3 個紀元
  signer: keypair,  // Signer
});

console.log('Blob ID:', blobId);

// 讀取數據
const blob = await client.walrus.readBlob({ blobId });
const text = new TextDecoder().decode(blob);
console.log('Downloaded:', text);
```

**費用說明**：
- 需要足夠的 **SUI** 來支付 gas 費用（註冊和認證 blob 的交易）
- 需要足夠的 **WAL** 來支付存儲費用（存儲指定紀元數）
- 費用取決於 blob 大小和當前的 gas/存儲價格

#### 上傳多個文件（使用 WalrusFile 和 Quilt）

```typescript
import { WalrusFile } from '@mysten/walrus';

// 創建 WalrusFile 對象
const file1 = WalrusFile.from({
  contents: new TextEncoder().encode('File 1 content'),
  identifier: 'file1.txt',
  tags: {
    'content-type': 'text/plain',
  },
});

const file2 = WalrusFile.from({
  contents: new TextEncoder().encode('File 2 content'),
  identifier: 'file2.txt',
  tags: {
    'content-type': 'text/plain',
  },
});

const file3 = WalrusFile.from({
  contents: new Blob([new Uint8Array([1, 2, 3])]),
  identifier: 'file3.bin',
});

// 上傳多個文件（會自動打包到一個 Quilt 中）
const results = await client.walrus.writeFiles({
  files: [file1, file2, file3],
  epochs: 3,
  deletable: true,
  signer: keypair,
});

// results 包含每個文件的 id, blobId, 和 blobObject
console.log('Uploaded files:', results);

// 讀取文件（批量讀取更高效）
const [readFile1, readFile2, readFile3] = await client.walrus.getFiles({
  ids: [results[0].id, results[1].id, results[2].id],
});

// WalrusFile 類似 Response 對象
const text1 = await readFile1.text();
const text2 = await readFile2.text();
const bytes3 = await readFile3.bytes();
const json = await readFile3.json(); // 如果是 JSON 格式

// 獲取文件的 identifier 和 tags
const identifier = await readFile1.getIdentifier();
const tags = await readFile1.getTags();
```

**重要提示**：
- 當前版本會將所有文件打包到一個 Quilt 中
- Quilt 編碼對單個文件效率較低，建議批量上傳多個文件
- 批量讀取文件時，SDK 會更高效地從同一個 Quilt 加載

#### 在瀏覽器中使用（配合錢包）

```typescript
import { useWalletKit } from '@mysten/wallet-kit'
import { WalrusService } from './services/walrusService'

function MyComponent() {
  const { currentAccount, signAndExecuteTransaction } = useWalletKit()
  const walrusService = new WalrusService({
    network: 'testnet',
  })

  const handleUpload = async () => {
    if (!currentAccount) {
      throw new Error('請先連接錢包')
    }

    // 創建一個 WalletSigner 適配器
    // 注意：wallet-kit 不直接提供 Signer，需要創建適配器
    const walletSigner = {
      getAddress: () => Promise.resolve(currentAccount.address),
      signPersonalMessage: async (message: Uint8Array) => {
        // 使用錢包的 signPersonalMessage 方法
        // 這需要根據實際的錢包實現
        return { bytes: message, signature: '...' }
      },
      // ... 其他 Signer 方法
    }

    const data = new TextEncoder().encode('Hello from browser!')
    const blobId = await walrusService.uploadBlobWithSdk(
      data,
      walletSigner,
      3,
      true
    )

    console.log('Uploaded:', blobId)
  }

  return <button onClick={handleUpload}>上傳到 Walrus</button>
}
```

### 使用 writeFilesFlow（推薦用於瀏覽器環境）

在瀏覽器中，為了避免彈窗被阻止，可以使用 `writeFilesFlow` 將上傳過程分為多個步驟。每個步驟都需要用戶交互觸發，這樣錢包的彈窗才不會被瀏覽器阻止。

```typescript
import { WalrusFile } from '@mysten/walrus';
import { useWalletKit } from '@mysten/wallet-kit';

function BrowserUploadComponent() {
  const { currentAccount, signAndExecuteTransaction } = useWalletKit();
  const [flow, setFlow] = useState(null);
  const [blobId, setBlobId] = useState(null);

  // 步驟 1: 創建並編碼文件（可以在文件選擇時立即執行）
  const handleFileSelect = async (fileData) => {
    const walrusFile = WalrusFile.from({
      contents: new TextEncoder().encode(fileData),
      identifier: 'my-file.txt',
    });

    const newFlow = client.walrus.writeFilesFlow({
      files: [walrusFile],
    });

    await newFlow.encode();
    setFlow(newFlow);
    setBlobId(newFlow.blobId);
  };

  // 步驟 2: 註冊 Blob（需要用戶點擊按鈕）
  const handleRegister = async () => {
    if (!flow || !currentAccount) return;

    const registerTx = flow.register({
      epochs: 3,
      owner: currentAccount.address,
      deletable: true,
    });

    const { digest } = await signAndExecuteTransaction({
      transaction: registerTx,
    });

    // 步驟 3: 上傳數據到存儲節點（可以在註冊後立即執行）
    await flow.upload({ digest });
  };

  // 步驟 4: 認證 Blob（需要用戶點擊按鈕）
  const handleCertify = async () => {
    if (!flow) return;

    const certifyTx = flow.certify();
    await signAndExecuteTransaction({ transaction: certifyTx });

    // 步驟 5: 獲取創建的文件
    const files = await flow.listFiles();
    console.log('Uploaded files:', files);
  };

  return (
    <div>
      <button onClick={() => handleFileSelect('Hello, Walrus!')}>
        選擇文件
      </button>
      {flow && (
        <>
          <button onClick={handleRegister}>註冊 Blob</button>
          <button onClick={handleCertify}>認證 Blob</button>
        </>
      )}
    </div>
  );
}
```

**流程說明**：
1. `encode()` - 編碼文件並生成 blobId（不需要用戶交互）
2. `register()` - 返回註冊 blob 的交易（需要用戶簽名）
3. `upload()` - 上傳數據到存儲節點（可以在註冊後立即執行）
4. `certify()` - 返回認證 blob 的交易（需要用戶簽名）
5. `listFiles()` - 獲取創建的文件列表

## 兩種方式的比較

| 特性 | HTTP API 方式 | SDK 方式 |
|------|-------------|---------|
| 設置難度 | 簡單 | 中等 |
| 需要 Signer | 否 | 是 |
| 需要 SUI/WAL | 否 | 是（支付存儲費用） |
| 功能完整性 | 基本 | 完整 |
| 性能 | 依賴 Aggregator | 直接與節點交互 |
| 適用場景 | 快速原型、簡單應用 | 生產環境、需要完整控制 |

## 讀取 Blob 和文件

### 讀取單個 Blob

```typescript
// 讀取 blob（返回 Uint8Array）
const blob = await client.walrus.readBlob({ blobId });
```

### 讀取 WalrusFile（支持 Quilt）

```typescript
// 批量讀取文件（推薦，更高效）
const [file1, file2] = await client.walrus.getFiles({
  ids: [blobId1, blobId2],
});

// 獲取內容
const text = await file1.text();
const bytes = await file1.bytes();
const json = await file1.json();

// 獲取元數據
const identifier = await file1.getIdentifier();
const tags = await file1.getTags();
```

### 從 Quilt 讀取文件

```typescript
// 獲取 WalrusBlob
const blob = await client.walrus.getBlob({ blobId });

// 獲取所有文件
const files = await blob.files();

// 根據 identifier 獲取文件
const [readme] = await blob.files({ identifiers: ['README.md'] });

// 根據 tags 獲取文件
const textFiles = await blob.files({
  tags: [{ 'content-type': 'text/plain' }],
});

// 根據 ID 獲取文件
const filesById = await blob.files({ ids: [quiltId] });
```

## 錯誤處理

### RetryableWalrusClientError

Walrus 是一個容錯的分布式系統，某些錯誤可以通過重試恢復。在紀元變更期間，客戶端緩存的數據可能失效，這類錯誤會繼承 `RetryableWalrusClientError`。

```typescript
import { RetryableWalrusClientError } from '@mysten/walrus';

try {
  const blob = await client.walrus.readBlob({ blobId });
} catch (error) {
  if (error instanceof RetryableWalrusClientError) {
    // 重置客戶端緩存
    client.walrus.reset();
    
    // 重試操作
    const blob = await client.walrus.readBlob({ blobId });
  }
}
```

**注意**：`RetryableWalrusClientError` 在重置後重試不一定會成功，但這個模式可以處理一些邊緣情況。

高級方法如 `readBlob` 已經處理了各種錯誤情況，會自動重試，並處理只有部分節點需要成功響應的情況。

### 網絡錯誤處理

Walrus 設計為可以處理部分節點下線的情況，SDK 只有在無法從足夠的存儲節點讀寫時才會拋出錯誤。為了調試，可以監聽個別節點的錯誤：

```typescript
const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    storageNodeClientOptions: {
      onError: (error) => {
        console.log('Storage node error:', error);
        // 記錄或處理個別節點的錯誤
      },
    },
  })
);
```

## Vite/瀏覽器環境配置

### WASM 模塊加載

在 Vite 中，需要手動指定 WASM 綁定的 URL：

```typescript
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';

const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    wasmUrl: walrusWasmUrl,
  })
);
```

如果無法獲取 WASM 文件 URL，可以從 CDN 加載：

```typescript
const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
  })
);
```

### Next.js 配置

在 Next.js 中使用 Walrus 時，需要在 `next.config.ts` 中配置：

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};
```

## 注意事項

1. **SDK 方式需要費用**：上傳數據到 Walrus 需要支付 SUI（gas）和 WAL（存儲費用）
2. **請求數量**：直接使用 SDK 需要大量請求（寫入 ~2200，讀取 ~335），建議使用 Upload Relay 或 Aggregator/Publisher
3. **瀏覽器環境**：使用 `writeFilesFlow` 將上傳分為多個步驟，避免彈窗被阻止
4. **網絡選擇**：確保選擇正確的網絡（testnet/mainnet），並設置 `network` 參數
5. **Upload Relay**：強烈推薦使用 Upload Relay 來減少客戶端請求數量
6. **錯誤處理**：處理 `RetryableWalrusClientError`，在需要時重置客戶端
7. **批量操作**：批量讀寫文件時，SDK 會更高效
8. **超時設置**：某些節點響應較慢，建議設置適當的超時時間

## 性能考慮

### 請求數量

- **寫入一個 blob**：約 2200 個請求（使用 Upload Relay 可大幅減少）
- **讀取一個 blob**：約 335 個請求
- **批量讀取**：從同一個 Quilt 讀取多個文件時更高效

### 推薦方案

1. **生產環境**：使用 Aggregator/Publisher（HTTP API 方式）
2. **需要直接控制**：使用 SDK + Upload Relay
3. **用戶自付費**：使用 SDK 直接與節點交互

## 參考資源

- [官方 Walrus SDK 文檔](https://sdk.mystenlabs.com/walrus#walrusblobs)
- [Walrus SDK GitHub](https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus)
- [Awesome Walrus](https://github.com/MystenLabs/awesome-walrus)
- [Seal 文檔](https://seal-docs.wal.app/)
- [Walrus 示例代碼](https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus/examples)

