import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useDisconnectWallet,
  ConnectButton,
} from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { SEAL_PACKAGE_ID } from '../config'
import { contractService } from '../services/contractService'
import './css/PageLayout.css'
import './css/DOAuthPageNewWindow.css'

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
})

export default function DOAuthPage() {
  const [searchParams] = useSearchParams()
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const { mutate: disconnect } = useDisconnectWallet()
  
  const serviceAddress = searchParams.get('service')
  const isConnected = Boolean(currentAccount)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    // Resize and position window to top-right corner (like Chrome extension popup)
    const resizeWindow = () => {
      try {
        // Check if this is a popup window
        const isPopup = window.opener !== null || window.name === 'oauth_popup'
        
        if (isPopup) {
          const width = 480
          const height = 600
          const screenWidth = window.screen.availWidth
          
          // Calculate position for top-right corner
          const left = screenWidth - width - 20 // 20px margin from right edge
          const top = 20 // 20px margin from top
          
          // Resize and move window
          // Note: These methods might be blocked by browser security policies
          // They work best when called from a user-initiated action
          try {
            window.resizeTo(width, height)
            window.moveTo(left, top)
          } catch (e) {
            // If resize/move is blocked, try to set window size via CSS
            console.log('Window resize/move blocked by browser, using CSS fallback')
          }
        }
      } catch (error) {
        console.log('Window resize error:', error)
      }
    }

    // Try to resize immediately
    resizeWindow()

    // Also try after delays (in case window isn't ready)
    const timeoutId1 = setTimeout(resizeWindow, 100)
    const timeoutId2 = setTimeout(resizeWindow, 500)

    // Add class to body to override default styles
    document.body.classList.add('page-container-active')
    
    return () => {
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      // Remove class when component unmounts
      document.body.classList.remove('page-container-active')
    }
  }, [])

  const [serviceInfo, setServiceInfo] = useState<any>(null)
  const [userDataItems, setUserDataItems] = useState<any[]>([])
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loadingService, setLoadingService] = useState(true)

  // Fetch service information using contractService
  useEffect(() => {
    if (!serviceAddress) {
      setError('Service ID is required')
      setLoadingService(false)
      return
    }

    const fetchServiceInfo = async () => {
      setLoadingService(true)
      try {
        const serviceInfoData = await contractService.getOAuthSerViceViaServiceCaps(
          suiClient,
          serviceAddress
        )

        if (serviceInfoData && Array.isArray(serviceInfoData) && serviceInfoData.length > 0) {
          // Find the service that matches the serviceAddress
          const matchedService = serviceInfoData.find(
            (service: any) => 
              service.objectId === serviceAddress || 
              service.fields?.id?.id === serviceAddress
          ) || serviceInfoData[0] // Fallback to first item if no match

          // Transform the data structure to match expected format
          const transformedServiceInfo = {
            id: matchedService.objectId || matchedService.fields?.id?.id,
            clientId: matchedService.fields?.client_id || '',
            owner: matchedService.fields?.owner || '',
            redirectUrl: matchedService.fields?.redirect_url || '',
            resourceTypes: matchedService.fields?.resource_types || [],
            createdAt: matchedService.fields?.created_at || 0,
          }

          setServiceInfo(transformedServiceInfo)
          setError(null)
        } else {
          // Invalid service data - silently handle, don't show error
          console.warn('Invalid service data structure')
          setError(null)
        }
      } catch (err: any) {
        setError(`Failed to load service: ${err.message}`)
        console.error('Error fetching service:', err)
      } finally {
        setLoadingService(false)
      }
    }

    fetchServiceInfo()
  }, [serviceAddress])

  // Fetch user's data items using contractService
  useEffect(() => {
    if (!isConnected || !currentAccount) return

    const fetchUserData = async () => {
      try {
        setStatus('Loading your data items...')
        
        // Use new method that works with shared DataVault and Data objects
        const dataItems = await contractService.getUserDataItemsViaVaultCaps(
          suiClient,
          currentAccount.address
        )

        // Transform the data to match the expected format
        const transformedItems = dataItems.map((item) => ({
          id: item.objectId,
          name: item.fields?.name || 'Unnamed',
          shareType: item.fields?.share_type || 0,
          vaultId: item.fields?.vault_id || '',
          value: item.fields?.value || '',
          nonce: item.fields?.nonce || [],
        }))

        setUserDataItems(transformedItems)
        setStatus('')
        console.log('✅ Loaded data items:', transformedItems.length)
        console.log('transformedItems', transformedItems)
        
        if (transformedItems.length === 0) {
          console.log('💡 No data items found. Please create some data first.')
        }
      } catch (err: any) {
        console.error('❌ Error fetching user data:', err)
        setError(`Failed to load user data: ${err.message}`)
        setStatus('')
      }
    }

    fetchUserData()
  }, [isConnected, currentAccount])

  // Debug: Log button state
  // useEffect(() => {
  //   console.log('🔘 Authorize button state:', {
  //     loading,
  //     hasServiceInfo: !!serviceInfo,
  //     selectedCount: selectedResources.length,
  //     selectedResources,
  //     disabled: loading || !serviceInfo || selectedResources.length === 0,
  //   })
  // }, [loading, serviceInfo, selectedResources])

  const resourceTypeLabels: Record<number, string> = {
    0: 'View',
    1: 'Edit',
    2: 'Delete',
  }

  const handleResourceToggle = (resourceId: string) => {
    setSelectedResources((prev) => {
      const newSelection = prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
      console.log('Selected resources:', newSelection)
      return newSelection
    })
  }

  const generateAccessToken = () => {
    // Generate a random access token
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const handleAuthorize = async () => {
    if (!isConnected || !currentAccount || !serviceInfo) {
      setError('Please connect your wallet first')
      return
    }

    if (selectedResources.length === 0) {
      setError('Please select at least one resource to authorize')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Creating read-only capabilities...')

    try {
      // Generate access token
      const accessToken = generateAccessToken()

      // Calculate expiration (30 days from now)
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

      // Get unique vault IDs from selected resources
      const selectedItems = userDataItems.filter((item) =>
        selectedResources.includes(item.id)
      )
      const uniqueVaultIds = [
        ...new Set(selectedItems.map((item) => item.vaultId).filter(Boolean)),
      ]

      if (uniqueVaultIds.length === 0) {
        setError('No valid vaults found for selected resources')
        setLoading(false)
        return
      }

      // Get service owner address (the address that will receive the ReadOnlyCap)
      // serviceAddress is the service ID, we need to get the owner from serviceInfo
      const serviceOwnerAddress = serviceInfo.owner || serviceAddress

      // Create transaction with multiple operations
      const tx = new Transaction()

      // Step 1: Create ReadOnlyCap for each unique vault
      // Using contractService.buildCreateReadOnlyCapTx pattern
      for (const vaultId of uniqueVaultIds) {
        tx.moveCall({
          target: `${SEAL_PACKAGE_ID}::seal_private_data::create_readonly_cap_entry`,
          arguments: [
            tx.object(vaultId),
            tx.pure.u64(expiresAt),
            tx.object('0x6'), // Clock
            tx.pure.address(serviceOwnerAddress),
          ],
        })
      }

      // Step 2: Create OAuth grant
      const resourceIds = selectedResources
      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::oauth_service::create_oauth_grant_entry`,
        arguments: [
          tx.pure.string(serviceInfo.clientId),
          tx.pure.address(currentAccount.address),
          tx.pure.vector('address', resourceIds),
          tx.pure.u64(expiresAt),
          tx.pure.string(accessToken),
          tx.object('0x6'), // Clock
        ],
      })

      setStatus('Signing and executing transaction...')
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('OAuth grant created:', result)

      // Extract grant ID from result
      const resultAny = result as any
      let grantId: string | null = null
      if (resultAny.objectChanges) {
        const grantChange = resultAny.objectChanges.find(
          (change: any) =>
            change.type === 'created' && change.objectType?.includes('OAuthGrant')
        )
        if (grantChange) {
          grantId = grantChange.objectId
        }
      }

      setStatus('✅ Authorization successful! Redirecting...')

      // Prepare redirect URL
      const redirectUrl = new URL(serviceInfo.redirectUrl)
      redirectUrl.searchParams.set('access_token', accessToken)
      if (grantId) {
        redirectUrl.searchParams.set('grant_id', grantId)
      }

      // If this is a popup window, send message to parent and close
      if (window.opener && !window.opener.closed) {
        // Send success message to parent window (OAuthTriggerPage)
        try {
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            accessToken,
            grantId,
            redirectUrl: redirectUrl.toString(),
            serviceId: serviceInfo.id,
          }, window.location.origin)
        } catch (e) {
          console.log('Failed to send message to parent:', e)
        }
        
        // Wait a moment for user to see success message, then close popup and redirect parent
        setTimeout(() => {
          try {
            window.opener.location.href = redirectUrl.toString()
          } catch (e) {
            console.log('Failed to redirect parent:', e)
          }
          window.close()
        }, 1500)
      } else {
        // Normal redirect if not a popup
        setTimeout(() => {
          window.location.href = redirectUrl.toString()
        }, 2000)
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Authorization failed'
      setError(`Authorization failed: ${errorMsg}`)
      setStatus('❌ Authorization failed')
      console.error('Authorization error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!serviceAddress) {
    return (
      <div className="oauth-page">
        <div className="oauth-container">
          <div className="oauth-error">
            <div className="oauth-icon">⚠️</div>
            <h1>Authorization Error</h1>
            <p>Missing service parameter. Please provide a valid service ID.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="oauth-page">
      <div className="oauth-container">
        <div className="oauth-card">
          {/* Header with service info and connect button */}
          <div className="oauth-header">
            <div className="oauth-header-top">
              <div className="oauth-logo">🐋</div>
              <div className="oauth-header-text">
                {loadingService ? (
                  <>
                    <h1 className="oauth-title">Loading...</h1>
                    <p className="oauth-subtitle">Please wait while we load the service information.</p>
                  </>
                ) : serviceInfo ? (
                  <>
                    <h1 className="oauth-title">Bowhead Whale Authorization</h1>
                    <p className="oauth-subtitle">
                      {serviceInfo.clientId} is requesting permission to access your data
                    </p>
                  </>
                ) : error ? (
                  <>
                    <h1 className="oauth-title">Service Error</h1>
                    <p className="oauth-subtitle">{error}</p>
                  </>
                ) : (
                  <>
                    <h1 className="oauth-title">Authorization</h1>
                    <p className="oauth-subtitle">Connect your wallet to continue</p>
                  </>
                )}
              </div>
            </div>
            
            <div className="oauth-header-actions">
              {!isConnected ? (
                <div className="oauth-connect-section">
                  <ConnectButton />
                </div>
              ) : (
                <div className="oauth-wallet-section">
                  <div className="oauth-wallet-info">
                    <span className="wallet-address-display">
                      {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}
                    </span>
                  </div>
                  <button
                    className="oauth-settings-button"
                    onClick={() => setShowSettings(true)}
                    aria-label="Settings"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16.25 10C16.1574 10.8696 15.9651 11.7246 15.6783 12.5458L17.5 15.4167L15.4167 17.5L12.5458 15.6783C11.7246 15.9651 10.8696 16.1574 10 16.25C9.13038 16.1574 8.27542 15.9651 7.45417 15.6783L4.58333 17.5L2.5 15.4167L4.32167 12.5458C4.03493 11.7246 3.84264 10.8696 3.75 10C3.84264 9.13038 4.03493 8.27542 4.32167 7.45417L2.5 4.58333L4.58333 2.5L7.45417 4.32167C8.27542 4.03493 9.13038 3.84264 10 3.75C10.8696 3.84264 11.7246 4.03493 12.5458 4.32167L15.4167 2.5L17.5 4.58333L15.6783 7.45417C15.9651 8.27542 16.1574 9.13038 16.25 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {!isConnected ? (
            <div className="oauth-content">
              <p className="oauth-description">
                Please connect your wallet to view and authorize access to your resources.
              </p>
              {serviceInfo && serviceInfo.resourceTypes.length > 0 && (
                <div className="oauth-permissions">
                  <h2 className="permissions-title">This will allow {serviceInfo.clientId} to:</h2>
                  <ul className="permissions-list">
                    {serviceInfo.resourceTypes.map((type: number, index: number) => (
                      <li key={index} className="permission-item">
                        <svg className="permission-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M16.6667 5L7.50004 14.1667L3.33337 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{resourceTypeLabels[type] || `Type ${type}`} your data</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="oauth-content">
                {serviceInfo && serviceInfo.resourceTypes && (
                  <div className="oauth-permissions">
                    <h2 className="permissions-title">This will allow {serviceInfo.clientId} to:</h2>
                    <ul className="permissions-list">
                      {serviceInfo.resourceTypes.map((type: number, index: number) => (
                        <li key={index} className="permission-item">
                          <svg className="permission-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M16.6667 5L7.50004 14.1667L3.33337 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>{resourceTypeLabels[type] || `Type ${type}`} your data</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="oauth-resources">
                  <h3 className="resources-title">
                    Select Resources to Authorize {userDataItems.length > 0 && `(${userDataItems.length})`}
                  </h3>
                  {status && status.includes('Loading') ? (
                    <div className="oauth-empty">
                      <p>{status}</p>
                    </div>
                  ) : userDataItems.length > 0 ? (
                    <div className="resources-list">
                      {userDataItems.map((item) => {
                        return (
                          <div key={item.id} className="resource-item-container">
                            <label className="resource-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedResources.includes(item.id)}
                                onChange={() => handleResourceToggle(item.id)}
                                disabled={loading}
                              />
                              <div className="resource-info">
                                <div className="resource-main">
                                  <span className="resource-label">{item.name || 'Unnamed'}</span>
                                  <span className="resource-type">
                                    ({resourceTypeLabels[item.shareType] || 'Unknown'})
                                  </span>
                                </div>
                                <div className="resource-details">
                                  <span className="resource-detail-item">
                                    <strong>ID:</strong> {item.id ? `${item.id.slice(0, 8)}...${item.id.slice(-6)}` : 'N/A'}
                                  </span>
                                  <span className="resource-detail-item">
                                    <strong>Vault:</strong> {item.vaultId ? `${item.vaultId.slice(0, 8)}...${item.vaultId.slice(-6)}` : 'N/A'}
                                  </span>
                                  <span className="resource-detail-item">
                                    <strong>Walrus Blob:</strong> {item.value || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </label>
                            <button
                              className="resource-details-button"
                              onClick={() => {
                                console.log('📋 Full Data Item Details:', {
                                  id: item.id,
                                  name: item.name,
                                  shareType: item.shareType,
                                  shareTypeLabel: resourceTypeLabels[item.shareType],
                                  vaultId: item.vaultId,
                                  walrusBlobId: item.value,
                                  nonce: item.nonce,
                                })
                                alert(`Data Item: ${item.name}\n\nID: ${item.id}\nVault ID: ${item.vaultId}\nWalrus Blob ID: ${item.value}\nShare Type: ${resourceTypeLabels[item.shareType]}\n\n详细信息已输出到控制台`)
                              }}
                              title="View full details"
                            >
                              ℹ️
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="oauth-empty">
                      <p>No data items found. Please create some data first.</p>
                    </div>
                  )}
                </div>

                {/* Footer with authorize button */}
                <div className="oauth-footer">
                  <button
                    className="oauth-button oauth-button-secondary"
                    onClick={() => {
                      // If this is a popup window, send cancel message and close it
                      if (window.opener && !window.opener.closed) {
                        try {
                          window.opener.postMessage({
                            type: 'OAUTH_CANCELLED',
                          }, window.location.origin)
                        } catch (e) {
                          console.log('Failed to send cancel message:', e)
                        }
                        window.close()
                      } else {
                        window.history.back()
                      }
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="oauth-button oauth-button-primary"
                    onClick={() => {
                      console.log('Authorize button clicked', {
                        loading,
                        serviceInfo: !!serviceInfo,
                        selectedResources: selectedResources.length,
                        selectedResourcesList: selectedResources,
                      })
                      handleAuthorize()
                    }}
                    disabled={
                      loading ||
                      !serviceInfo ||
                      selectedResources.length === 0
                    }
                    title={
                      !serviceInfo
                        ? 'Service info not loaded'
                        : selectedResources.length === 0
                        ? 'Please select at least one resource'
                        : 'Click to authorize'
                    }
                  >
                    {loading ? 'Authorizing...' : 'Authorize'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Status and error messages */}
          {status && (
            <div className="oauth-status">
              {status}
            </div>
          )}

          {error && !loadingService && (
            <div className="oauth-error-message">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="oauth-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="oauth-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="oauth-modal-header">
              <h2 className="oauth-modal-title">Settings</h2>
              <button
                className="oauth-modal-close"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="oauth-modal-body">
              {isConnected && currentAccount && (
                <div className="oauth-settings-section">
                  <h3 className="oauth-settings-section-title">Wallet</h3>
                  <div className="oauth-settings-item">
                    <div className="oauth-settings-item-label">Connected Address</div>
                    <div className="oauth-settings-item-value oauth-settings-address">
                      {currentAccount.address}
                    </div>
                  </div>
                  <button
                    className="oauth-button oauth-button-secondary"
                    onClick={() => {
                      disconnect()
                      setShowSettings(false)
                    }}
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    Disconnect Wallet
                  </button>
                  <div className="oauth-settings-hint">
                    <p>Disconnect to switch to a different wallet address.</p>
                  </div>
                </div>
              )}

              {!isConnected && (
                <div className="oauth-settings-section">
                  <h3 className="oauth-settings-section-title">Wallet</h3>
                  <p className="oauth-settings-hint">No wallet connected. Use the connect button above to connect your wallet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

