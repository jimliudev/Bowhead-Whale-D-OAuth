import { SealClient, SessionKey } from "@mysten/seal";
import { SEAL_PACKAGE_ID, SEAL_PACKAGE_ID_ACCESS_DATA_POLICY } from "../config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { stringToHexString } from "./utils";
import { fromHex, toHex } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";
import type { WalletAccount, WalletWithFeatures } from "@mysten/wallet-standard";
// Removed React hooks imports - they should not be used in service classes

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
    _id: string,
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
    accessAddress: string
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
        accessAddress,
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
        accessAddress,
        clockObjectId: '0x6',
      });

      console.log('📋 調用 seal_approve:', {
        target: `${SEAL_PACKAGE_ID}::seal_private_data::seal_approve`,
        sealIdBytes: Array.from(fromHex(cleanSealId)).length,
      })
      
      tx.moveCall({
          target: `${SEAL_PACKAGE_ID}::seal_private_data::seal_approve`, 
          arguments: [
              tx.pure.vector('u8', Array.from(fromHex(cleanSealId))),
              tx.object(vaultId),
              tx.object(itemId),
              tx.pure.address(accessAddress),
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

  /**
   * 序列化 SessionKey 為 JSON 字符串
   * 注意：export() 返回的對象有自定義 toJSON 會拋錯，需要手動構建可序列化的對象
   * @param key SessionKey 對象
   * @returns JSON 字符串
   */
  serializeSessionKey(key: SessionKey): string {
    try {
      const exported = key.export()
      // 手動構建可序列化的對象，避免觸發 export() 返回對象的 toJSON 錯誤
      const serializable: {
        address: string
        packageId: string
        mvrName?: string
        creationTimeMs: number
        ttlMin: number
        personalMessageSignature?: string
        sessionKey: string
      } = {
        address: exported.address,
        packageId: exported.packageId,
        creationTimeMs: exported.creationTimeMs,
        ttlMin: exported.ttlMin,
        sessionKey: exported.sessionKey,
      }
      if (exported.mvrName) {
        serializable.mvrName = exported.mvrName
      }
      if (exported.personalMessageSignature) {
        serializable.personalMessageSignature = exported.personalMessageSignature
      }
      return JSON.stringify(serializable, null, 2)
    } catch (err) {
      console.error('序列化 SessionKey 失敗:', err)
      throw new Error('無法序列化 SessionKey')
    }
  }

  /**
   * 簽名個人消息
   * @param wallet 錢包對象
   * @param account 賬戶對象
   * @param message 要簽名的消息（Uint8Array）
   * @returns 簽名字符串
   */
  async signPersonalMessage(
    wallet: WalletWithFeatures<any>,
    account: WalletAccount,
    message: Uint8Array
  ): Promise<string> {
    if (!wallet || !account) {
      throw new Error('Wallet not connected')
    }

    try {
      // Use wallet's signPersonalMessage feature
      const signPersonalMessageFeature = wallet.features['sui:signPersonalMessage']
      if (signPersonalMessageFeature) {
        const result = await signPersonalMessageFeature.signPersonalMessage({
          message,
          account,
        })
        return result.signature
      }

      // Fallback to signMessage
      const signMessageFeature = wallet.features['sui:signMessage']
      if (signMessageFeature) {
        const result = await signMessageFeature.signMessage({
          message,
          account,
        })
        return result.signature
      }

      throw new Error('錢包不支持簽名個人消息')
    } catch (err: any) {
      console.error('簽名錯誤:', err)
      throw new Error(`簽名失敗: ${err?.message || err?.toString()}`)
    }
  }

  /**
   * 創建、簽名並導出 SessionKey 為 base64 字符串
   * @param address 用戶地址
   * @param wallet 錢包對象
   * @param account 賬戶對象
   * @param suiClient Sui 客戶端
   * @param ttlMin SessionKey 的 TTL（分鐘），默認 10 分鐘
   * @returns base64 編碼的 SessionKey JSON 字符串
   */
  async createAndExportSessionKeyAsBase64(
    address: string,
    wallet: WalletWithFeatures<any>,
    account: WalletAccount,
    suiClient: SuiClient,
    ttlMin: number = 10
  ): Promise<string> {
    try {
      console.log('🔑 Creating SessionKey...')
      
      // Create SessionKey
      const sessionKey = await SessionKey.create({
        address,
        packageId: SEAL_PACKAGE_ID,
        ttlMin,
        suiClient,
      })

      console.log('📝 SessionKey created, requesting signature...')

      // Sign personal message
      const personalMessage = sessionKey.getPersonalMessage()
      const signature = await this.signPersonalMessage(wallet, account, personalMessage)
      await sessionKey.setPersonalMessageSignature(signature)


      console.log('✅ SessionKey signed, exporting...')

      // Export SessionKey to JSON
      const sessionKeyJson = this.serializeSessionKey(sessionKey)
      console.log('📦 SessionKey JSON exported')

      // Convert JSON to base64
      const sessionKeyBase64 = btoa(unescape(encodeURIComponent(sessionKeyJson)))
      console.log('🔐 SessionKey converted to base64')

      return sessionKeyBase64
    } catch (error) {
      console.error('Failed to create and export SessionKey:', error)
      throw error
    }
  }

  /**
   * 從 base64 編碼的字符串解析並恢復 SessionKey 對象
   * @param base64String base64 編碼的 SessionKey JSON 字符串
   * @param suiClient Sui 客戶端
   * @param wallet 可選的錢包對象（如果需要重新簽名）
   * @param account 可選的賬戶對象（如果需要重新簽名）
   * @returns 恢復的 SessionKey 對象
   */
  async importSessionKeyFromBase64(
    base64String: string,
    suiClient: SuiClient,
    wallet?: WalletWithFeatures<any>,
    account?: WalletAccount
  ): Promise<SessionKey> {
    try {
      console.log('📥 Decoding base64 SessionKey...')
      
      // Decode base64 to JSON string
      const jsonString = decodeURIComponent(escape(atob(base64String)))
      console.log('📦 SessionKey JSON decoded')
      
      // Parse JSON
      const keyData = JSON.parse(jsonString)
      console.log('📋 Parsed SessionKey data:', {
        address: keyData.address,
        packageId: keyData.packageId,
        hasSignature: !!keyData.personalMessageSignature,
      })
      
      // Import SessionKey using SessionKey.import
      const restoredSessionKey = SessionKey.import(keyData, suiClient)
      console.log('✅ SessionKey object restored')
      
      // Check if signature is missing or needs to be refreshed
      if (!keyData.personalMessageSignature && wallet && account) {
        console.log('⚠️ SessionKey missing signature, requesting new signature...')
        const personalMessage = restoredSessionKey.getPersonalMessage()
        const signature = await this.signPersonalMessage(wallet, account, personalMessage)
        await restoredSessionKey.setPersonalMessageSignature(signature)
        console.log('✅ SessionKey signed')
      } else if (!keyData.personalMessageSignature) {
        console.warn('⚠️ SessionKey missing signature, but no wallet provided for signing')
      }
      
      return restoredSessionKey
    } catch (error) {
      console.error('Failed to import SessionKey from base64:', error)
      throw new Error(`Failed to import SessionKey: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

