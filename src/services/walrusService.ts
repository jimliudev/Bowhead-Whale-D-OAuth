/**
 * Walrus Storage Service
 * 封裝 Walrus 存儲操作
 * 
 * 支持兩種方式：
 * 1. 使用 Walrus SDK（推薦）- 需要 SuiClient 和 Signer
 * 2. 使用 HTTP API（簡單）- 通過 Aggregator/Publisher
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { walrus, WalrusFile, type WalrusClient, TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus';
import type { Signer } from '@mysten/sui/cryptography';

// 在 Vite 中配置 WASM 文件 URL
// 優先使用本地 public 目錄中的 WASM 文件（由 vite.config.ts 複製）
// 如果本地文件不存在，則使用備選 CDN

// 使用本地 public 目錄中的 WASM 文件（推薦）
// 這個文件已經複製到 public 目錄，可以直接使用
const DEFAULT_WALRUS_WASM_URL = '/walrus_wasm_bg.wasm';

export interface WalrusConfig {
  aggregatorUrl?: string;
  publisherUrl?: string;
  network?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  suiRpcUrl?: string;
  wasmUrl?: string; // 可選：自定義 WASM 文件 URL
  uploadRelay?: {
    host: string;
    sendTip?: {
      max?: number;
      address?: string;
      kind?: {
        const?: number;
        linear?: {
          base: number;
          perEncodedKib: number;
        };
      };
    };
  };
  storageNodeClientOptions?: {
    timeout?: number;
    onError?: (error: Error) => void;
  };
}

export class WalrusService {
  private aggregatorUrl?: string;
  private network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  private suiClient?: SuiClient & { walrus: WalrusClient };
  private useSdk: boolean;

  constructor(config: WalrusConfig) {
    this.aggregatorUrl = config.aggregatorUrl;
    this.network = 'testnet';
    this.useSdk = !config.aggregatorUrl; // 如果沒有提供 aggregatorUrl，使用 SDK

    // 如果使用 SDK 模式，初始化 SuiClient
    if (this.useSdk) {
      // const rpcUrl = config.suiRpcUrl || getFullnodeUrl(this.network);
      const rpcUrl = config.suiRpcUrl || getFullnodeUrl(this.network);
      
      // 構建 uploadRelay 配置
      let uploadRelayConfig: any = undefined;
      if (config.uploadRelay) {
        uploadRelayConfig = {
          host: config.uploadRelay.host,
        };
        
        if (config.uploadRelay.sendTip) {
          if (config.uploadRelay.sendTip.max !== undefined) {
            uploadRelayConfig.sendTip = { max: config.uploadRelay.sendTip.max };
          } else if (config.uploadRelay.sendTip.address && config.uploadRelay.sendTip.kind) {
            const kind = config.uploadRelay.sendTip.kind;
            if (kind.const !== undefined) {
              uploadRelayConfig.sendTip = {
                address: config.uploadRelay.sendTip.address,
                kind: { const: kind.const },
              };
            } else if (kind.linear) {
              uploadRelayConfig.sendTip = {
                address: config.uploadRelay.sendTip.address,
                kind: {
                  linear: {
                    base: kind.linear.base,
                    perEncodedKib: kind.linear.perEncodedKib,
                  },
                },
              };
            }
          }
        }
      }
      
      // 使用配置中的 wasmUrl，如果沒有則使用本地 public 目錄中的文件
      // 本地文件路徑：/walrus_wasm_bg.wasm（已複製到 public 目錄）
      let wasmUrl = config.wasmUrl || DEFAULT_WALRUS_WASM_URL;
      
      // 如果使用本地文件（以 / 開頭），在瀏覽器中構建完整 URL
      if (wasmUrl.startsWith('/') && typeof window !== 'undefined') {
        wasmUrl = window.location.origin + wasmUrl;
      }
      
      console.log('使用 WASM URL:', wasmUrl);
      
      // 根據網絡配置 packageConfig
      // 如果明確指定了 network，SDK 會自動使用對應的配置
      // 但為了確保使用測試網配置，我們明確指定
      const walrusConfig: any = {
        uploadRelay: uploadRelayConfig,
        wasmUrl: wasmUrl,
      };
      
      // 添加 storageNodeClientOptions（參考範例代碼）
      if (config.storageNodeClientOptions) {
        walrusConfig.storageNodeClientOptions = config.storageNodeClientOptions;
      }
      
      // 明確指定測試網配置
      if (this.network === 'testnet') {
        walrusConfig.network = 'testnet';
        // 明確指定 packageConfig 確保使用測試網配置
        walrusConfig.packageConfig = TESTNET_WALRUS_PACKAGE_CONFIG;
      } else if (this.network === 'mainnet') {
        walrusConfig.network = 'mainnet';
      }

      console.log('walrusConfig', walrusConfig)
      console.log('rpcUrl', rpcUrl)
      console.log('this.network', this.network)
      
      this.suiClient = new SuiClient({
        url: rpcUrl,
        network: this.network,
      }).$extend(
        walrus(walrusConfig)
      ) as SuiClient & { walrus: WalrusClient };
    }
  }

  /**
   * 使用 Walrus SDK 上傳數據（推薦方式）
   * @param data 要上傳的數據（Uint8Array）
   * @param signer 用於簽名交易的 Signer
   * @param epochs 存儲的紀元數（默認 3）
   * @param deletable 是否可刪除（默認 true）
   * @returns blob ID
   */
  async uploadBlobWithSdk(
    data: Uint8Array,
    signer: Signer,
    epochs: number = 3,
    deletable: boolean = true
  ): Promise<string> {
    if (!this.suiClient) {
      throw new Error('SuiClient 未初始化。請確保未提供 aggregatorUrl 以使用 SDK 模式。');
    }

    try {
      const { blobId } = await this.suiClient.walrus.writeBlob({
        blob: data,
        epochs,
        deletable,
        signer,
      });

      return blobId;
    } catch (error) {
      console.error('Walrus SDK upload error:', error);
      throw error;
    }
  }

  /**
   * 使用 Walrus SDK 上傳文件（支持多文件）
   * @param files 要上傳的文件列表
   * @param signer 用於簽名交易的 Signer
   * @param epochs 存儲的紀元數（默認 3）
   * @param deletable 是否可刪除（默認 true）
   * @returns 上傳結果列表
   */
  async uploadFilesWithSdk(
    files: Array<{ contents: Uint8Array; identifier?: string; tags?: Record<string, string> }>,
    signer: Signer,
    epochs: number = 3,
    deletable: boolean = true
  ) {
    if (!this.suiClient) {
      throw new Error('SuiClient 未初始化。請確保未提供 aggregatorUrl 以使用 SDK 模式。');
    }

    try {
      const walrusFiles = files.map((file) => {
        const fileConfig: any = {
          contents: file.contents,
        };
        if (file.identifier) {
          fileConfig.identifier = file.identifier;
        }
        if (file.tags) {
          fileConfig.tags = file.tags;
        }
        return WalrusFile.from(fileConfig);
      });

      const results = await this.suiClient.walrus.writeFiles({
        files: walrusFiles,
        epochs,
        deletable,
        signer,
      });

      return results;
    } catch (error) {
      console.error('Walrus SDK upload files error:', error);
      throw error;
    }
  }

  /**
   * 使用 HTTP API 上傳數據到 Walrus（通過 Aggregator/Publisher）
   * @param data 要上傳的數據（Uint8Array）
   * @returns blob reference ID
   */
  async uploadBlob(data: Uint8Array): Promise<string> {
    // 如果使用 SDK 模式，拋出錯誤提示使用 SDK 方法
    if (this.useSdk) {
      throw new Error(
        '當前配置使用 SDK 模式。請使用 uploadBlobWithSdk() 方法，並提供 Signer。'
      );
    }

    if (!this.aggregatorUrl) {
      throw new Error('請配置 Walrus Aggregator URL 或使用 SDK 模式。');
    }

    try {
      // 檢查 URL 是否為示例 URL
      if (this.aggregatorUrl.includes('example.com')) {
        throw new Error(
          '請配置真實的 Walrus Aggregator URL。當前使用的是示例 URL。\n' +
          '可用的服務：https://walrus-mainnet-publisher-1.staketab.org:443'
        );
      }

      // 使用 Walrus HTTP API 上傳
      const response = await fetch(`${this.aggregatorUrl}/v1/blob`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(data),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result.reference || result.blobId; // blob reference ID
    } catch (error) {
      console.error('Walrus upload error:', error);
      
      // 提供更友好的錯誤信息
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        if (this.aggregatorUrl?.includes('example.com')) {
          throw new Error(
            '無法連接到 Walrus 服務：請在配置中設置真實的 aggregator URL。\n' +
            '參考：https://github.com/MystenLabs/awesome-walrus'
          );
        } else {
          throw new Error(
            `無法連接到 Walrus 服務 (${this.aggregatorUrl})。\n` +
            '請檢查：\n' +
            '1. URL 是否正確\n' +
            '2. 網絡連接是否正常\n' +
            '3. 服務是否可用'
          );
        }
      }
      
      throw error;
    }
  }

  /**
   * 從 Walrus 下載數據（使用 SDK）
   * @param blobId blob ID
   * @returns 下載的數據（Uint8Array）
   */
  async downloadBlobWithSdk(blobId: string): Promise<Uint8Array> {
    if (!this.suiClient) {
      throw new Error('SuiClient 未初始化。請確保未提供 aggregatorUrl 以使用 SDK 模式。');
    }

    try {
      const blob = await this.suiClient.walrus.readBlob({ blobId });
      return blob;
    } catch (error) {
      console.error('Walrus SDK download error:', error);
      throw error;
    }
  }

  /**
   * 從 Walrus 下載數據（使用 HTTP API）
   * @param reference blob reference ID
   * @returns 下載的數據（Uint8Array）
   */
  async downloadBlob(reference: string): Promise<Uint8Array> {
    // 如果使用 SDK 模式，嘗試使用 SDK 下載
    if (this.useSdk) {
      return this.downloadBlobWithSdk(reference);
    }

    if (!this.aggregatorUrl) {
      throw new Error('請配置 Walrus Aggregator URL 或使用 SDK 模式。');
    }

    try {
      // 檢查 URL 是否為示例 URL
      if (this.aggregatorUrl.includes('example.com')) {
        throw new Error(
          '請配置真實的 Walrus Aggregator URL。當前使用的是示例 URL。'
        );
      }

      const response = await fetch(`${this.aggregatorUrl}/v1/blob/${reference}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`下載失敗 (${response.status}): ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error('Walrus download error:', error);
      
      // 提供更友好的錯誤信息
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(
          `無法連接到 Walrus 服務 (${this.aggregatorUrl})。請檢查網絡連接和服務 URL。`
        );
      }
      
      throw error;
    }
  }

  /**
   * 將字符串轉換為 Uint8Array
   */
  stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * 將 Uint8Array 轉換為字符串
   */
  uint8ArrayToString(data: Uint8Array): string {
    return new TextDecoder().decode(data);
  }

  /**
   * 獲取 SuiClient（如果使用 SDK 模式）
   */
  getSuiClient(): (SuiClient & { walrus: WalrusClient }) | undefined {
    return this.suiClient;
  }

  /**
   * 檢查是否使用 SDK 模式
   */
  isUsingSdk(): boolean {
    return this.useSdk;
  }
}

