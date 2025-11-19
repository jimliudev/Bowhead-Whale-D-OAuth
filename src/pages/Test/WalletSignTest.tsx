import { useState, useMemo, useEffect } from 'react'
import {
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useWallets,
  useCurrentWallet,
  ConnectButton,
} from '@mysten/dapp-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { walrus } from '@mysten/walrus'
import '../../App.css'

export default function WalletSignTest() {
  const currentAccount = useCurrentAccount()
  const wallets = useWallets()
  const { currentWallet } = useCurrentWallet()
  
  // 調試：記錄錢包狀態
  useEffect(() => {
    console.log('可用錢包數量:', wallets.length)
    wallets.forEach((wallet, index) => {
      console.log(`錢包 ${index + 1}:`, {
        name: wallet.name,
        icon: wallet.icon,
        version: wallet.version,
        chains: wallet.chains,
        features: Object.keys(wallet.features),
      })
    })
  }, [wallets])
  
  // 創建帶有 walrus 擴展的 client
  // 由於類型兼容性問題，我們直接創建一個新的 client 而不是擴展現有的
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
  const { mutate: connect, isPending: isConnecting, error: connectError } = useConnectWallet({
    onSuccess: () => {
      console.log('錢包連接成功')
      setError(null)
    },
    onError: (error) => {
      console.error('錢包連接失敗:', error)
      setError(`連接失敗: ${error.message || '未知錯誤'}`)
    },
  })
  const { mutate: disconnect } = useDisconnectWallet()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) => {
      return await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      })
    },
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  // 合約調用相關狀態
  const [contractLoading, setContractLoading] = useState(false)
  const [contractError, setContractError] = useState<string | null>(null)
  const [contractStatus, setContractStatus] = useState<string>('')
  const [contractResult, setContractResult] = useState<any>(null)
  const [packageId, setPackageId] = useState<string>('')
  const [moduleName, setModuleName] = useState<string>('')
  const [functionName, setFunctionName] = useState<string>('')
  const [functionArgs, setFunctionArgs] = useState<string>('')

  const isConnected = Boolean(currentAccount)

  const handleTestSign = async () => {
    if (!isConnected || !currentAccount) {
      setError('請先連接錢包')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('測試中...')

    try {
      // 測試數據
      const fileData = new TextEncoder().encode('Hello, Walrus Test!')
      
      setStatus('正在檢查錢包狀態...')
      console.log('當前賬戶:', currentAccount.address)
      
      // 檢查 WAL 代幣餘額
      try {
        const walCoinType = '0x8190b041122eb492bf63cb464476bd68c6b7e570a4079645a8b28732b6197a82::wal::WAL'
        const walCoins = await client.getCoins({
          owner: currentAccount.address,
          coinType: walCoinType,
        })
        
        console.log('WAL 代幣對象:', walCoins)
        
        if (!walCoins.data || walCoins.data.length === 0) {
          throw new Error('未找到 WAL 代幣！請確保錢包中有測試網 WAL 代幣。')
        }
        
        const totalWal = walCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0))
        console.log('WAL 餘額:', totalWal.toString())
        
        setStatus(`WAL 餘額: ${(Number(totalWal) / 1e9).toFixed(4)} WAL\n正在準備上傳...`)
      } catch (balanceErr: any) {
        console.error('檢查餘額時出錯:', balanceErr)
        setStatus('警告: 無法檢查 WAL 餘額，繼續嘗試上傳...')
      }

      // 創建錢包 Signer 適配器（用於 writeBlob）
      // dapp-kit 的 useSignAndExecuteTransaction 可以直接處理 Transaction 對象
      const walletSigner = {
        getAddress: async () => {
          console.log('getAddress 被調用')
          return currentAccount.address
        },
        toSuiAddress: () => {
          console.log('toSuiAddress 被調用')
          return currentAccount.address
        },
        signTransaction: async (_bytes: Uint8Array) => {
          console.log('signTransaction 被調用 (不支持)')
          throw new Error('signTransaction not supported in wallet adapter')
        },
        signTransactionBlock: async (_tx: any) => {
          console.log('signTransactionBlock 被調用 (不支持)')
          throw new Error('signTransactionBlock not supported, use signAndExecuteTransaction instead')
        },
        signAndExecuteTransaction: async ({ transaction }: any) => {
          console.log('signAndExecuteTransaction 被調用')
          
          // dapp-kit 的 useSignAndExecuteTransaction 可以直接處理 Transaction 對象
          // 不需要手動構建字節碼
          const result = await signAndExecuteTransaction({
            transaction,
          })
          
          console.log('交易執行結果:', result)
          return result
        },
      } as any

      setStatus('正在上傳到 Walrus...')

      // 使用 writeBlob 上傳數據
      console.log('開始調用 writeBlob...')
      const { blobId, blobObject } = await (client as any).walrus.writeBlob({
        blob: fileData,
        deletable: true,
        epochs: 1, // 測試時使用 1 個紀元以降低費用
        signer: walletSigner,
      })

      console.log('Blob ID:', blobId)
      console.log('Blob Object:', blobObject)

      setStatus(`✅ 測試完成！\nBlob ID: ${blobId}\n可在 https://walrus.scan.space/blobs 查看`)
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '測試失敗'
      setError(errorMsg)
      setStatus('❌ 測試失敗')
      console.error('測試錯誤:', err)
      console.error('錯誤堆棧:', err?.stack)
    } finally {
      setLoading(false)
    }
  }

  // 處理合約調用測試
  const handleContractCall = async () => {
    if (!isConnected || !currentAccount) {
      setContractError('請先連接錢包')
      return
    }

    setContractLoading(true)
    setContractError(null)
    setContractStatus('準備交易...')
    setContractResult(null)

    try {
      // 創建交易
      const tx = new Transaction()
      
      // 如果提供了合約信息，使用用戶輸入的合約
      if (packageId && moduleName && functionName) {
        setContractStatus('構建合約調用交易...')
        
        // 解析參數（支持 JSON 數組格式）
        let parsedArgs: any[] = []
        if (functionArgs.trim()) {
          try {
            parsedArgs = JSON.parse(functionArgs)
          } catch {
            // 如果不是 JSON，嘗試按逗號分割
            parsedArgs = functionArgs.split(',').map(arg => arg.trim()).filter(arg => arg)
          }
        }

        // 構建參數（簡單處理，實際使用時需要根據合約函數簽名正確構建）
        const txArgs: any[] = []
        for (const arg of parsedArgs) {
          // 嘗試判斷參數類型
          if (arg.startsWith('0x') && arg.length === 66) {
            // 可能是對象 ID
            txArgs.push(tx.object(arg))
          } else if (arg.startsWith('"') && arg.endsWith('"')) {
            // 字符串
            txArgs.push(tx.pure.string(arg.slice(1, -1)))
          } else if (!isNaN(Number(arg))) {
            // 數字
            txArgs.push(tx.pure.u64(BigInt(arg)))
          } else {
            // 默認作為字符串處理
            txArgs.push(tx.pure.string(arg))
          }
        }

        tx.moveCall({
          target: `${packageId}::${moduleName}::${functionName}`,
          arguments: txArgs,
        })
      } else {
        // 使用默認示例：調用 Clock 對象獲取當前時間戳
        setContractStatus('構建 Clock 調用交易（示例）...')
        tx.moveCall({
          target: '0x2::clock::timestamp_ms',
          arguments: [tx.object('0x6')], // Clock 對象 ID
        })
      }

      setContractStatus('正在簽名並執行交易...')
      console.log('交易內容:', tx)

      // 簽名並執行交易
      // 使用類型斷言解決版本不兼容問題
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('合約調用結果:', result)
      setContractResult(result)
      setContractStatus(`✅ 交易執行成功！\n交易摘要: ${result.digest}\n可在 https://suiexplorer.com/txblock/${result.digest}?network=testnet 查看`)

      // 如果有返回數據，嘗試解析
      if (result.events && result.events.length > 0) {
        console.log('交易事件:', result.events)
      }
      if (result.objectChanges && result.objectChanges.length > 0) {
        console.log('對象變化:', result.objectChanges)
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || '合約調用失敗'
      setContractError(errorMsg)
      setContractStatus('❌ 合約調用失敗')
      console.error('合約調用錯誤:', err)
      console.error('錯誤堆棧:', err?.stack)
    } finally {
      setContractLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>錢包簽章測試</h1>

      {/* 錢包連接狀態 */}
      <div className="section">
        <h2>錢包狀態</h2>
        {isConnected && currentAccount ? (
          <div>
            <p>✅ 已連接</p>
            <p>錢包: {currentWallet?.name || 'Unknown'}</p>
            <p>地址: {currentAccount.address}</p>
            <button onClick={() => disconnect()} className="btn btn-secondary">
              斷開連接
            </button>
          </div>
        ) : (
          <div>
            <p>❌ 未連接</p>
            <ConnectButton />
            {wallets.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  可用錢包: {wallets.map(w => w.name).join(', ')}
                </p>
                {wallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => {
                      console.log('嘗試連接錢包:', wallet.name, wallet)
                      setError(null)
                      connect({ wallet })
                    }}
                    className="btn btn-primary"
                    style={{ marginRight: '0.5rem', marginBottom: '0.5rem' }}
                    disabled={isConnecting}
                  >
                    {isConnecting ? '連接中...' : `連接 ${wallet.name}`}
                  </button>
                ))}
                {connectError && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
                    ❌ {connectError.message || '連接失敗'}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  ⚠️ 未檢測到 Sui 錢包
                </p>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  請安裝以下錢包之一：
                </p>
                <ul style={{ fontSize: '0.85rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li>
                    <a 
                      href="https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1' }}
                    >
                      Sui Wallet (Chrome 擴展)
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://suiwallet.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1' }}
                    >
                      Sui Wallet (網頁版)
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 測試按鈕 */}
      <div className="section">
        <h2>簽章測試</h2>
        <button
          onClick={handleTestSign}
          disabled={loading || !isConnected}
          className="btn btn-primary"
        >
          {loading ? '處理中...' : '測試簽章'}
        </button>

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
      </div>

      {/* 合約調用測試 */}
      <div className="section">
        <h2>合約調用測試</h2>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
          測試調用 Move 合約函數並簽名執行交易
        </p>

        {/* 合約信息輸入 */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Package ID (可選，留空使用 Clock 示例):
          </label>
          <input
            type="text"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            placeholder="例如: 0x2"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.9rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'monospace',
              marginBottom: '0.5rem',
            }}
          />
        </div>

        {packageId && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Module 名稱:
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="例如: clock"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  marginBottom: '0.5rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Function 名稱:
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="例如: timestamp_ms"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  marginBottom: '0.5rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                參數 (JSON 數組或逗號分隔):
              </label>
              <textarea
                value={functionArgs}
                onChange={(e) => setFunctionArgs(e.target.value)}
                placeholder='例如: ["0x6"] 或 0x6, "hello", 123'
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </>
        )}

        <button
          onClick={handleContractCall}
          disabled={contractLoading || !isConnected}
          className="btn btn-primary"
        >
          {contractLoading ? '處理中...' : packageId ? '調用合約' : '測試 Clock 調用（示例）'}
        </button>

        {contractStatus && (
          <div className="status-box" style={{ marginTop: '1rem' }}>
            {contractStatus}
          </div>
        )}

        {contractError && (
          <div className="error-box" style={{ marginTop: '1rem' }}>
            ❌ 錯誤: {contractError}
          </div>
        )}

        {contractResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>交易結果:</h3>
            <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', overflow: 'auto' }}>
              <p><strong>摘要:</strong> {contractResult.digest}</p>
              {contractResult.events && contractResult.events.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>事件數量:</strong> {contractResult.events.length}
                </div>
              )}
              {contractResult.objectChanges && contractResult.objectChanges.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>對象變化數量:</strong> {contractResult.objectChanges.length}
                </div>
              )}
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', color: '#6366f1' }}>查看完整結果</summary>
                <pre style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px', overflow: 'auto', maxHeight: '300px' }}>
                  {JSON.stringify(contractResult, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* 示例說明 */}
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
          <strong>💡 使用說明:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>留空所有字段將調用 Clock 示例（獲取當前時間戳）</li>
            <li>Package ID: 合約的 Package ID（例如: 0x2）</li>
            <li>Module: Move 模組名稱</li>
            <li>Function: 函數名稱</li>
            <li>參數: JSON 數組格式或逗號分隔的值</li>
            <li>對象 ID 參數應以 0x 開頭</li>
            <li>字符串參數應使用引號包裹</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

