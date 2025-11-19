import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
  useWallets,
  useCurrentWallet,
  ConnectButton,
} from '@mysten/dapp-kit'
import { WalrusService } from '../services/walrusService'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { walrus } from '@mysten/walrus'
import { getFundedKeypair } from '../funded-keypair'
import './HomePage.css'

// 配置
const WALRUS_CONFIG_SDK = {
  network: 'testnet' as const,
  suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
  uploadRelay: {
    host: 'https://upload-relay.testnet.walrus.space',
    sendTip: {
      max: 1000,
    },
  },
  storageNodeClientOptions: {
    timeout: 60_000,
  },
} as const

const WALRUS_CONFIG = WALRUS_CONFIG_SDK

export default function HomePage() {
  const currentAccount = useCurrentAccount()
  const { mutate: connect } = useConnectWallet()
  const { mutate: disconnect } = useDisconnectWallet()
  const wallets = useWallets()
  const { currentWallet } = useCurrentWallet()
  
  const isConnected = Boolean(currentAccount)
  const [inputText, setInputText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploadMode, setUploadMode] = useState<'text' | 'file'>('text')
  const [encryptedBlobRef, setEncryptedBlobRef] = useState<string | null>(null)
  const [blobIdInput, setBlobIdInput] = useState<string>('')
  const [decryptedText, setDecryptedText] = useState<string>('')
  const [downloadedFile, setDownloadedFile] = useState<{ name: string; data: Uint8Array; type: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walBalance, setWalBalance] = useState<string | null>(null)
  const [suiBalance, setSuiBalance] = useState<string | null>(null)

  const walrusService = useMemo(() => new WalrusService(WALRUS_CONFIG), [])

  const suiClient = new SuiClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  }).$extend(
    walrus({
      storageNodeClientOptions: {
        timeout: 60_000,
      },
    }),
  )

  const handleConnect = async () => {
    try {
      setWalletError(null)
      setStatus('正在連接錢包...')
      
      if (wallets.length > 0) {
        connect({ wallet: wallets[0] })
        setStatus('✅ 錢包連接成功！')
        setTimeout(() => setStatus(''), 3000)
      } else {
        setWalletError('未檢測到 Sui 錢包。請安裝 Sui Wallet 擴展。')
        setStatus('')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '連接失敗'
      setWalletError(`錢包連接錯誤: ${errorMessage}`)
      setStatus('')
      console.error('Wallet connection error:', err)
    }
  }

  useEffect(() => {
    if (wallets.length === 0) {
      setWalletError('未檢測到 Sui 錢包。請安裝 Sui Wallet 擴展。')
    } else {
      setWalletError(null)
    }
  }, [wallets])

  useEffect(() => {
    const checkBalance = async () => {
      if (!isConnected || !currentAccount || !walrusService.isUsingSdk()) {
        setWalBalance(null)
        setSuiBalance(null)
        return
      }

      try {
        const suiClient = walrusService.getSuiClient()
        if (!suiClient) return

        const suiCoins = await suiClient.getCoins({
          owner: currentAccount.address,
          coinType: '0x2::sui::SUI',
        })
        const totalSui = suiCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n)
        setSuiBalance((Number(totalSui) / 1e9).toFixed(4))

        const walCoinType = '0x8190b041122eb492bf63cb464476bd68c6b7e570a4079645a8b28732b6197a82::wal::WAL'
        
        try {
          const walCoins = await suiClient.getCoins({
            owner: currentAccount.address,
            coinType: walCoinType,
          })
          
          const totalWal = walCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n)
          const walBalanceNum = Number(totalWal) / 1e9
          setWalBalance(walBalanceNum.toFixed(4))
          
          if (walCoins.data.length > 1) {
            console.warn(`⚠️ 檢測到 ${walCoins.data.length} 個 WAL coin，可能存在碎片化問題`)
          }
        } catch (err) {
          setWalBalance('0')
          console.warn('無法獲取 WAL 餘額:', err)
        }
      } catch (err) {
        console.error('檢查餘額失敗:', err)
      }
    }

    checkBalance()
    const interval = setInterval(checkBalance, 5000)
    return () => clearInterval(interval)
  }, [isConnected, currentAccount, walrusService])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setFilePreview(null)
      }
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    const fileInput = document.getElementById('fileInput') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const fileToUint8Array = async (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer
        resolve(new Uint8Array(arrayBuffer))
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const detectFileType = (data: Uint8Array): { type: string; extension: string } => {
    if (data.length === 0) {
      return { type: 'application/octet-stream', extension: 'bin' }
    }

    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return { type: 'image/jpeg', extension: 'jpg' }
    }
    
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
        data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A) {
      return { type: 'image/png', extension: 'png' }
    }
    
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
      return { type: 'image/gif', extension: 'gif' }
    }
    
    if (data.length >= 12 &&
        data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      return { type: 'image/webp', extension: 'webp' }
    }
    
    if (data[0] === 0x42 && data[1] === 0x4D) {
      return { type: 'image/bmp', extension: 'bmp' }
    }

    const textStart = String.fromCharCode(...data.slice(0, Math.min(100, data.length)))
    if (textStart.includes('<svg') || textStart.trim().startsWith('<svg')) {
      return { type: 'image/svg+xml', extension: 'svg' }
    }

    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(0, Math.min(1000, data.length)))
      if (/^[\x20-\x7E\s]*$/.test(text)) {
        return { type: 'text/plain', extension: 'txt' }
      }
    } catch {
      // Not valid UTF-8 text
    }

    return { type: 'application/octet-stream', extension: 'bin' }
  }

  const handleEncryptAndUpload = async () => {
    if (uploadMode === 'text' && !inputText.trim()) {
      setError('請輸入要上傳的文本')
      return
    }
    
    if (uploadMode === 'file' && !selectedFile) {
      setError('請選擇要上傳的文件')
      return
    }

    if (!isConnected || !currentAccount) {
      setError('請先連接 Sui 錢包')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('準備上傳...')

    try {
      const keypair = await getFundedKeypair('suiprivkey1qqvakcmwlmjv48gm5vycjkah8f8xxecmka5tgyh6h57yzr4r9v9cck705rf')

      let fileData: Uint8Array
      let fileName: string
      let fileType: string

      if (uploadMode === 'text') {
        fileData = new TextEncoder().encode(inputText)
        fileName = 'text.txt'
        fileType = 'text/plain'
        setStatus('正在上傳文本到 Walrus...')
      } else {
        if (!selectedFile) {
          throw new Error('未選擇文件')
        }
        setStatus(`正在上傳文件到 Walrus... (${selectedFile.name})`)
        fileData = await fileToUint8Array(selectedFile)
        fileName = selectedFile.name
        fileType = selectedFile.type
      }
      
      const { blobId, blobObject } = await suiClient.walrus.writeBlob({
        blob: fileData,
        deletable: true,
        epochs: 3,
        signer: keypair,
      })
      
      console.log('Blob ID:', blobId)
      console.log('Blob Object:', blobObject)
      console.log('File Info:', { fileName, fileType, size: fileData.length })

      setStatus('驗證上傳狀態...')
      try {
        const readBlob = await suiClient.walrus.readBlob({ blobId })
        
        if (uploadMode === 'text') {
          const readText = new TextDecoder().decode(readBlob)
          if (readText === inputText) {
            setEncryptedBlobRef(blobId)
            setBlobIdInput(blobId)
            setStatus(`✅ 文本已成功上傳並驗證！\nBlob ID: ${blobId}\n可在 https://walrus.scan.space/blobs 查看（可能需要等待幾分鐘索引）`)
            console.log('✅ 驗證成功：可以讀取上傳的文本')
          } else {
            setError(`⚠️ 上傳完成但數據驗證失敗\nBlob ID: ${blobId}\n請檢查數據是否正確`)
            console.warn('⚠️ 數據驗證失敗：讀取的數據與上傳的數據不匹配')
          }
        } else {
          if (readBlob.length === fileData.length) {
            const isMatch = readBlob.every((byte, index) => byte === fileData[index])
            if (isMatch) {
              setEncryptedBlobRef(blobId)
              setBlobIdInput(blobId)
              setStatus(`✅ 文件已成功上傳並驗證！\n文件名: ${fileName}\n大小: ${(fileData.length / 1024).toFixed(2)} KB\nBlob ID: ${blobId}\n可在 https://walrus.scan.space/blobs 查看（可能需要等待幾分鐘索引）`)
              console.log('✅ 驗證成功：可以讀取上傳的文件')
            } else {
              setError(`⚠️ 上傳完成但數據驗證失敗\nBlob ID: ${blobId}\n請檢查文件是否正確`)
            }
          } else {
            setError(`⚠️ 上傳完成但大小不匹配\nBlob ID: ${blobId}\n原始大小: ${fileData.length}, 讀取大小: ${readBlob.length}`)
          }
        }
      } catch (readError) {
        setEncryptedBlobRef(blobId)
        setBlobIdInput(blobId)
        setStatus(`⚠️ 已獲得 Blob ID，但無法立即讀取\n文件名: ${uploadMode === 'file' ? fileName : 'text.txt'}\nBlob ID: ${blobId}\n可能原因：\n1. 數據還在同步到存儲節點（請等待幾分鐘）\n2. 部分存儲節點上傳失敗（但註冊成功）\n\n可在 https://walrus.scan.space/blobs 查看狀態（可能需要等待索引）`)
        console.warn('⚠️ 無法立即讀取 blob，可能還在處理中:', readError)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知錯誤'
      setError(`加密或上傳失敗: ${errorMessage}`)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadAndDecrypt = async () => {
    const blobIdToDownload = blobIdInput.trim() || encryptedBlobRef
    
    if (!blobIdToDownload) {
      setError('請輸入 Blob ID 或先上傳數據')
      return
    }

    if (!isConnected || !currentAccount) {
      setError('請先連接 Sui 錢包')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('正在從 Walrus 下載數據...')

    try {
      setStatus('正在讀取 Blob...')
      const blobBytes = await suiClient.walrus.readBlob({ blobId: blobIdToDownload })
      
      setStatus('數據已下載，開始解析...')
      
      const fileTypeInfo = detectFileType(blobBytes)
      
      if (fileTypeInfo.type.startsWith('image/')) {
        setDownloadedFile({
          name: `image_${blobIdToDownload.slice(0, 8)}.${fileTypeInfo.extension}`,
          data: blobBytes,
          type: fileTypeInfo.type,
        })
        setDecryptedText('')
        setStatus(`✅ 圖片已成功下載並自動顯示！\n格式: ${fileTypeInfo.type}\n大小: ${(blobBytes.length / 1024).toFixed(2)} KB\nBlob ID: ${blobIdToDownload}`)
      } else if (fileTypeInfo.type === 'text/plain') {
        const text = new TextDecoder().decode(blobBytes)
        setDecryptedText(text)
        setDownloadedFile(null)
        setStatus(`✅ 文本數據已成功下載！\nBlob ID: ${blobIdToDownload}`)
      } else {
        setDownloadedFile({
          name: `file_${blobIdToDownload.slice(0, 8)}.${fileTypeInfo.extension}`,
          data: blobBytes,
          type: fileTypeInfo.type,
        })
        setDecryptedText('')
        setStatus(`✅ 文件數據已成功下載！\n類型: ${fileTypeInfo.type}\n大小: ${(blobBytes.length / 1024).toFixed(2)} KB\nBlob ID: ${blobIdToDownload}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知錯誤'
      setError(`下載失敗: ${errorMessage}\n\n請檢查：\n1. Blob ID 是否正確\n2. Blob 是否已完全上傳到存儲節點\n3. 網絡連接是否正常`)
      setStatus('')
      console.error('下載錯誤詳情:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>🐋 Walrus + Seal 範例（測試網）</h1>
            <p className="subtitle" style={{ marginTop: '0.5rem' }}>
              使用 Seal 加密數據並存儲到 Walrus 去中心化存儲（測試網環境）
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/walrus-test" className="btn btn-secondary">
              Walrus 錢包簽名 →
            </Link>
            <Link to="/wallet-test" className="btn btn-secondary">
              錢包簽章測試 →
            </Link>
            <Link to="/seal-test" className="btn btn-secondary">
              Seal 測試 →
            </Link>
          </div>
        </div>
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          backgroundColor: 'rgba(255, 193, 7, 0.1)', 
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '8px',
          fontSize: '0.9rem'
        }}>
          <strong>⚠️ 測試網模式</strong>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
            當前使用 Sui 測試網和 Walrus 測試網服務。請確保錢包已切換到測試網網絡。
          </p>
        </div>

        {/* 錢包連接 */}
        <div className="wallet-section">
          {!isConnected ? (
            <div>
              <ConnectButton />
              <button 
                onClick={handleConnect} 
                className="btn btn-primary"
                style={{ marginTop: '1rem' }}
              >
                或點擊這裡連接錢包
              </button>
              {walletError && (
                <div className="error-box" style={{ marginTop: '1rem' }}>
                  <p>⚠️ {walletError}</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    請安裝 <a href="https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" target="_blank" rel="noopener noreferrer">Sui Wallet</a> 擴展
                  </p>
                </div>
              )}
              {wallets.length > 0 && (
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  檢測到 {wallets.length} 個可用錢包: {wallets.map(w => w.name).join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div className="wallet-info">
              <p>
                <strong>已連接錢包:</strong> {currentWallet?.name || '未知'}
              </p>
              <p>
                <strong>地址:</strong> {currentAccount?.address || '無'}
              </p>
              {walrusService.isUsingSdk() && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <p>
                    <strong>SUI 餘額:</strong> {suiBalance !== null ? `${suiBalance} SUI` : '檢查中...'}
                  </p>
                  <p>
                    <strong>WAL 餘額:</strong> {walBalance !== null ? `${walBalance} WAL` : '檢查中...'}
                    {walBalance === '0' && (
                      <span style={{ color: '#ff6b6b', marginLeft: '0.5rem' }}>
                        ⚠️ 餘額不足
                      </span>
                    )}
                  </p>
                </div>
              )}
              <button onClick={() => disconnect()} className="btn btn-secondary">
                斷開連接
              </button>
            </div>
          )}
        </div>

        {/* 加密和上傳 */}
        <div className="section">
          <h2>1. 上傳數據到 Walrus</h2>
          
          {/* 上傳模式選擇 */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setUploadMode('text')
                setSelectedFile(null)
                setFilePreview(null)
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: uploadMode === 'text' ? '#6366f1' : '#f3f4f6',
                color: uploadMode === 'text' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: uploadMode === 'text' ? 'bold' : 'normal',
              }}
            >
              文本模式
            </button>
            <button
              onClick={() => {
                setUploadMode('file')
                setInputText('')
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: uploadMode === 'file' ? '#6366f1' : '#f3f4f6',
                color: uploadMode === 'file' ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: uploadMode === 'file' ? 'bold' : 'normal',
              }}
            >
              文件/圖片模式
            </button>
          </div>

          {/* 文本輸入模式 */}
          {uploadMode === 'text' && (
            <textarea
              className="input-textarea"
              placeholder="輸入要上傳的文本..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
            />
          )}

          {/* 文件選擇模式 */}
          {uploadMode === 'file' && (
            <div>
              <input
                id="fileInput"
                type="file"
                onChange={handleFileSelect}
                accept="image/*,.*"
                style={{
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  width: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              
              {/* 文件信息 */}
              {selectedFile && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <strong>文件名:</strong> {selectedFile.name}
                      <br />
                      <strong>大小:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
                      <br />
                      <strong>類型:</strong> {selectedFile.type || '未知'}
                    </div>
                    <button
                      onClick={handleClearFile}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      清除
                    </button>
                  </div>
                  
                  {/* 圖片預覽 */}
                  {filePreview && (
                    <div style={{ marginTop: '1rem' }}>
                      <strong>預覽:</strong>
                      <div style={{
                        marginTop: '0.5rem',
                        maxWidth: '100%',
                        maxHeight: '300px',
                        overflow: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        backgroundColor: 'white',
                      }}>
                        <img
                          src={filePreview}
                          alt="預覽"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            display: 'block',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleEncryptAndUpload}
            disabled={loading || !isConnected || (uploadMode === 'text' && !inputText.trim()) || (uploadMode === 'file' && !selectedFile)}
            className="btn btn-primary"
          >
            {loading ? '處理中...' : uploadMode === 'text' ? '上傳文本到 Walrus' : '上傳文件到 Walrus'}
          </button>
        </div>

        {/* 下載和解密 */}
        <div className="section">
          <h2>2. 下載並解密數據</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="blobIdInput" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Blob ID:
            </label>
            <input
              id="blobIdInput"
              type="text"
              className="input-textarea"
              placeholder="輸入 Blob ID 或使用上次上傳的 Blob ID"
              value={blobIdInput}
              onChange={(e) => setBlobIdInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
            {encryptedBlobRef && !blobIdInput && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                上次上傳的 Blob ID: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>{encryptedBlobRef}</code>
                <button
                  onClick={() => setBlobIdInput(encryptedBlobRef)}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '2px 8px',
                    fontSize: '0.8rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  使用此 ID
                </button>
              </p>
            )}
          </div>
          <button
            onClick={handleDownloadAndDecrypt}
            disabled={loading || !isConnected || (!blobIdInput.trim() && !encryptedBlobRef)}
            className="btn btn-primary"
          >
            {loading ? '處理中...' : '從 Walrus 下載數據'}
          </button>
        </div>

        {/* 下載結果 */}
        {(decryptedText || downloadedFile) && (
          <div className="section">
            <h2>下載結果</h2>
            
            {/* 文本結果 */}
            {decryptedText && (
              <div className="result-box">
                <h3 style={{ marginTop: 0 }}>文本內容:</h3>
                <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{decryptedText}</p>
              </div>
            )}

            {/* 文件結果 */}
            {downloadedFile && (
              <div className="result-box">
                <h3 style={{ marginTop: 0 }}>文件信息:</h3>
                <p>
                  <strong>文件名:</strong> {downloadedFile.name}<br />
                  <strong>大小:</strong> {(downloadedFile.data.length / 1024).toFixed(2)} KB<br />
                  <strong>類型:</strong> {downloadedFile.type}
                </p>
                
                {/* 如果是圖片，顯示預覽 */}
                {downloadedFile.type.startsWith('image/') && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>圖片預覽:</strong>
                    <div style={{
                      marginTop: '0.5rem',
                      maxWidth: '100%',
                      maxHeight: '400px',
                      overflow: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      backgroundColor: 'white',
                    }}>
                      <img
                        src={URL.createObjectURL(new Blob([new Uint8Array(downloadedFile.data)], { type: downloadedFile.type }))}
                        alt="下載的圖片"
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 下載按鈕 */}
                <button
                  onClick={() => {
                    const blob = new Blob([new Uint8Array(downloadedFile.data)], { type: downloadedFile.type })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = downloadedFile.name
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  下載文件
                </button>
              </div>
            )}
          </div>
        )}

        {/* 狀態信息 */}
        {status && (
          <div className="status-box">
            <p>{status}</p>
          </div>
        )}

        {/* 錯誤信息 */}
        {error && (
          <div className="error-box">
            <p>❌ {error}</p>
          </div>
        )}

        {/* 說明 */}
        <div className="info-section">
          <h3>使用說明</h3>
          <ol>
            <li>連接您的 Sui 錢包</li>
            <li>輸入要加密的文本數據</li>
            <li>點擊「加密並上傳到 Walrus」按鈕</li>
            <li>數據將使用 Seal 加密後存儲到 Walrus</li>
            <li>使用 Blob Reference 可以下載並解密數據</li>
          </ol>
          <p className="note">
            <strong>注意：</strong>這是一個示例應用。實際使用時需要：
            <ul>
              <li>配置正確的 Walrus Aggregator URL</li>
              <li>配置正確的 Seal Key Server URL</li>
              <li>安裝並使用實際的 @seal-io/sdk 和 @walrus-sdk/core</li>
              <li>實現 Sui Move 訪問策略合約</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
  )
}

