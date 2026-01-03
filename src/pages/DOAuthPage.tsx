import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useCurrentAccount,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  useDisconnectWallet,
  ConnectButton,
  useSignPersonalMessage,
} from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { SEAL_PACKAGE_ID } from '../config'
import { contractService } from '../services/contractService'
import { SealService } from '../services/sealService'
import './css/PageLayout.css'
import './css/DOAuthPage.css'
import { SessionKey } from '@mysten/seal'

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
})

export default function DOAuthPage() {
  const [searchParams] = useSearchParams()
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const { mutate: disconnect } = useDisconnectWallet()

  // Get service address from URL parameter or sessionStorage
  const urlServiceAddress = searchParams.get('service')
  const sessionServiceAddress = sessionStorage.getItem('oauth_service_id')
  const serviceAddress = urlServiceAddress || sessionServiceAddress

  const isConnected = Boolean(currentAccount)
  const [showSettings, setShowSettings] = useState(false)

  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();


  useEffect(() => {
    // Add class to body to override default styles
    document.body.classList.add('page-container-active')
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove('page-container-active')
    }
  }, [])

  const [serviceInfo, setServiceInfo] = useState<any>(null)
  const [userDataItems, setUserDataItems] = useState<any[]>([])
  // selectedResources: Record<resourceId, permissionType> where 0=View, 1=Edit
  const [selectedResources, setSelectedResources] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loadingService, setLoadingService] = useState(true)
  const [authorizationSuccess, setAuthorizationSuccess] = useState(false)
  const [grantId, setGrantId] = useState<string | null>(null)

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
      // If already selected, deselect it
      if (prev.hasOwnProperty(resourceId)) {
        const newSelection = { ...prev }
        delete newSelection[resourceId]
        console.log('Deselected resource:', resourceId)
        return newSelection
      }
      // Otherwise, select it with View permission (0)
      const newSelection = { ...prev, [resourceId]: 0 }
      console.log('Selected resource:', resourceId, 'with permission: View')
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

    if (Object.keys(selectedResources).length === 0) {
      setError('Please select at least one resource to authorize')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Creating read-only capabilities...')

    try {
      // Calculate expiration (30 mins from now)
      const expiresAt = Date.now() + 30 * 60 * 1000

      // Get unique vault IDs from selected resources
      const selectedItems = userDataItems.filter((item) =>
        selectedResources.hasOwnProperty(item.id)
      )
      const uniqueVaultIds = [
        ...new Set(selectedItems.map((item) => item.vaultId).filter(Boolean)),
      ]

      if (uniqueVaultIds.length === 0) {
        setError('No valid vaults found for selected resources')
        setLoading(false)
        return
      }

      // Get service owner address (the address that will be added to allow list)
      // serviceAddress is the service ID, we need to get the owner from serviceInfo
      const serviceOwnerAddress = serviceInfo.owner || serviceAddress

      // Get user's DataVaultCap objects to find the corresponding caps for each vault
      const vaultCaps = await contractService.getUserObjectsByType(
        suiClient,
        currentAccount.address,
        'DataVaultCap',
        { showContent: true }
      )

      // Create a map of vaultId -> vaultCapId
      const vaultCapMap = new Map<string, string>()
      for (const cap of vaultCaps) {
        if (cap.fields?.vault_id) {
          vaultCapMap.set(cap.fields.vault_id, cap.objectId)
        }
      }

      // Create transaction with multiple operations
      const tx = new Transaction()

      // Step 1: Add service owner address to allow list for each unique vault
      for (const vaultId of uniqueVaultIds) {
        const vaultCapId = vaultCapMap.get(vaultId)
        if (!vaultCapId) {
          console.warn(`No DataVaultCap found for vault ${vaultId}`)
          continue
        }

        // All selected items have View permission (0) only
        const allowType = 0

        // Add service owner to allow list
        tx.moveCall({
          target: `${SEAL_PACKAGE_ID}::seal_private_data::create_data_vault_allow_list`,
          arguments: [
            tx.object(vaultCapId),
            tx.object(vaultId),
            tx.pure.address(serviceOwnerAddress),
            tx.pure.u8(allowType),
            tx.pure.u64(expiresAt),
            tx.object('0x6'), // Clock
          ],
        })
      }

      // Step 2: Create OAuthGrant to store authorization on-chain
      setStatus('Creating OAuth grant...')
      const resourceEntries = selectedItems.map(item => ({
        dataId: item.id,
        allowType: selectedResources[item.id] ?? 0,
      }))

      // Add moveCall to create OAuthGrant
      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::seal_private_data::create_oauth_grant_entry`,
        arguments: [
          tx.pure.address(currentAccount.address),
          tx.pure.vector('address', resourceEntries.map(e => e.dataId)),
          tx.pure.vector('u8', resourceEntries.map(e => e.allowType)),
          tx.pure.u64(expiresAt),
          tx.object('0x6'), // Clock
        ],
      })

      setStatus('Signing and executing transaction...')
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })


      setError(null) // Clear any previous errors
      setStatus('✅ Authorization successful!')

      // Set authorization success last to ensure all other states are set first
      setAuthorizationSuccess(true)

      console.log('States set, should show success page now. authorizationSuccess:', true)
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Authorization failed'
      setError(`Authorization failed: ${errorMsg}`)
      setStatus('❌ Authorization failed')
      console.error('Authorization error:', err)
    } finally {
      setLoading(false)
    }
  }

  const sealService = new SealService()

  const handleGenerateAccessToken = async () => {
    if (!serviceInfo) {
      setError('Missing service information')
      return
    }

    if (!isConnected || !currentAccount || !currentWallet) {
      setError('Please connect your wallet first')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Generating SessionKey...')

    try {
      // Use SealService to create and export SessionKey as base64
      setStatus('Please sign in your wallet to create SessionKey...')
      // const sessionKeyBase64 = await sealService.createAndExportSessionKeyAsBase64(
      //   currentAccount.address,
      //   currentWallet,
      //   currentAccount,
      //   suiClient,
      //   10 // ttlMin: 10 minutes
      // )

      const sessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: SEAL_PACKAGE_ID,
        ttlMin: 20,
        suiClient,
      })


      // Sign personal message
      const personalMessage = sessionKey.getPersonalMessage()
      const signature = await signPersonalMessage({ message: personalMessage })
      await sessionKey.setPersonalMessageSignature(signature.signature)

      console.log('✅ SessionKey signed, exporting...')

      // Export SessionKey to JSON
      const sessionKeyJson = sealService.serializeSessionKey(sessionKey)
      console.log('📦 SessionKey JSON exported')

      // Convert JSON to base64
      const sessionKeyBase64 = btoa(unescape(encodeURIComponent(sessionKeyJson)))

      // test decrypt
      // const newSessionKey = await SessionKey.create({
      //   address: currentAccount.address,
      //   packageId: SEAL_PACKAGE_ID,
      //   ttlMin: 30,
      //   suiClient,
      // })

      // Sign personal message
      setStatus('Please sign message in your wallet...')
      // const personalMessage = newSessionKey.getPersonalMessage()
      // const signature = await signPersonalMessage(personalMessage)
      // await newSessionKey.setPersonalMessageSignature(signature)

      // const sessionKeyJson = sealService.serializeSessionKey(newSessionKey)
      console.log('📦 SessionKey JSON exported')

      // Convert JSON to base64
      // const sessionKeyBase64 = btoa(unescape(encodeURIComponent(sessionKeyJson)))

      console.log('✅ SessionKey created and exported as base64')

      setStatus('Redirecting to service...')

      // Redirect to service's redirect URL with base64 encoded SessionKey as access token
      const redirectUrl = new URL(serviceInfo.redirectUrl)
      redirectUrl.searchParams.set('access_token', sessionKeyBase64)

      // Redirect immediately
      window.location.href = redirectUrl.toString()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to generate access token'
      setError(`Failed to generate access token: ${errorMsg}`)
      setStatus('❌ Failed to generate access token')
      console.error('Generate access token error:', err)
      setLoading(false)
    }
  }

  // Show authorization success page
  // IMPORTANT: This check must come before any other conditional renders
  if (authorizationSuccess) {
    console.log('Rendering authorization success page')
    return (
      <div className="oauth-page">
        <div className="oauth-container">
          <div className="oauth-card oauth-success-card">
            <div className="oauth-success-header">
              <div className="oauth-success-icon-wrapper">
                <div className="oauth-success-icon">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="32" fill="#34C759" opacity="0.1" />
                    <path d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 44c-11.046 0-20-8.954-20-20S20.954 12 32 12s20 8.954 20 20-8.954 20-20 20z" fill="#34C759" />
                    <path d="M26 32l6 6 10-10" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <h1 className="oauth-success-title">Authorization Successful</h1>
              <p className="oauth-success-subtitle">
                Your data has been authorized successfully. You can now generate an access token to continue.
              </p>
            </div>

            <div className="oauth-success-content">
              {grantId && (
                <div className="oauth-grant-info">
                  <div className="oauth-grant-label">Grant ID</div>
                  <div className="oauth-grant-value">{grantId}</div>
                </div>
              )}

              <div className="oauth-success-actions">
                <button
                  className="oauth-success-button"
                  onClick={handleGenerateAccessToken}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="oauth-button-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
                          <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite" />
                          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite" />
                        </circle>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Access Token</span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
                      <strong style={{ color: '#0071e3', fontWeight: 600 }}>{serviceInfo.clientId}</strong> is requesting permission to access your data
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
                      <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16.25 10C16.1574 10.8696 15.9651 11.7246 15.6783 12.5458L17.5 15.4167L15.4167 17.5L12.5458 15.6783C11.7246 15.9651 10.8696 16.1574 10 16.25C9.13038 16.1574 8.27542 15.9651 7.45417 15.6783L4.58333 17.5L2.5 15.4167L4.32167 12.5458C4.03493 11.7246 3.84264 10.8696 3.75 10C3.84264 9.13038 4.03493 8.27542 4.32167 7.45417L2.5 4.58333L4.58333 2.5L7.45417 4.32167C8.27542 4.03493 9.13038 3.84264 10 3.75C10.8696 3.84264 11.7246 4.03493 12.5458 4.32167L15.4167 2.5L17.5 4.58333L15.6783 7.45417C15.9651 8.27542 16.1574 9.13038 16.25 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                          <path d="M16.6667 5L7.50004 14.1667L3.33337 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                        const isSelected = selectedResources.hasOwnProperty(item.id)
                        return (
                          <div
                            key={item.id}
                            className={`resource-item-container ${isSelected ? 'resource-item-selected' : ''}`}
                            onClick={() => !loading && handleResourceToggle(item.id)}
                            style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                          >
                            <div className="resource-checkbox-wrapper">
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
                                </div>
                              </div>
                              <div className="resource-permission-selector">
                                <div className="permission-options">
                                  <div className={`permission-option ${isSelected ? 'permission-option-active' : ''}`}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M8 2.667C4.667 2.667 2 5.333 2 8.667s2.667 6 6 6 6-2.667 6-6-2.667-6-6-6zm0 10.667c-2.573 0-4.667-2.094-4.667-4.667S5.427 4 8 4s4.667 2.094 4.667 4.667S10.573 13.333 8 13.333z" fill="currentColor" />
                                      <path d="M8 6c-1.467 0-2.667 1.2-2.667 2.667h1.333c0-.733.6-1.333 1.333-1.333s1.333.6 1.333 1.333H10.667C10.667 7.2 9.467 6 8 6z" fill="currentColor" />
                                    </svg>
                                    <span>View</span>
                                  </div>
                                </div>
                              </div>
                            </div>
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
                    onClick={() => window.history.back()}
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
                        selectedResources: Object.keys(selectedResources).length,
                        selectedResourcesList: selectedResources,
                      })
                      handleAuthorize()
                    }}
                    disabled={
                      loading ||
                      !serviceInfo ||
                      Object.keys(selectedResources).length === 0
                    }
                    title={
                      !serviceInfo
                        ? 'Service info not loaded'
                        : Object.keys(selectedResources).length === 0
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
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

