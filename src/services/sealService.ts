import { SealClient, SessionKey } from "@mysten/seal";
import { SEAL_PACKAGE_ID, SEAL_PACKAGE_ID_ACCESS_DATA_POLICY } from "../config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { stringToHexString } from "./utils";

export interface SealConfig {
  keyServerUrl: string;
  accessPolicyPackageId?: string;
}

export interface EncryptedData {
  encryptedObject: Uint8Array<ArrayBuffer>;
  key: Uint8Array<ArrayBuffer>;
}

export class SealService {
  private keyServerUrl: string;
  private accessPolicyPackageId?: string;

  constructor() {
    this.keyServerUrl = 'https://seal-key-server.example.com';
    this.accessPolicyPackageId = SEAL_PACKAGE_ID_ACCESS_DATA_POLICY;
  }

  /**
   * 使用 Seal 加密數據
   * @param data 要加密的數據（Uint8Array）
   * @param publicKeys 用於加密的公鑰列表
   * @returns 加密後的數據部分
   */
  async encrypt(
    data: Uint8Array
  ): Promise<EncryptedData> {
    try {
      const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
      const serverObjectIds = ["0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"];

      const client = new SealClient({
        suiClient,
        serverConfigs: serverObjectIds.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });

      const { encryptedObject: encryptedBytes, key: backupKey } = await client.encrypt({
        threshold: 2,
        packageId: stringToHexString(SEAL_PACKAGE_ID),
        id: stringToHexString(SEAL_PACKAGE_ID_ACCESS_DATA_POLICY),
        data,
      });

      return {
        encryptedObject: encryptedBytes,
        key: backupKey as Uint8Array<ArrayBuffer>,
      };
    } catch (error) {
      console.error('Seal encryption error:', error);
      throw error;
    }
  }

  /**
   * 使用 Seal 解密數據
   * @param encryptedData 加密的數據
   * @param privateKey 用於解密的私鑰（由 key server 提供）
   * @returns 解密後的數據（Uint8Array）
   */
  async decrypt(
    encryptedData: EncryptedData,
    privateKey: string
  ): Promise<Uint8Array> {
    try {
      // 示例：模擬解密過程
      // 實際應用中，需要從 key server 獲取私鑰
      const decrypted = await this.mockDecrypt();
      return decrypted;
    } catch (error) {
      console.error('Seal decryption error:', error);
      throw error;
    }
  }

  /**
   * 從 Seal Key Server 獲取解密私鑰
   * @param identity 身份標識（通常是 Sui 地址）
   * @param accessPolicyId 訪問策略 ID
   * @returns 私鑰
   */
  async getDecryptionKey(
    identity: string,
    accessPolicyId?: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.keyServerUrl}/v1/key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity,
          accessPolicyId: accessPolicyId || this.accessPolicyPackageId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get decryption key: ${response.statusText}`);
      }

      const result = await response.json();
      return result.privateKey;
    } catch (error) {
      console.error('Seal key server error:', error);
      throw error;
    }
  }

  /**
   * 模擬解密（僅用於示例，實際應使用 Seal SDK）
   */
  private async mockDecrypt(
  ): Promise<Uint8Array> {
    const base64 = '';
    const binaryString = atob(base64);
    return new Uint8Array(binaryString.length).map((_, i) =>
      binaryString.charCodeAt(i)
    );
  }
}

