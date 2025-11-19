import { useState, useEffect } from 'react'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit'
import { contractService } from '../services/contractService'
import Header from '../components/Header'
import './css/PageLayout.css'
import './css/ThirdPartyServicePage.css'

export default function ThirdPartyServicePage() {
  useEffect(() => {
    // Add class to body to override default styles
    document.body.classList.add('page-container-active')
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove('page-container-active')
    }
  }, [])
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const isConnected = Boolean(currentAccount)
  
  // 表单状态
  const [clientId, setClientId] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const [resourceTypes, setResourceTypes] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [serviceId, setServiceId] = useState<string | null>(null)

  // Resource type options
  const resourceTypeOptions = [
    { value: 0, label: 'View' },
    { value: 1, label: 'Edit' },
    { value: 2, label: 'Delete' },
  ]

  const handleResourceTypeChange = (value: number, checked: boolean) => {
    if (checked) {
      setResourceTypes([...resourceTypes, value])
    } else {
      setResourceTypes(resourceTypes.filter(t => t !== value))
    }
  }

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

    if (resourceTypes.length === 0) {
      setError('Please select at least one resource type')
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
        resourceTypes,
      })

      setStatus('Signing and executing transaction...')
      console.log('Transaction parameters:', {
        clientId: clientId.trim(),
        redirectUrl: redirectUrl.trim(),
        resourceTypes,
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
      } else {
        setStatus(`✅ Service registered successfully!\nTransaction: ${result.digest}\nView on: https://suiexplorer.com/txblock/${result.digest}?network=testnet`)
        console.warn('Service ID not found in transaction result')
      }

      // Clear form
      setClientId('')
      setRedirectUrl('')
      setResourceTypes([])
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
        <div className="info-box">
          <h3>Registration Guide</h3>
          <ul>
            <li><strong>Client ID</strong>: Your unique service identifier</li>
            <li><strong>Redirect URL</strong>: OAuth authorization redirect address</li>
            <li><strong>Resource Types</strong>: Select the resource permission types your service can access</li>
            <li>After successful registration, you will receive a <code>ServiceCap</code> for managing your service</li>
          </ul>
        </div>

        {!isConnected ? (
          <div className="wallet-section">
            <p>Please connect your wallet to register a service</p>
            <p style={{ fontSize: '0.875rem', color: '#86868b', marginTop: '0.5rem' }}>
              Use the connect button in the header to connect your wallet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="service-form">
            <div className="form-group">
              <label htmlFor="clientId">
                <strong>Client ID *</strong>
                <span className="form-hint">(Unique service identifier)</span>
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

            <div className="form-group">
              <label>
                <strong>Resource Types *</strong>
                <span className="form-hint">(Select resource permissions for your service)</span>
              </label>
              <div className="checkbox-group">
                {resourceTypeOptions.map((option) => (
                  <label key={option.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={resourceTypes.includes(option.value)}
                      onChange={(e) => handleResourceTypeChange(option.value, e.target.checked)}
                      disabled={loading}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !clientId.trim() || !redirectUrl.trim() || resourceTypes.length === 0}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              {loading ? 'Registering...' : 'Register Service'}
            </button>
          </form>
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

        {serviceId && (
          <div className="success-box" style={{ marginTop: '2rem' }}>
            <h3>Registration Successful</h3>
            <p><strong>Service ID:</strong></p>
            <code>{serviceId}</code>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6e6e73' }}>
              Please save your Service ID securely. You will need it to manage your service and create OAuth authorizations.
            </p>
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
                  {window.location.origin}/bowheadwhale/doauth_page?service={serviceId}
                </code>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const link = `${window.location.origin}/bowheadwhale/doauth_page?service=${serviceId}`
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
        )}
      </div>
    </div>
  )
}

