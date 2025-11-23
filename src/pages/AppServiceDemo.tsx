import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'
import './css/PageLayout.css'
import './css/DOAuthPage.css'

interface UserDataItem {
  itemId: string
  vaultId: string
  name: string
  decryptedData: string
  size: number
}

export default function AppServiceDemo() {
  const [redirectUrl, setRedirectUrl] = useState<string>('')
  const [accessToken, setAccessToken] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [userDataItems, setUserDataItems] = useState<UserDataItem[]>([])
  
  const OAUTH_SERVICE_URL = 'http://localhost:5173/bowheadwhale/doauth_page?service=0xf904b1650a0b215ece94b5b86facb9b3b58fe5ced6dc83304e8fd46092340d2e'

  useEffect(() => {
    document.body.classList.add('page-container-active')
    return () => {
      document.body.classList.remove('page-container-active')
    }
  }, [])

  // Listen for OAuth success messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === 'OAUTH_SUCCESS') {
        console.log('OAuth authorization successful', event.data)
        
        // Extract access_token from redirect URL or message
        if (event.data.accessToken) {
          setAccessToken(event.data.accessToken)
          setStatus('✅ Authorization successful! Access token received.')
        } else if (event.data.redirectUrl) {
          // Try to extract access_token from redirect URL
          try {
            const url = new URL(event.data.redirectUrl)
            const token = url.searchParams.get('access_token')
            if (token) {
              setAccessToken(token)
              setStatus('✅ Authorization successful! Access token received.')
            }
          } catch (err) {
            console.error('Failed to parse redirect URL:', err)
          }
        }
      } else if (event.data.type === 'OAUTH_CANCELLED') {
        console.log('OAuth authorization cancelled')
        setStatus('❌ Authorization cancelled')
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const handleDemoLogin = () => {
    setError(null)
    setStatus('Redirecting to authorization page...')

    // Direct redirect to OAuth page
    window.location.href = OAUTH_SERVICE_URL
  }

  const handleGetUserData = async () => {
    if (!accessToken.trim()) {
      setError('Please enter an access token')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Fetching user data...')

    try {
      // First, we need to get the user's OAuthGrant to find authorized items
      // For demo purposes, we'll need to get the grant and then fetch each item
      // This is a simplified version - in production, you'd have a better way to get the list
      
      setStatus('Getting authorized resources...')
      
      // Note: In a real scenario, you would:
      // 1. Decode the access_token (SessionKey) to get the user address
      // 2. Query the chain for OAuthGrant objects for that user
      // 3. Get the list of authorized itemIds
      // 4. For each itemId, call the API to decrypt the data
      
      // For now, we'll show a message that this requires additional implementation
      setError('This feature requires additional implementation to fetch authorized resources from the chain. Please provide itemId and vaultId manually for testing.')
      setStatus('')
      
      // TODO: Implement full flow to:
      // 1. Parse SessionKey from access_token
      // 2. Get user address from SessionKey
      // 3. Query OAuthGrant objects
      // 4. Get authorized itemIds
      // 5. Fetch and decrypt each item
      
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to get user data'
      setError(`Failed to get user data: ${errorMsg}`)
      setStatus('❌ Failed to get user data')
      console.error('Get user data error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGetSingleItem = async () => {
    if (!accessToken.trim()) {
      setError('Please enter an access token')
      return
    }

    // Prompt for itemId and vaultId
    const itemId = prompt('Enter Item ID:')
    const vaultId = prompt('Enter Vault ID:')
    
    if (!itemId || !vaultId) {
      setError('Item ID and Vault ID are required')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Fetching and decrypting data...')

    try {
      const apiBaseUrl = API_BASE_URL || ''
      const response = await fetch(`${apiBaseUrl}/api/bowheadwhale/get-user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          vaultId,
          itemId,
          checkType: 1, // 1 = third-party access
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to get user data: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get user data')
      }

      // Decode base64 decrypted data
      const decryptedBase64 = result.data.decryptedData
      const decryptedBytes = Uint8Array.from(atob(decryptedBase64), c => c.charCodeAt(0))
      
      // Try to decode as text
      let decryptedText = ''
      try {
        decryptedText = new TextDecoder().decode(decryptedBytes)
      } catch (err) {
        decryptedText = `Binary data (${decryptedBytes.length} bytes)`
      }

      // Add to user data items
      const newItem: UserDataItem = {
        itemId: result.data.itemId,
        vaultId: result.data.vaultId,
        name: `Item ${result.data.itemId.slice(0, 8)}...`,
        decryptedData: decryptedText,
        size: result.data.size,
      }

      setUserDataItems(prev => [...prev, newItem])
      setStatus('✅ Data fetched and decrypted successfully!')
      
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to get user data'
      setError(`Failed to get user data: ${errorMsg}`)
      setStatus('❌ Failed to get user data')
      console.error('Get user data error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="oauth-page">
      <div className="oauth-container">
        <div className="oauth-card">
          {/* Header */}
          <div className="oauth-header">
            <div className="oauth-header-top">
              <div className="oauth-logo">🐋</div>
              <div className="oauth-header-text">
                <h1 className="oauth-title">App Service Demo</h1>
                <p className="oauth-subtitle">
                  Simulate an App Service that requests user authorization and accesses user data
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="oauth-content">
            {/* Redirect URL Section */}
            <div className="oauth-resources" style={{ marginBottom: '2rem' }}>
              <h3 className="resources-title">Service Configuration</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Redirect URL
                </label>
                <input
                  type="text"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://your-app.com/callback"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dadce0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#5f6368', marginTop: '0.5rem' }}>
                  This URL will receive the access_token after user authorization
                </p>
              </div>
              <button
                className="oauth-button oauth-button-primary"
                onClick={handleDemoLogin}
                disabled={loading}
                style={{ width: '100%' }}
              >
                Demo Login
              </button>
            </div>

            {/* Access Token Section */}
            <div className="oauth-resources" style={{ marginBottom: '2rem' }}>
              <h3 className="resources-title">Access User Data</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Access Token
                </label>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste access_token here (base64 encoded SessionKey)"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dadce0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#5f6368', marginTop: '0.5rem' }}>
                  This simulates an App Service using the access_token to get user data via POST request to /api/bowheadwhale/get-user-data
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="oauth-button oauth-button-primary"
                  onClick={handleGetSingleItem}
                  disabled={loading || !accessToken.trim()}
                  style={{ flex: 1 }}
                >
                  Get Single Item (Manual)
                </button>
                <button
                  className="oauth-button oauth-button-secondary"
                  onClick={handleGetUserData}
                  disabled={loading || !accessToken.trim()}
                  style={{ flex: 1 }}
                >
                  Get All Authorized Data
                </button>
              </div>
            </div>

            {/* User Data Display */}
            {userDataItems.length > 0 && (
              <div className="oauth-resources">
                <h3 className="resources-title">Decrypted User Data ({userDataItems.length})</h3>
                <div className="resources-list">
                  {userDataItems.map((item, index) => (
                    <div key={index} className="resource-item-container">
                      <div className="resource-info">
                        <div className="resource-main">
                          <span className="resource-label">{item.name}</span>
                        </div>
                        <div className="resource-details">
                          <span className="resource-detail-item">
                            <strong>Item ID:</strong> {item.itemId.slice(0, 12)}...{item.itemId.slice(-8)}
                          </span>
                          <span className="resource-detail-item">
                            <strong>Vault ID:</strong> {item.vaultId.slice(0, 12)}...{item.vaultId.slice(-8)}
                          </span>
                          <span className="resource-detail-item">
                            <strong>Size:</strong> {item.size} bytes
                          </span>
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Decrypted Data:</strong>
                          <pre style={{ 
                            margin: 0, 
                            fontSize: '0.875rem', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            maxHeight: '200px',
                            overflow: 'auto'
                          }}>
                            {item.decryptedData}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="oauth-button oauth-button-secondary"
                  onClick={() => setUserDataItems([])}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Clear Data
                </button>
              </div>
            )}
          </div>

          {/* Status and error messages */}
          {status && (
            <div className="oauth-status">
              {status}
            </div>
          )}

          {error && (
            <div className="oauth-error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

