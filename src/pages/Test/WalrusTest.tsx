import { useState, useMemo } from 'react'
import {
  useCurrentAccount,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  ConnectButton,
} from '@mysten/dapp-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { walrus } from '@mysten/walrus'
import { toHex } from '@mysten/sui/utils'
import '../../App.css'

export default function WalrusTest() {
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  // 创建带有 walrus 扩展的 client
  const client = useMemo(() => {
    return new SuiClient({
      url: getFullnodeUrl('testnet'),
      network: 'testnet',
    }).$extend(
      walrus({
        storageNodeClientOptions: {
          timeout: 60_000,
        },
      }),
    )
  }, [])

  const isConnected = Boolean(currentAccount)

  // 上传状态
  const [uploadText, setUploadText] = useState<string>('Hello, Walrus!')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [uploadResult, setUploadResult] = useState<{
    blobId: string
    blobObject: string
    size: number
  } | null>(null)

  // 读取状态
  const [readBlobId, setReadBlobId] = useState<string>('')
  const [readLoading, setReadLoading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [readStatus, setReadStatus] = useState<string>('')
  const [readResult, setReadResult] = useState<{
    data: Uint8Array | null
    text: string | null
    size: number
  } | null>(null)

  // 创建 Wallet Signer
  const createWalletSigner = () => {
    return {
      getAddress: async () => currentAccount!.address,
      toSuiAddress: () => currentAccount!.address,
      signTransaction: async (_bytes: Uint8Array) => {
        throw new Error('signTransaction not supported')
      },
      signTransactionBlock: async (_tx: any) => {
        throw new Error('signTransactionBlock not supported')
      },
      signAndExecuteTransaction: async ({ transaction }: any) => {
        console.log('📝 執行交易簽名...')
        const result = await signAndExecuteTransaction({ transaction })
        console.log('✅ 交易執行結果:', result)
        return result
      },
    } as any
  }

  // 处理文本上传
  const handleUploadText = async () => {
    if (!isConnected || !currentAccount) {
      setUploadError('請先連接錢包')
      return
    }

    if (!uploadText.trim()) {
      setUploadError('請輸入要上傳的文本')
      return
    }

    setUploadLoading(true)
    setUploadError(null)
    setUploadStatus('準備上傳...')
    setUploadResult(null)

    try {
      // 检查 WAL 余额
      setUploadStatus('檢查 WAL 代幣餘額...')
      const walCoinType = '0x8190b041122eb492bf63cb464476bd68c6b7e570a4079645a8b28732b6197a82::wal::WAL'
      const walCoins = await client.getCoins({
        owner: currentAccount.address,
        coinType: walCoinType,
      })

      if (!walCoins.data || walCoins.data.length === 0) {
        throw new Error('未找到 WAL 代幣！請確保錢包中有測試網 WAL 代幣。')
      }

      const totalWal = walCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0))
      console.log('💰 WAL 餘額:', totalWal.toString())
      setUploadStatus(`WAL 餘額: ${(Number(totalWal) / 1e9).toFixed(4)} WAL\n準備上傳...`)

      // 转换文本为 Uint8Array
      const fileData = new TextEncoder().encode(uploadText)
      console.log('📦 數據大小:', fileData.length, 'bytes')

      setUploadStatus('正在上傳到 Walrus...')
      console.log('🚀 開始上傳...')

      // 上传到 Walrus
      const { blobId, blobObject } = await (client as any).walrus.writeBlob({
        blob: fileData,
        deletable: true,
        epochs: 1,
        signer: createWalletSigner(),
      })

      console.log('✅ 上傳成功!')
      console.log('📋 Blob ID:', blobId)
      console.log('🔗 Blob Object:', blobObject)

      setUploadResult({
        blobId,
        blobObject,
        size: fileData.length,
      })
      setUploadStatus('✅ 上傳成功！')
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '上傳失敗'
      setUploadError(errorMsg)
      setUploadStatus('❌ 上傳失敗')
      console.error('❌ 上傳錯誤:', err)
    } finally {
      setUploadLoading(false)
    }
  }

  // 处理文件上传
  const handleUploadFile = async () => {
    if (!isConnected || !currentAccount) {
      setUploadError('請先連接錢包')
      return
    }

    if (!uploadFile) {
      setUploadError('請選擇要上傳的文件')
      return
    }

    setUploadLoading(true)
    setUploadError(null)
    setUploadStatus('準備上傳文件...')
    setUploadResult(null)

    try {
      // 检查 WAL 余额
      setUploadStatus('檢查 WAL 代幣餘額...')
      const walCoinType = '0x8190b041122eb492bf63cb464476bd68c6b7e570a4079645a8b28732b6197a82::wal::WAL'
      const walCoins = await client.getCoins({
        owner: currentAccount.address,
        coinType: walCoinType,
      })

      if (!walCoins.data || walCoins.data.length === 0) {
        throw new Error('未找到 WAL 代幣！請確保錢包中有測試網 WAL 代幣。')
      }

      const totalWal = walCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0))
      console.log('💰 WAL 餘額:', totalWal.toString())
      setUploadStatus(`WAL 餘額: ${(Number(totalWal) / 1e9).toFixed(4)} WAL\n準備上傳文件...`)

      // 读取文件为 Uint8Array
      setUploadStatus('讀取文件...')
      const fileData = await uploadFile.arrayBuffer()
      const uint8Array = new Uint8Array(fileData)
      console.log('📦 文件大小:', uint8Array.length, 'bytes')
      console.log('📄 文件名:', uploadFile.name)
      console.log('📋 文件類型:', uploadFile.type)

      setUploadStatus(`正在上傳文件到 Walrus...\n文件名: ${uploadFile.name}\n大小: ${(uint8Array.length / 1024).toFixed(2)} KB`)
      console.log('🚀 開始上傳...')

      // 上传到 Walrus
      const { blobId, blobObject } = await (client as any).walrus.writeBlob({
        blob: uint8Array,
        deletable: true,
        epochs: 1,
        signer: createWalletSigner(),
      })

      console.log('✅ 上傳成功!')
      console.log('📋 Blob ID:', blobId)
      console.log('🔗 Blob Object:', blobObject)

      setUploadResult({
        blobId,
        blobObject,
        size: uint8Array.length,
      })
      setUploadStatus(`✅ 文件上傳成功！\n文件名: ${uploadFile.name}`)
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '上傳失敗'
      setUploadError(errorMsg)
      setUploadStatus('❌ 上傳失敗')
      console.error('❌ 上傳錯誤:', err)
    } finally {
      setUploadLoading(false)
    }
  }

  // 处理读取 Blob
  const handleReadBlob = async () => {
    if (!readBlobId.trim()) {
      setReadError('請輸入 Blob ID')
      return
    }

    setReadLoading(true)
    setReadError(null)
    setReadStatus('正在讀取...')
    setReadResult(null)

    try {
      console.log('📥 開始讀取 Blob:', readBlobId)
      setReadStatus(`正在從 Walrus 讀取...\nBlob ID: ${readBlobId}`)

      // 从 Walrus 读取数据
      const data = await (client as any).walrus.readBlob(readBlobId)
      console.log('✅ 讀取成功!', '數據大小:', data.length, 'bytes')

      // 尝试将数据转换为文本
      let text: string | null = null
      try {
        text = new TextDecoder().decode(data)
        console.log('📝 文本內容 (前100字符):', text.substring(0, 100))
      } catch (err) {
        console.log('⚠️ 無法解碼為文本，可能是二進制數據')
      }

      setReadResult({
        data,
        text,
        size: data.length,
      })
      setReadStatus('✅ 讀取成功！')
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '讀取失敗'
      setReadError(errorMsg)
      setReadStatus('❌ 讀取失敗')
      console.error('❌ 讀取錯誤:', err)
    } finally {
      setReadLoading(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setUploadStatus('✅ 已複製到剪貼板')
    } catch (err) {
      console.error('複製失敗:', err)
    }
  }

  return (
    <div className="container">
      <h1>Walrus 存儲測試</h1>

      {/* 钱包状态 */}
      <div className="section">
        <h2>錢包狀態</h2>
        {isConnected && currentAccount ? (
          <div>
            <p>✅ 已連接</p>
            <p>錢包: {currentWallet?.name || 'Unknown'}</p>
            <p>地址: {currentAccount.address}</p>
          </div>
        ) : (
          <div>
            <p>❌ 未連接</p>
            <ConnectButton />
          </div>
        )}
      </div>

      {/* 上传文本 */}
      <div className="section">
        <h2>上傳文本到 Walrus</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="uploadText">
            <strong>文本內容：</strong>
          </label>
          <textarea
            id="uploadText"
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}
            placeholder="輸入要上傳的文本..."
          />
        </div>

        <button
          onClick={handleUploadText}
          disabled={uploadLoading || !isConnected || !uploadText.trim()}
          className="btn btn-primary"
        >
          {uploadLoading ? '上傳中...' : '上傳文本'}
        </button>

        {uploadResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px' }}>
            <p><strong>✅ 上傳成功</strong></p>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <p style={{ wordBreak: 'break-all' }}>
                <strong>Blob ID:</strong> {uploadResult.blobId}
                <button
                  onClick={() => copyToClipboard(uploadResult.blobId)}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  📋 複製
                </button>
              </p>
              <p style={{ wordBreak: 'break-all' }}>
                <strong>Blob Object:</strong> {uploadResult.blobObject}
              </p>
              <p>
                <strong>大小:</strong> {uploadResult.size} bytes ({(uploadResult.size / 1024).toFixed(2)} KB)
              </p>
              <p>
                <a
                  href={`https://walrus.scan.space/blobs/${uploadResult.blobId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4caf50' }}
                >
                  🔗 在 Walrus Scan 上查看
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 上传文件 */}
      <div className="section">
        <h2>上傳文件到 Walrus</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="uploadFile">
            <strong>選擇文件：</strong>
          </label>
          <input
            type="file"
            id="uploadFile"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
            }}
          />
          {uploadFile && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
              已選擇: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <button
          onClick={handleUploadFile}
          disabled={uploadLoading || !isConnected || !uploadFile}
          className="btn btn-primary"
        >
          {uploadLoading ? '上傳中...' : '上傳文件'}
        </button>
      </div>

      {/* 状态显示 */}
      {uploadStatus && (
        <div className="status-box" style={{ marginTop: '1rem' }}>
          {uploadStatus}
        </div>
      )}

      {uploadError && (
        <div className="error-box" style={{ marginTop: '1rem' }}>
          ❌ 錯誤: {uploadError}
        </div>
      )}

      {/* 读取 Blob */}
      <div className="section">
        <h2>從 Walrus 讀取數據</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="readBlobId">
            <strong>Blob ID：</strong>
          </label>
          <input
            type="text"
            id="readBlobId"
            value={readBlobId}
            onChange={(e) => setReadBlobId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.5rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}
            placeholder="輸入 Blob ID..."
          />
          {uploadResult && (
            <button
              onClick={() => setReadBlobId(uploadResult.blobId)}
              style={{
                marginTop: '0.5rem',
                padding: '0.3rem 0.6rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              使用上次上傳的 Blob ID
            </button>
          )}
        </div>

        <button
          onClick={handleReadBlob}
          disabled={readLoading || !readBlobId.trim()}
          className="btn btn-primary"
        >
          {readLoading ? '讀取中...' : '讀取數據'}
        </button>

        {readStatus && (
          <div className="status-box" style={{ marginTop: '1rem' }}>
            {readStatus}
          </div>
        )}

        {readError && (
          <div className="error-box" style={{ marginTop: '1rem' }}>
            ❌ 錯誤: {readError}
          </div>
        )}

        {readResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
            <p><strong>✅ 讀取成功</strong></p>
            <p>
              <strong>大小:</strong> {readResult.size} bytes ({(readResult.size / 1024).toFixed(2)} KB)
            </p>
            
            {readResult.text && (
              <div style={{ marginTop: '1rem' }}>
                <p><strong>文本內容：</strong></p>
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: '#fff',
                    borderRadius: '4px',
                    maxHeight: '300px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  {readResult.text}
                </div>
              </div>
            )}

            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>查看 Hex 數據</summary>
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#fff',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              >
                {toHex(readResult.data!)}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="info-section" style={{ marginTop: '2rem' }}>
        <h3>使用說明</h3>
        <ol>
          <li>確保錢包中有測試網 WAL 代幣</li>
          <li>輸入文本或選擇文件</li>
          <li>點擊上傳按鈕</li>
          <li>在錢包中簽名交易</li>
          <li>上傳成功後會顯示 Blob ID</li>
          <li>可以使用 Blob ID 讀取數據</li>
        </ol>
        <p className="note">
          <strong>注意：</strong>
          <ul>
            <li>需要 WAL 代幣支付存儲費用</li>
            <li>可在 <a href="https://faucet.walrus.space/" target="_blank" rel="noopener noreferrer">Walrus Faucet</a> 獲取測試 WAL</li>
            <li>epochs=1 表示數據將存儲 1 個紀元</li>
            <li>deletable=true 表示數據可以被刪除</li>
          </ul>
        </p>
      </div>
    </div>
  )
}

