import { SealClient, SessionKey } from "@mysten/seal";
import { SEAL_PACKAGE_ID, SEAL_PACKAGE_ID_ACCESS_DATA_POLICY } from "../config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { stringToHexString } from "./utils";
import { fromHex, toHex } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";

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
    id: string,
    data: Uint8Array,
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
        packageId: SEAL_PACKAGE_ID,
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
   * 獲取加密時使用的 Seal ID
   * 這個 ID 在解密時也必須使用相同的值
   */
  getEncryptionSealId(): string {
    return stringToHexString(SEAL_PACKAGE_ID_ACCESS_DATA_POLICY);
  }

  /**
   * 生成用於 owner policy 的 Seal ID
   * 格式：vault_id + nonce
   * 注意：這個方法用於 owner 訪問，不用於當前的 readonly 訪問
   */
  getSealId (vaultId: string, nonce?: Uint8Array) :{ id: string, nonce: Uint8Array } {
    nonce = nonce || crypto.getRandomValues(new Uint8Array(5));
    const policyObjectBytes = fromHex(vaultId);
    const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
    return { id, nonce };
  }

  /**
   * 使用 Seal 解密數據
   * @param encryptedData 加密的數據
   * @param sessionKey Session Key
   * @param sealId Seal ID (hex string)
   * @param vaultId Vault object ID
   * @param itemId Data item object ID
   * @param readonlyCapId ReadOnlyCap object ID
   * @returns 解密後的數據（Uint8Array）
   */
  async decrypt(
    encryptedBytes: Uint8Array<ArrayBuffer>,
    sessionKey: SessionKey,
    sealId: string,
    vaultId: string,
    itemId: string,
    readonlyCapId: string
  ): Promise<Uint8Array> {
    try {
      console.log('=== sealService.decrypt 開始 ===')
      console.log('📥 接收到的參數:', {
        encryptedBytesLength: encryptedBytes.length,
        sessionKeyType: typeof sessionKey,
        sessionKeyHasPersonalMessage: !!sessionKey?.getPersonalMessage(),
        sealId,
        vaultId,
        itemId,
        readonlyCapId,
      })

      const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
      const serverObjectIds = ["0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"];

      console.log('🔧 創建 SealClient...')
      const client = new SealClient({
        suiClient,
        serverConfigs: serverObjectIds.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });
      console.log('✅ SealClient 已創建')

      console.log('📝 構建交易...')
      const tx = new Transaction();
      const clockObject = tx.object('0x6');
      
      // 清理 seal ID (移除 0x 前綴)
      const cleanSealId = sealId.replace(/^0x/i, '');
      
      console.log('🔑 交易參數:', {
        sealId: cleanSealId,
        sealIdLength: cleanSealId.length,
        vaultId,
        itemId,
        readonlyCapId,
        clockObjectId: '0x6',
      });

      console.log('📋 調用 seal_approve:', {
        target: `${SEAL_PACKAGE_ID}::seal_private_data::seal_approve`,
        sealIdBytes: Array.from(fromHex(cleanSealId)).length,
      })
      
      tx.moveCall({
          target: `${SEAL_PACKAGE_ID}::seal_private_data::seal_approve`, 
          arguments: [
              tx.pure.vector("u8", Array.from(fromHex(cleanSealId))),
              tx.object(vaultId),
              tx.object(itemId),
              tx.object(readonlyCapId),
              clockObject,
        ]
      });

      console.log('🔨 構建交易字節碼...')
      const txBytes = await tx.build( { client: suiClient, onlyTransactionKind: true })
      console.log('✅ 交易字節碼已構建，長度:', txBytes.length)
      
      console.log('🔓 調用 SealClient.decrypt...')
      console.log('解密參數:', {
        encryptedDataLength: encryptedBytes.length,
        sessionKeyType: typeof sessionKey,
        txBytesLength: txBytes.length,
      })
      
      const decryptedBytes = await client.decrypt({
          data: encryptedBytes,
          sessionKey,
          txBytes,
      });

      console.log('✅ 解密成功，解密數據長度:', decryptedBytes.length)
      console.log('=== sealService.decrypt 完成 ===')
      return decryptedBytes;
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
}

