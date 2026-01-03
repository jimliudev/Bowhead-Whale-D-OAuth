import { useState, useEffect } from 'react'
import { useTransactionExecution } from '../hooks/useTransactionExecution'
import { contractService } from '../services/contractService'
import Header from '../components/Header'
import './css/PageLayout.css'
import './css/ThirdPartyServicePage.css'

export default function ThirdPartyServicePage() {
  // OAuth callback 處理 - 偵測 URL hash 中的 id_token 並處理 popup 關閉
  useEffect(() => {
    const hash = window.location.hash;

    // 檢查是否是 OAuth callback（URL 包含 id_token）
    if (hash && hash.includes('id_token=')) {
      console.log('ThirdPartyServicePage: Detected OAuth callback with id_token');
      console.log('window.opener exists:', !!window.opener);

      // 如果是 popup 視窗，通知父視窗並關閉
      if (window.opener && !window.opener.closed) {
        try {
          console.log('ThirdPartyServicePage: This is a popup window, sending callback to opener');

          // 將 OAuth 結果傳給父視窗
          window.opener.postMessage(
            {
              type: 'enoki-oauth-callback',
              hash: hash,
              url: window.location.href,
            },
            window.location.origin
          );

          // 延遲關閉，確保訊息已傳遞
          setTimeout(() => {
            console.log('ThirdPartyServicePage: Closing popup window');
            window.close();
          }, 300);

          return; // 不繼續執行其他邏輯
        } catch (e) {
          console.error('Failed to communicate with opener:', e);
          // 即使通訊失敗也嘗試關閉
          setTimeout(() => window.close(), 300);
          return;
        }
      } else {
        // 不是 popup，這是正常的頁面導航
        console.log('ThirdPartyServicePage: Not a popup, cleaning up URL hash');

        // 清理 URL hash
        if (window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        // 繼續正常的頁面邏輯
      }
    }
  }, []);

  // 使用新的 transaction execution hook
  const {
    executeTransaction,
    isUsingZkLogin,
    currentAccount,
    suiClient,
  } = useTransactionExecution()

  const isConnected = Boolean(currentAccount)

  // 表单状态
  const [clientId, setClientId] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [serviceId, setServiceId] = useState<string | null>(null)

  // 已注册的服务信息
  const [registeredService, setRegisteredService] = useState<{
    objectId: string
    clientId: string
    redirectUrl: string
    createdAt: number
    serviceId: string
  } | null>(null)
  const [loadingService, setLoadingService] = useState(false)

  useEffect(() => {
    // Add class to body to override default styles
    document.body.classList.add('page-container-active')
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove('page-container-active')
    }
  }, [])

  const fetchRegisteredService = async () => {
    if (!isConnected || !currentAccount) {
      setRegisteredService(null)
      return
    }

    setLoadingService(true)
    try {
      const services = await contractService.getOAuthSerViceViaServiceCaps(
        suiClient,
        currentAccount.address
      )

      if (services.length > 0) {
        // 使用第一个服务（通常用户只有一个服务）
        const service = services[0]
        setRegisteredService({
          objectId: service.objectId,
          clientId: service.fields.client_id,
          redirectUrl: service.fields.redirect_url,
          createdAt: service.fields.created_at || 0,
          serviceId: currentAccount.address
        })
        setServiceId(service.objectId)
      } else {
        setRegisteredService(null)
      }
    } catch (err) {
      console.error('Error fetching registered service:', err)
      setRegisteredService(null)
    } finally {
      setLoadingService(false)
    }
  }


  // 检查用户是否已注册服务
  useEffect(() => {
    fetchRegisteredService()
  }, [isConnected, currentAccount, suiClient])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    if (!clientId.trim()) {
      setError('Please enter Client ID')
      return
    }

    if (!redirectUrl.trim()) {
      setError('Please enter Redirect URL')
      return
    }

    // Validate URL format
    try {
      new URL(redirectUrl)
    } catch {
      setError('Invalid Redirect URL format')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Preparing to register service...')

    try {
      // Use contractService to build the transaction
      const tx = contractService.buildRegisterOAuthServiceTx({
        clientId: clientId.trim(),
        redirectUrl: redirectUrl.trim(),
      })

      setStatus('Signing and executing transaction...')
      console.log('Transaction parameters:', {
        clientId: clientId.trim(),
        redirectUrl: redirectUrl.trim(),
      })

      // 使用條件式交易執行（自動判斷 zkLogin）
      const result = await executeTransaction(tx)

      console.log('Service registration result:', result)

      // Extract Service ID using contractService
      const resultAny = result as any
      const { created } = contractService.extractObjectIds(resultAny, 'OAuthService')

      if (created.length > 0) {
        const serviceIdValue = created[0]
        setServiceId(serviceIdValue)
        setStatus(`✅ Service registered successfully!\nService ID: ${serviceIdValue}\nTransaction: ${result.digest}\nView on: https://suiexplorer.com/txblock/${result.digest}?network=testnet`)

        // 更新已注册服务信息
        setRegisteredService({
          objectId: serviceIdValue,
          clientId: clientId.trim(),
          redirectUrl: redirectUrl.trim(),
          createdAt: Date.now(),
          serviceId: currentAccount.address
        })
      } else {
        setStatus(`✅ Service registered successfully!\nTransaction: ${result.digest}\nView on: https://suiexplorer.com/txblock/${result.digest}?network=testnet`)
        console.warn('Service ID not found in transaction result')
      }

      // Clear form
      setClientId('')
      setRedirectUrl('')
      fetchRegisteredService()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Registration failed'
      setError(`Registration failed: ${errorMsg}`)
      setStatus('❌ Registration failed')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <Header />

      <div className="oauth-page-content">
        {!isConnected ? (
          <div className="oauth-card">
            <div className="oauth-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="oauth-title">區塊鏈去中心化 OAuth 服務</h2>
            <p className="oauth-subtitle">Decentralized OAuth Service on Blockchain</p>
            <p className="oauth-description">
              註冊您的應用程式為 OAuth 服務提供者，讓用戶可以安全地授權您存取他們儲存在區塊鏈上的資料
            </p>
            <div className="oauth-info-list">
              <div className="oauth-info-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10" stroke="#34a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="#34a853" strokeWidth="2" />
                </svg>
                <span>去中心化 OAuth 服務註冊</span>
              </div>
              <div className="oauth-info-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10" stroke="#34a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="#34a853" strokeWidth="2" />
                </svg>
                <span>取得用戶授權存取區塊鏈資料</span>
              </div>
              <div className="oauth-info-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10" stroke="#34a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="#34a853" strokeWidth="2" />
                </svg>
                <span>生成授權連結供用戶使用</span>
              </div>
            </div>
          </div>
        ) : loadingService ? (
          <div className="oauth-card">
            <div className="oauth-loading">
              <div className="spinner"></div>
              <p>Loading your services...</p>
            </div>
          </div>
        ) : registeredService ? (
          <div className="oauth-card">
            <div className="oauth-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#34a853" strokeWidth="2" />
                <path d="M9 12L11 14L15 10" stroke="#34a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="oauth-title">服務註冊成功</h2>
            <p className="oauth-subtitle">Service Successfully Registered</p>
            <p className="oauth-description">
              您的 OAuth 服務已成功註冊在區塊鏈上，現在可以開始接受用戶授權
            </p>

            <div className="oauth-details">
              <div className="oauth-detail-item">
                <label>Service ID</label>
                <div className="oauth-code-box">
                  {registeredService.objectId}
                </div>
              </div>

              <div className="oauth-detail-item">
                <label>Client ID</label>
                <div className="oauth-value">
                  {registeredService.clientId}
                </div>
              </div>

              <div className="oauth-detail-item">
                <label>Redirect URL</label>
                <div className="oauth-value oauth-url">
                  {registeredService.redirectUrl}
                </div>
              </div>

              <div className="oauth-detail-item oauth-highlight">
                <label>OAuth Authorization Link</label>
                <div className="oauth-link-container">
                  <div className="oauth-code-box oauth-link-box">
                    {window.location.origin}/bowheadwhale/redirect_doauth_page?service={registeredService.serviceId}
                  </div>
                  <button
                    className="oauth-copy-btn"
                    onClick={() => {
                      const link = `${window.location.origin}/bowheadwhale/redirect_doauth_page?service=${registeredService.serviceId}`
                      navigator.clipboard.writeText(link)
                      alert('Link copied to clipboard!')
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Copy
                  </button>
                </div>
                <p className="oauth-hint">
                  Share this link with users to authorize access to your service
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="oauth-card">
            <div className="oauth-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="oauth-title">註冊您的服務</h2>
            <p className="oauth-subtitle">Register Your OAuth Service</p>
            <p className="oauth-description">
              設定您的應用程式為 OAuth 服務提供者，取得用戶授權存取區塊鏈資料
            </p>

            <form onSubmit={handleSubmit} className="oauth-form">
              <div className="oauth-form-group">
                <label htmlFor="clientId">
                  Client ID
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="my-app-client-id"
                  required
                  disabled={loading}
                  className="oauth-input"
                />
                <p className="oauth-field-hint">
                  A unique identifier for your application
                </p>
              </div>

              <div className="oauth-form-group">
                <label htmlFor="redirectUrl">
                  Redirect URL
                  <span className="required">*</span>
                </label>
                <input
                  type="url"
                  id="redirectUrl"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://your-app.com/oauth/callback"
                  required
                  disabled={loading}
                  className="oauth-input"
                />
                <p className="oauth-field-hint">
                  Where users will be redirected after authorization
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !clientId.trim() || !redirectUrl.trim()}
                className="oauth-submit-btn"
              >
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    Registering...
                  </>
                ) : (
                  'Register Service'
                )}
              </button>
            </form>
          </div>
        )}

        {status && (
          <div className={`oauth-status ${status.includes('✅') ? 'success' : 'info'}`}>
            {status}
          </div>
        )}

        {error && (
          <div className="oauth-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
