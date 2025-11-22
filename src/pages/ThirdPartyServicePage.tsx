import { useState, useEffect, useMemo } from 'react'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { contractService } from '../services/contractService'
import Header from '../components/Header'
import './css/PageLayout.css'
import './css/ThirdPartyServicePage.css'

export default function ThirdPartyServicePage() {
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const isConnected = Boolean(currentAccount)

  const suiClient = useMemo(() => {
    return new SuiClient({
      url: getFullnodeUrl('testnet'),
      network: 'testnet',
    })
  }, [])
  
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

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

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
      <Header
        title="Service Provider Registration"
        backTo="/"
        backLabel="Back"
        rightLink={{
          to: '/bowheadwhale/user',
          label: 'User Registration',
        }}
      />

      <div className="page-content">
        {!isConnected ? (
          <>
            <div className="info-box">
              <h3>Registration Guide</h3>
              <ul>
                <li><strong>Client ID</strong>: Your unique service identifier</li>
                <li><strong>Redirect URL</strong>: OAuth authorization redirect address</li>
                <li>After successful registration, you will receive a <code>ServiceCap</code> for managing your service</li>
              </ul>
            </div>
            <div className="wallet-section">
              <p>Please connect your wallet to register a service</p>
              <p style={{ fontSize: '0.875rem', color: '#86868b', marginTop: '0.5rem' }}>
                Use the connect button in the header to connect your wallet.
              </p>
            </div>
          </>
        ) : loadingService ? (
          <div className="info-box">
            <p>Loading registered service...</p>
          </div>
        ) : registeredService ? (
          <>
            <div className="success-box">
              <h3>Registered Service</h3>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                      <strong>Service ID:</strong>
                    </p>
                    <code style={{
                      display: 'block',
                      padding: '0.75rem',
                      background: '#ffffff',
                      border: '1px solid #d2d2d7',
                      borderRadius: '8px',
                      wordBreak: 'break-all',
                      fontSize: '0.8125rem',
                    }}>
                      {registeredService.objectId}
                    </code>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                      <strong>Client ID:</strong>
                    </p>
                    <p style={{ fontSize: '0.9375rem' }}>{registeredService.clientId}</p>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                      <strong>Redirect URL:</strong>
                    </p>
                    <p style={{ fontSize: '0.9375rem', wordBreak: 'break-all' }}>{registeredService.redirectUrl}</p>
                  </div>
                  
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #bbf7d0' }}>
                    <p style={{ marginBottom: '0.75rem', fontSize: '0.9375rem', fontWeight: 500 }}>
                      OAuth Authorization Link:
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.5rem', 
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      <code style={{ 
                        flex: 1,
                        minWidth: '200px',
                        padding: '0.75rem',
                        background: '#ffffff',
                        border: '1px solid #d2d2d7',
                        borderRadius: '8px',
                        wordBreak: 'break-all',
                        fontSize: '0.8125rem',
                      }}>
                        {window.location.origin}/bowheadwhale/doauth_page?service={registeredService.serviceId}
                      </code>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const link = `${window.location.origin}/bowheadwhale/doauth_page?service=${registeredService.serviceId}`
                          navigator.clipboard.writeText(link)
                          alert('Authorization link copied to clipboard!')
                        }}
                        style={{ flexShrink: 0 }}
                      >
                        Copy Link
                      </button>
                    </div>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#6e6e73' }}>
                      Share this link with users to authorize access to your service.
                    </p>
                  </div>
                </div>
              </div>
            </>
        ) : (
          <>
            <div className="info-box">
              <h3>Registration Guide</h3>
              <ul>
                <li><strong>Client ID</strong>: Your unique service identifier</li>
                <li><strong>Redirect URL</strong>: OAuth authorization redirect address</li>
                <li>After successful registration, you will receive a <code>ServiceCap</code> for managing your service</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="service-form">
              <div className="form-group">
                <label htmlFor="clientId">
                  <strong>Client ID *</strong>
                  <span className="form-hint">(Service Name or ID)</span>
                </label>
                <input
                  type="text"
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g., my-service-123"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="redirectUrl">
                  <strong>Redirect URL *</strong>
                  <span className="form-hint">(OAuth authorization redirect address)</span>
                </label>
                <input
                  type="url"
                  id="redirectUrl"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://example.com/oauth/callback"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !clientId.trim() || !redirectUrl.trim()}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
              >
                {loading ? 'Registering...' : 'Register Service'}
              </button>
            </form>
          </>
        )}

        {status && (
          <div className="status-box" style={{ marginTop: '2rem' }}>
            {status}
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginTop: '2rem' }}>
            {error}
          </div>
        )}

      </div>
    </div>
  )
}

