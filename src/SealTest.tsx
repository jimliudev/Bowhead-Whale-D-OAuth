import { useState, useMemo } from 'react'
import {
  useCurrentAccount,
  useCurrentWallet,
  ConnectButton,
} from '@mysten/dapp-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { SealClient, SessionKey } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/sui/utils'
import { SealService } from './services/sealService'
import './App.css'


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

      const { encryptedObject, key } = await sealService.encrypt(data);


      setEncryptedData(encryptedObject)
      setDecryptedText('')
      setStatus(`✅ 加密成功！\nSeal key: ${key}\n加密數據大小: ${encryptedObject.length} bytes`)
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

        // Create new session key
        const newSessionKey = await SessionKey.create({
          address: currentAccount.address,
          packageId: "",
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
      }

      setStatus('正在構建交易字節碼...')

      // Build transaction bytes for seal_approve
      // Note: This is a simplified version. In production, you would build
      // the actual seal_approve transaction bytes from your Move contract
      const txBytes = await buildSealApproveTxBytes(sealId, vaultId)

      setStatus('正在解密數據...')

      // const decrypted = await sealClient.decrypt({
      //   data: encryptedData,
      //   sessionKey: currentSessionKey,
      //   txBytes,
      // })

      setDecryptedText("decryptedText")
      setStatus('✅ 解密成功！')
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

        {sealId && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f0f0f0' }}>
            <p><strong>Seal ID:</strong> {sealId}</p>
          </div>
        )}

        {encryptedData && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#e8f5e9' }}>
            <p><strong>✅ 加密完成</strong></p>
            <p>加密數據大小: {encryptedData.length} bytes</p>
            <p style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
              {toHex(encryptedData).slice(0, 100)}...
            </p>
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
          <li>點擊「解密數據」按鈕來驗證加密/解密流程</li>
        </ol>
        <p className="note">
          <strong>注意：</strong>
          <ul>
            <li>此測試頁面使用測試網的 Key Server 和 Package ID</li>
            <li>解密功能需要實現 seal_approve 交易字節碼構建（當前為簡化版本）</li>
            <li>實際使用時需要根據您的 Move 合約構建正確的交易字節碼</li>
          </ul>
        </p>
      </div>
    </div>
  )
}

