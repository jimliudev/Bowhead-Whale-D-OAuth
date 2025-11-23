import { useState, useMemo } from 'react'
import {
  useCurrentAccount,
  useCurrentWallet,
  ConnectButton,
} from '@mysten/dapp-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { SealClient, SessionKey } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/sui/utils'
import { SealService } from '../../services/sealService'
import { SEAL_PACKAGE_ID } from '../../config'
import '../../App.css'


export default function SealTest() {
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  
  const isConnected = Boolean(currentAccount)

  const suiClient = useMemo(() => {
    return new SuiClient({
      url: getFullnodeUrl('testnet'),
      network: 'testnet',
    })
  }, [])

  const [inputText, setInputText] = useState('Hello, Seal Encryption Test!')
  const [encryptedData, setEncryptedData] = useState<Uint8Array | null>(null)
  const [decryptedText, setDecryptedText] = useState<string>('')
  const [sealId, setSealId] = useState<string>('')
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  
  // 動態解密輸入欄位
  const [manualEncryptedHex, setManualEncryptedHex] = useState<string>('')
  const [manualSealId, setManualSealId] = useState<string>('')
  const [manualVaultId, setManualVaultId] = useState<string>('')
  const [manualItemId, setManualItemId] = useState<string>('')
  const [manualReadonlyCapId, setManualReadonlyCapId] = useState<string>('')
  const [manualSessionKeyJson, setManualSessionKeyJson] = useState<string>('')
  const [importedSessionKeyJson, setImportedSessionKeyJson] = useState<string>('')
  const [manualDecryptedText, setManualDecryptedText] = useState<string>('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualStatus, setManualStatus] = useState<string>('')

  // Generate a test vault ID (using account address as vault ID)
  const vaultId = useMemo(() => {
    if (!currentAccount) return ''
    try {
      // Use first 32 bytes of address as vault ID
      // If address is shorter, pad with zeros
      const addressBytes = fromHex(currentAccount.address)
      const vaultIdBytes = new Uint8Array(32)
      vaultIdBytes.set(addressBytes.slice(0, 32), 0)
      return toHex(vaultIdBytes)
    } catch {
      return ''
    }
  }, [currentAccount])

  const handleEncrypt = async () => {
    if (!isConnected || !currentAccount) {
      setError('請先連接錢包')
      return
    }

    if (!inputText.trim()) {
      setError('請輸入要加密的文本')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('正在加密...')

    try {
      const sealService = new SealService()

      setStatus('正在使用 Seal 加密數據...')
      const data = new TextEncoder().encode(inputText)

      // 加密使用固定的 Policy ID
      const encryptionSealId = sealService.getEncryptionSealId();
      const { encryptedObject, key } = await sealService.encrypt(encryptionSealId, data);

      setEncryptedData(encryptedObject)
      setDecryptedText('')
      setSealId(encryptionSealId) // 保存 Seal ID
      
      // 自動填入解密參數
      setManualSealId(encryptionSealId)
      
      setStatus(`✅ 加密成功！\nSeal ID: ${encryptionSealId}\n加密數據大小: ${encryptedObject.length} bytes`)
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '加密失敗'
      setError(errorMsg)
      setStatus('❌ 加密失敗')
      console.error('加密錯誤:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async () => {
    if (!isConnected || !currentAccount) {
      setError('請先連接錢包')
      return
    }

    if (!encryptedData) {
      setError('沒有加密數據可解密')
      return
    }


    setLoading(true)
    setError(null)
    setStatus('正在準備解密...')

    try {
      // Get or create session key
      let currentSessionKey = sessionKey

      if (!currentSessionKey || !isValidSessionKey(currentSessionKey)) {
        setStatus('正在創建 Session Key...')

        console.log('currentAccount address', currentAccount.address)

        // Create new session key
        const newSessionKey = await SessionKey.create({
          address: currentAccount.address,
          packageId: SEAL_PACKAGE_ID,
          ttlMin: 10,
          suiClient,
        })

        setStatus('請在錢包中簽名以創建 Session Key...')

        // Sign personal message
        const personalMessage = newSessionKey.getPersonalMessage()
        const signature = await signPersonalMessage(personalMessage)

        await newSessionKey.setPersonalMessageSignature(signature)
        currentSessionKey = newSessionKey
        setSessionKey(newSessionKey)

        // 顯示 export key 到輸入欄位
        try {
          const serialized = serializeSessionKey(newSessionKey)
          setManualSessionKeyJson(serialized)
        } catch (err) {
          console.warn('⚠️ 無法導出 SessionKey:', err)
        }
      }

      setStatus('正在解密數據...')

      console.log('decrypt before service')
      const sealService = new SealService()
      
      // TODO: 需要提供正確的 sealId, vaultId, itemId, readonlyCapId
      // 這些值應該來自用戶的實際數據
      throw new Error('請使用「動態解密測試」功能，並提供完整的解密參數（Seal ID、Vault ID、Item ID、ReadOnly Cap ID）')

      console.log('decrypt after service')
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '解密失敗'
      setError(errorMsg)
      setStatus('❌ 解密失敗')
      console.error('解密錯誤:', err)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to sign personal message
  const signPersonalMessage = async (message: Uint8Array): Promise<string> => {
    if (!currentWallet || !currentAccount) {
      throw new Error('錢包未連接')
    }

    try {
      // Try to use wallet's signPersonalMessage feature
      const signPersonalMessageFeature = currentWallet.features['sui:signPersonalMessage']
      if (signPersonalMessageFeature) {
        const result = await signPersonalMessageFeature.signPersonalMessage({
          message,
          account: currentAccount,
        })
        return result.signature
      }

      // Fallback to signMessage
      const signMessageFeature = currentWallet.features['sui:signMessage']
      if (signMessageFeature) {
        const result = await signMessageFeature.signMessage({
          message,
          account: currentAccount,
        })
        return result.signature
      }

      throw new Error('錢包不支持簽名個人消息')
    } catch (err: any) {
      console.error('簽名錯誤:', err)
      throw new Error(`簽名失敗: ${err?.message || err?.toString()}`)
    }
  }

  // Helper function to check if session key is valid
  const isValidSessionKey = (key: SessionKey | null): boolean => {
    return true
  }

  // 序列化 SessionKey 为 JSON (使用 export() 方法)
  // 注意：export() 返回的對象有自定義 toJSON 會拋錯，需要手動構建可序列化的對象
  const serializeSessionKey = (key: SessionKey): string => {
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

  // 从导入的 JSON 创建 SessionKey (使用 SessionKey.import)
  const createSessionKeyFromImported = async (jsonString: string): Promise<SessionKey | null> => {
    try {
      if (!jsonString.trim()) return null
      
      console.log('📥 嘗試從導入的 JSON 創建 SessionKey...')
      const keyData = JSON.parse(jsonString)
      console.log('📋 導入的 SessionKey 數據:', keyData)
      
      // 使用 SessionKey.import 恢復 SessionKey
      const restoredSessionKey = SessionKey.import(keyData, suiClient)
      
      console.log('✅ 從導入的 JSON 恢復了 SessionKey 對象')
      
      // 檢查是否需要重新簽名
      if (!restoredSessionKey.getPersonalMessage() || !keyData.personalMessageSignature) {
        setManualStatus('請在錢包中簽名以使用導入的 Session Key...')
        const personalMessage = restoredSessionKey.getPersonalMessage()
        const signature = await signPersonalMessage(personalMessage)
        await restoredSessionKey.setPersonalMessageSignature(signature)
        console.log('✅ 導入的 SessionKey 已簽名並準備就緒')
      } else {
        console.log('✅ 導入的 SessionKey 已包含簽名，可直接使用')
      }
      
      return restoredSessionKey
    } catch (err) {
      console.error('❌ 從導入的 JSON 創建 SessionKey 失敗:', err)
      return null
    }
  }

  // 處理手動輸入的解密
  const handleManualDecrypt = async () => {
    if (!isConnected || !currentAccount) {
      setManualError('請先連接錢包')
      return
    }

    if (!manualEncryptedHex.trim()) {
      setManualError('請輸入加密數據（Hex 格式）')
      return
    }

    if (!manualSealId.trim()) {
      setManualError('請輸入 Seal ID')
      return
    }

    if (!manualVaultId.trim()) {
      setManualError('請輸入 Vault ID')
      return
    }

    if (!manualItemId.trim()) {
      setManualError('請輸入 Item ID')
      return
    }

    if (!manualReadonlyCapId.trim()) {
      setManualError('請輸入 ReadOnly Cap ID')
      return
    }

    setManualLoading(true)
    setManualError(null)
    setManualStatus('正在準備解密...')

    try {
      // 將 hex 字符串轉換為 Uint8Array
      let encryptedBytes: Uint8Array
      try {
        // 移除可能的 0x 前綴和空白字符
        const cleanHex = manualEncryptedHex.trim().replace(/^0x/i, '').replace(/\s/g, '')
        encryptedBytes = fromHex(cleanHex)
      } catch (err) {
        throw new Error('無效的 Hex 格式，請檢查輸入的數據')
      }

      // Get or create session key
      // 優先使用導入的 SessionKey，如果沒有則創建新的
      let currentSessionKey: SessionKey | null = null

      console.log('=== Session Key 處理開始 ===')
      console.log('輸入欄位狀態:', {
        importedSessionKeyJson: importedSessionKeyJson.trim() ? '有值' : '為空',
        importedSessionKeyJsonLength: importedSessionKeyJson.trim().length,
        manualSessionKeyJson: manualSessionKeyJson.trim() ? '有值' : '為空',
        manualSessionKeyJsonLength: manualSessionKeyJson.trim().length,
        existingSessionKey: sessionKey ? '存在' : '不存在',
        existingSessionKeyValid: sessionKey && isValidSessionKey(sessionKey) ? '有效' : '無效或不存在',
      })

      // 優先檢查是否有導入的 SessionKey
      if (importedSessionKeyJson.trim()) {
        console.log('📥 檢測到導入的 SessionKey JSON，優先使用導入的 SessionKey')
        const importedKey = await createSessionKeyFromImported(importedSessionKeyJson)
        if (importedKey) {
          currentSessionKey = importedKey
          setSessionKey(importedKey)
          console.log('✅ 成功使用導入的 SessionKey')
          
          // 顯示 export key 到輸入欄位
          try {
            const serialized = serializeSessionKey(importedKey)
            setManualSessionKeyJson(serialized)
          } catch (err) {
            console.warn('⚠️ 無法導出 SessionKey:', err)
          }
        } else {
          console.warn('⚠️ 無法從導入的 JSON 創建 SessionKey，將使用其他方式')
        }
      }

      // 如果還沒有 SessionKey，則創建新的
      if (!currentSessionKey) {
        // 如果輸入欄位為空，就創建新的 Session Key
        if (!manualSessionKeyJson.trim()) {
          // 輸入欄位為空，創建新的 Session Key
          console.log('📝 輸入欄位為空，準備創建新的 Session Key')
          setManualStatus('正在創建 Session Key...')

          console.log('🔑 創建 Session Key 參數:', {
            address: currentAccount.address,
            packageId: SEAL_PACKAGE_ID,
            ttlMin: 10,
          })

          const newSessionKey = await SessionKey.create({
            address: currentAccount.address,
            packageId: SEAL_PACKAGE_ID,
            ttlMin: 10,
            suiClient,
          })

          console.log('✅ Session Key 對象已創建:', {
            hasPersonalMessage: !!newSessionKey.getPersonalMessage(),
          })

          setManualStatus('請在錢包中簽名以創建 Session Key...')

          const personalMessage = newSessionKey.getPersonalMessage()
          console.log('📝 Personal Message 長度:', personalMessage.length)
          const signature = await signPersonalMessage(personalMessage)
          console.log('✍️ 簽名完成，簽名長度:', signature.length)

          await newSessionKey.setPersonalMessageSignature(signature)
          currentSessionKey = newSessionKey
          setSessionKey(newSessionKey)
          
          console.log('🎉 新的 Session Key 已創建並設置')
          
              // 序列化並顯示創建好的 Session Key
              try {
                const serialized = serializeSessionKey(newSessionKey)
                console.log('💾 Session Key 序列化結果:', serialized)
                setManualSessionKeyJson(serialized)
                setManualStatus('✅ Session Key 已創建並顯示在下方')
              } catch (err) {
                console.warn('⚠️ 無法序列化 SessionKey:', err)
              }
        } else {
          // 輸入欄位有值，檢查是否有有效的 sessionKey
          // 注意：由於 SessionKey 無法完全反序列化，我們仍然需要有效的 sessionKey 對象
          if (sessionKey && isValidSessionKey(sessionKey)) {
            // 使用現有的有效 sessionKey
            console.log('♻️ 使用現有的有效 Session Key')
            currentSessionKey = sessionKey
            
            // 顯示 export key 到輸入欄位
            try {
              const serialized = serializeSessionKey(sessionKey)
              setManualSessionKeyJson(serialized)
            } catch (err) {
              console.warn('⚠️ 無法導出 SessionKey:', err)
            }
          } else {
            // 嘗試從 manualSessionKeyJson 導入
            console.log('📝 輸入欄位有值，嘗試從中恢復 Session Key')
            const importedFromManual = await createSessionKeyFromImported(manualSessionKeyJson)
            
            if (importedFromManual) {
              console.log('✅ 成功從手動輸入欄位恢復 Session Key')
              currentSessionKey = importedFromManual
              setSessionKey(importedFromManual)
            } else {
              // 如果導入失敗，則創建新的 Session Key
              console.log('⚠️ 無法從手動輸入恢復，準備創建新的 Session Key')
              setManualStatus('無法從輸入恢復 Key，正在創建新的 Session Key...')

              console.log('🔑 創建 Session Key 參數:', {
                address: currentAccount.address,
                packageId: SEAL_PACKAGE_ID,
                ttlMin: 10,
              })

              const newSessionKey = await SessionKey.create({
                address: currentAccount.address,
                packageId: SEAL_PACKAGE_ID,
                ttlMin: 10,
                suiClient,
              })

              console.log('✅ Session Key 對象已創建:', {
                hasPersonalMessage: !!newSessionKey.getPersonalMessage(),
              })

              setManualStatus('請在錢包中簽名以創建 Session Key...')

              const personalMessage = newSessionKey.getPersonalMessage()
              console.log('📝 Personal Message 長度:', personalMessage.length)
              const signature = await signPersonalMessage(personalMessage)
              console.log('✍️ 簽名完成，簽名長度:', signature.length)

              await newSessionKey.setPersonalMessageSignature(signature)
              currentSessionKey = newSessionKey
              setSessionKey(newSessionKey)
              
              console.log('🎉 新的 Session Key 已創建並設置')
              
              // 序列化並顯示創建好的 Session Key
              try {
                const serialized = serializeSessionKey(newSessionKey)
                console.log('💾 Session Key 序列化結果:', serialized)
                setManualSessionKeyJson(serialized)
                setManualStatus('✅ Session Key 已創建並顯示在下方')
              } catch (err) {
                console.warn('⚠️ 無法序列化 SessionKey:', err)
              }
            }
          }
        }
      }

      // 解密前顯示使用的 Session Key 信息
      console.log('=== 解密前 Session Key 信息 ===')

      if (currentSessionKey) {
        try {
          const serialized = serializeSessionKey(currentSessionKey)
          console.log('🔐 將使用以下 Session Key 進行解密:')
          console.log('Session Key JSON:', serialized)
          console.log('Session Key 對象:', {
            type: 'SessionKey',
            hasPersonalMessage: !!currentSessionKey.getPersonalMessage(),
            address: currentAccount.address,
            packageId: SEAL_PACKAGE_ID,
          })
          // 更新顯示的 Session Key JSON
          setManualSessionKeyJson(serialized)
        } catch (err) {
          console.log('🔐 將使用以下 Session Key 進行解密:')
          console.log('Session Key 對象 (無法序列化):', {
            type: 'SessionKey',
            hasPersonalMessage: !!currentSessionKey.getPersonalMessage(),
            address: currentAccount.address,
            packageId: SEAL_PACKAGE_ID,
          })
          console.error('無法導出 SessionKey:', err)
        }
      } else {
        console.error('❌ 錯誤：沒有可用的 Session Key！')
      }
      console.log('=== Session Key 處理完成 ===')

      setManualStatus('正在解密數據...')

      console.log('=== 開始解密 ===')
      console.log('解密參數:', {
        encryptedDataLength: encryptedBytes.length,
        encryptedDataHex: toHex(encryptedBytes).slice(0, 50) + '...',
        sealId: manualSealId.trim(),
        vaultId: manualVaultId.trim(),
        itemId: manualItemId.trim(),
        readonlyCapId: manualReadonlyCapId.trim(),
        sessionKey: currentSessionKey ? '已準備' : '缺失',
      })

      const sealService = new SealService()
      console.log('🔓 調用 sealService.decrypt...')
      const decrypted = await sealService.decrypt(
        encryptedBytes as Uint8Array<ArrayBuffer>,
        currentSessionKey as SessionKey,
        manualSealId.trim(),
        manualVaultId.trim(),
        manualItemId.trim(),
        manualReadonlyCapId.trim(),
        0
      )
      console.log('✅ 解密完成，解密數據長度:', decrypted.length)

      setManualDecryptedText(new TextDecoder().decode(decrypted))
      setManualStatus('✅ 解密成功！')
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '解密失敗'
      setManualError(errorMsg)
      setManualStatus('❌ 解密失敗')
      console.error('解密錯誤:', err)
    } finally {
      setManualLoading(false)
    }
  }

  // Simplified function to build seal_approve transaction bytes
  // In production, you would use your actual Move contract
  const buildSealApproveTxBytes = async (
    id: string,
    vaultId: string
  ): Promise<Uint8Array> => {
    // This is a placeholder - in real implementation, you would:
    // 1. Build a Transaction with seal_approve function call
    // 2. Use onlyTransactionKind: true to get transaction bytes
    // 3. Return the bytes

    // For now, return a minimal transaction bytes structure
    // Note: This is a simplified version and may not work for actual decryption
    // You need to build the actual seal_approve transaction from your Move contract
    const idBytes = fromHex(id)
    const vaultIdBytes = fromHex(vaultId)
    
    // Create a minimal transaction structure
    // In production, use TransactionBuilder to build the actual seal_approve call
    return new Uint8Array([...vaultIdBytes, ...idBytes])
  }

  return (
    <div className="container">
      <h1>Seal 加密測試</h1>

      <div className="section">
        <h2>錢包狀態</h2>
        {isConnected && currentAccount ? (
          <div>
            <p>✅ 已連接</p>
            <p>錢包: {currentWallet?.name || 'Unknown'}</p>
            <p>地址: {currentAccount?.address || 'N/A'}</p>
            {vaultId && <p>Vault ID: {vaultId}</p>}
          </div>
        ) : (
          <div>
            <p>❌ 未連接</p>
            <ConnectButton />
          </div>
        )}
      </div>

      <div className="section">
        <h2>加密測試</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="inputText">要加密的文本：</label>
          <textarea
            id="inputText"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
            }}
            placeholder="輸入要加密的文本..."
          />
        </div>

        <button
          onClick={handleEncrypt}
          disabled={loading || !isConnected || !inputText.trim()}
          className="btn btn-primary"
        >
          {loading ? '加密中...' : '加密數據'}
        </button>

        {encryptedData && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#e8f5e9' }}>
            <p><strong>✅ 加密完成</strong></p>
            <p>加密數據大小: {encryptedData.length} bytes</p>
            
            {sealId && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Seal ID（解密時必須使用相同值）:</strong></p>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', wordBreak: 'break-all', fontFamily: 'monospace', color: '#d32f2f' }}>
                  {sealId}
                </p>
              </div>
            )}
            
            <details style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>加密數據 (Hex)</summary>
              <p style={{ fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace', marginTop: '0.5rem' }}>
                {toHex(encryptedData)}
              </p>
            </details>
            
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const hexData = toHex(encryptedData)
                    await navigator.clipboard.writeText(hexData)
                    setStatus('✅ 已複製加密數據到剪貼板')
                  } catch (err) {
                    console.error('複製失敗:', err)
                    setError('複製失敗，請手動複製')
                  }
                }}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                📋 複製加密數據
              </button>
              
              <button
                onClick={async () => {
                  try {
                    const dataToCopy = JSON.stringify({
                      encryptedData: toHex(encryptedData),
                      sealId: sealId || '',
                      size: encryptedData.length,
                    }, null, 2)
                    await navigator.clipboard.writeText(dataToCopy)
                    setStatus('✅ 已複製完整加密信息到剪貼板（JSON 格式）')
                  } catch (err) {
                    console.error('複製失敗:', err)
                    setError('複製失敗，請手動複製')
                  }
                }}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                📄 複製完整信息
              </button>
              
              <button
                onClick={() => {
                  setManualEncryptedHex(toHex(encryptedData))
                  if (sealId) {
                    setManualSealId(sealId)
                  }
                  setManualError(null)
                  setManualStatus('已複製加密數據和 Seal ID 到動態解密測試區域')
                }}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                ➡️ 複製到動態解密測試
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <h2>解密測試</h2>
        <button
          onClick={handleDecrypt}
          disabled={loading || !isConnected || !encryptedData}
          className="btn btn-primary"
        >
          {loading ? '解密中...' : '解密數據'}
        </button>

        {decryptedText && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#e3f2fd' }}>
            <p><strong>✅ 解密結果：</strong></p>
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {decryptedText}
            </p>
          </div>
        )}
      </div>

      <div className="section">
        <h2>動態解密測試</h2>
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          可以手動輸入加密數據和相關參數進行解密測試
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="manualEncryptedHex">
            <strong>加密數據（Hex 格式）：</strong>
          </label>
          <textarea
            id="manualEncryptedHex"
            value={manualEncryptedHex}
            onChange={(e) => setManualEncryptedHex(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder="請輸入加密數據的 Hex 字符串（可包含 0x 前綴）..."
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="manualSealId">
            <strong>Seal ID：</strong>
          </label>
          <input
            type="text"
            id="manualSealId"
            value={manualSealId}
            onChange={(e) => setManualSealId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder="0x..."
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#d32f2f', fontWeight: 'bold' }}>
            ⚠️ 必須使用加密時顯示的 Seal ID（與加密時完全相同）
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="manualVaultId">
            <strong>Vault ID：</strong>
          </label>
          <input
            type="text"
            id="manualVaultId"
            value={manualVaultId}
            onChange={(e) => setManualVaultId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder="0x..."
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#666' }}>
            DataVault 對象的 ID
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="manualItemId">
            <strong>Item ID：</strong>
          </label>
          <input
            type="text"
            id="manualItemId"
            value={manualItemId}
            onChange={(e) => setManualItemId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder="0x..."
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#666' }}>
            Data 對象的 ID
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="manualReadonlyCapId">
            <strong>ReadOnly Cap ID：</strong>
          </label>
          <input
            type="text"
            id="manualReadonlyCapId"
            value={manualReadonlyCapId}
            onChange={(e) => setManualReadonlyCapId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder="0x..."
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#666' }}>
            ReadOnlyCap 對象的 ID（必須有效且未過期）
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label htmlFor="importedSessionKeyJson">
              <strong>匯入 SessionKey（JSON 格式，優先使用）：</strong>
            </label>
            {importedSessionKeyJson && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(importedSessionKeyJson)
                    setManualStatus('✅ 已複製匯入的 SessionKey 到剪貼板')
                  } catch (err) {
                    setManualError('複製失敗')
                  }
                }}
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                📋 複製
              </button>
            )}
          </div>
          <textarea
            id="importedSessionKeyJson"
            value={importedSessionKeyJson}
            onChange={(e) => setImportedSessionKeyJson(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              border: importedSessionKeyJson.trim() ? '2px solid #4caf50' : '1px solid #ccc',
            }}
            placeholder='{"address": "...", "packageId": "...", "timestamp": ...}'
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#4caf50', fontWeight: 'bold' }}>
            ⚡ 優先級最高：如果填寫此欄位，系統會優先使用此 SessionKey 進行解密（需要重新簽名）
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label htmlFor="manualSessionKeyJson">
              <strong>Session Key（JSON 格式，可選）：</strong>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                  onClick={() => {
                    setSessionKey(null)
                    setManualSessionKeyJson('')
                    setManualStatus('已清除 Session Key')
                  }}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                  title="清除當前 Session Key 和輸入框"
                >
                  🗑️ 清除
                </button>
              {sessionKey && (
                <button
                  onClick={async () => {
                    try {
                      const serialized = serializeSessionKey(sessionKey)
                      setManualSessionKeyJson(serialized)
                      setManualStatus('✅ 已顯示當前 Session Key 的 export() 輸出')
                    } catch (err: any) {
                      setManualError(`無法導出 SessionKey: ${err?.message || err}`)
                      console.error('導出 SessionKey 失敗:', err)
                    }
                  }}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                  title="顯示當前 Session Key 的 export() 輸出"
                >
                  📤 顯示 Export
                </button>
              )}
              {manualSessionKeyJson && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(manualSessionKeyJson)
                      setManualStatus('✅ 已複製 Session Key 到剪貼板')
                    } catch (err) {
                      setManualError('複製失敗')
                    }
                  }}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  📋 複製
                </button>
              )}
            </div>
          </div>
          <textarea
            id="manualSessionKeyJson"
            value={manualSessionKeyJson}
            onChange={(e) => setManualSessionKeyJson(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
            placeholder='{"address": "...", "packageId": "...", "timestamp": ...}'
          />
          <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#666' }}>
            可選：輸入之前保存的 Session Key JSON。如果留空，系統會自動創建新的 Session Key。如果在此處貼上 JSON，系統會嘗試從中恢復 Session Key。
          </p>
          {sessionKey && !manualSessionKeyJson.trim() && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff3cd', borderRadius: '4px', fontSize: '0.75rem' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>提示：</p>
              <p style={{ margin: '0.3rem 0 0 0', color: '#856404' }}>
                系統已準備好 Session Key，點擊「解密數據」後會自動創建並顯示在此欄位中。
              </p>
            </div>
          )}
          {manualSessionKeyJson.trim() && sessionKey && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#d4edda', borderRadius: '4px', fontSize: '0.75rem' }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#155724' }}>✅ Session Key 已創建：</p>
              <p style={{ margin: '0.3rem 0 0 0', color: '#155724' }}>
                系統已自動創建並顯示 Session Key，您可以複製保存以供日後使用。
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleManualDecrypt}
          disabled={
            manualLoading || 
            !isConnected || 
            !manualEncryptedHex.trim() ||
            !manualSealId.trim() ||
            !manualVaultId.trim() ||
            !manualItemId.trim() ||
            !manualReadonlyCapId.trim()
          }
          className="btn btn-primary"
        >
          {manualLoading ? '解密中...' : '解密數據'}
        </button>

        {manualStatus && (
          <div className="status-box" style={{ marginTop: '1rem' }}>
            {manualStatus}
          </div>
        )}

        {manualError && (
          <div className="error-box" style={{ marginTop: '1rem' }}>
            ❌ 錯誤: {manualError}
          </div>
        )}

        {manualDecryptedText && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#e3f2fd' }}>
            <p><strong>✅ 解密結果：</strong></p>
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {manualDecryptedText}
            </p>
          </div>
        )}
      </div>

      {status && (
        <div className="status-box" style={{ marginTop: '1rem' }}>
          {status}
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginTop: '1rem' }}>
          ❌ 錯誤: {error}
        </div>
      )}

      <div className="info-section" style={{ marginTop: '2rem' }}>
        <h3>使用說明</h3>
        <ol>
          <li>連接您的 Sui 錢包</li>
          <li>輸入要加密的文本</li>
          <li>點擊「加密數據」按鈕</li>
          <li>使用「動態解密測試」功能：
            <ul style={{ marginTop: '0.5rem' }}>
              <li>輸入加密數據（Hex 格式）</li>
              <li>輸入 Seal ID（加密時生成的 ID）</li>
              <li>輸入 Vault ID（DataVault 對象 ID）</li>
              <li>輸入 Item ID（Data 對象 ID）</li>
              <li>輸入 ReadOnly Cap ID（需要先創建 ReadOnlyCap）</li>
            </ul>
          </li>
        </ol>
        <p className="note">
          <strong>注意：</strong>
          <ul>
            <li>此測試頁面使用測試網的 Key Server 和 Package ID</li>
            <li>解密需要有效的 ReadOnlyCap 對象，且該對象不能過期</li>
            <li>Seal ID 格式：vault_id（32字節）+ nonce（5字節）</li>
            <li>需要先在鏈上創建 DataVault、Data 和 ReadOnlyCap 對象</li>
            <li>ReadOnlyCap 必須關聯到正確的 Vault，且未過期</li>
          </ul>
        </p>
        
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '4px' }}>
          <h4 style={{ marginTop: 0 }}>準備工作</h4>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>在使用解密功能之前，您需要：</p>
          <ol style={{ fontSize: '0.9rem', marginBottom: 0 }}>
            <li>創建 DataVault（使用 <code>create_data_vault_entry</code>）</li>
            <li>創建 Data 對象（使用 <code>create_data_entry</code>）</li>
            <li>創建 ReadOnlyCap（使用 <code>create_readonly_cap_entry</code>）</li>
            <li>記錄所有對象的 ID 用於解密</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

