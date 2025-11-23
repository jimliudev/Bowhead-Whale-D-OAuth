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
import { SEAL_PACKAGE_ID, API_BASE_URL } from '../config'
import { contractService } from '../services/contractService'
import './css/PageLayout.css'
import './css/DOAuthPage.css'

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
})

interface EditRequestData {
  itemId: string
  newValue: string
  signature: string
  expireTime: number
}

export default function DOAuthEditPage() {
  const [searchParams] = useSearchParams()
  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const { mutate: disconnect } = useDisconnectWallet()
  
  const token = searchParams.get('token')
  const isConnected = Boolean(currentAccount)

  const [editRequestData, setEditRequestData] = useState<EditRequestData | null>(null)
  const [oauthGrant, setOauthGrant] = useState<any>(null)
  const [itemInfo, setItemInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)
  const [authorizationSuccess, setAuthorizationSuccess] = useState(false)

  useEffect(() => {
    document.body.classList.add('page-container-active')
    return () => {
      document.body.classList.remove('page-container-active')
    }
  }, [])

  // Fetch edit request data from API
  useEffect(() => {
    if (!token) {
      setError('Missing token parameter')
      setLoadingData(false)
      return
    }

    const fetchEditRequest = async () => {
      setLoadingData(true)
      try {
        const apiBaseUrl = API_BASE_URL || ''
        const response = await fetch(`${apiBaseUrl}/api/bowheadwhale/get-edit-request?token=${encodeURIComponent(token)}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch edit request')
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch edit request')
        }

        setEditRequestData(result.data)
        setError(null)
      } catch (err: any) {
        setError(`Failed to load edit request: ${err.message}`)
        console.error('Error fetching edit request:', err)
      } finally {
        setLoadingData(false)
      }
    }

    fetchEditRequest()
  }, [token])

  // Fetch item info and check OAuthGrant
  useEffect(() => {
    if (!isConnected || !currentAccount || !editRequestData) return

    const fetchDataAndCheckGrant = async () => {
      try {
        setStatus('Loading item information...')
        
        // Get item info
        const itemInfoData = await contractService.getDataInfo(suiClient, editRequestData.itemId)
        if (!itemInfoData) {
          throw new Error('Item not found')
        }
        setItemInfo(itemInfoData)

        setStatus('Checking OAuth grant...')
        
        // Get all user's OAuthGrants
        const grants = await contractService.getUserOAuthGrantsWithDetails(
          suiClient,
          currentAccount.address
        )

        // Find grant that has Edit permission for this item
        const matchingGrant = grants.find((grant: any) => {
          if (!grant.fields) return false
          
          const resourceIds = grant.fields.resource_ids || []
          const currentTime = Date.now()
          const expiresAt = grant.fields.expires_at || 0
          
          // Check if grant has expired
          if (currentTime > expiresAt) {
            return false
          }
          
          // Check if grant contains this itemId with Edit permission (allow_type == 1)
          // resource_ids is a vector of AccessDataEntry, which has data_id and allow_type
          // The structure from Sui might be: [{ data_id: { id: "0x..." }, allow_type: 1 }, ...]
          if (Array.isArray(resourceIds)) {
            return resourceIds.some((entry: any) => {
              // Handle different possible structures
              let dataId: string | null = null
              let allowType: number = 0
              
              if (entry?.data_id) {
                // Structure: { data_id: { id: "0x..." }, allow_type: 1 }
                dataId = entry.data_id.id || entry.data_id
                allowType = entry.allow_type || 0
              } else if (typeof entry === 'string') {
                // If it's just a string, it might be the data_id itself
                dataId = entry
                allowType = 1 // Assume Edit if only ID is provided
              } else if (entry?.fields) {
                // Nested structure
                dataId = entry.fields?.data_id?.id || entry.fields?.data_id
                allowType = entry.fields?.allow_type || 0
              }
              
              return dataId === editRequestData.itemId && allowType === 1
            })
          }
          
          return false
        })

        if (matchingGrant) {
          setOauthGrant(matchingGrant)
          setStatus('')
        } else {
          setError('No valid OAuth grant found with Edit permission for this item')
          setStatus('')
        }
      } catch (err: any) {
        console.error('Error checking OAuth grant:', err)
        setError(`Failed to check authorization: ${err.message}`)
        setStatus('')
      }
    }

    fetchDataAndCheckGrant()
  }, [isConnected, currentAccount, editRequestData])

  const handleAuthorize = async () => {
    if (!isConnected || !currentAccount || !editRequestData || !oauthGrant || !itemInfo) {
      setError('Missing required information')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Updating data...')

    try {
      // Create transaction to update data using OAuthGrant
      const tx = new Transaction()

      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::seal_private_data::update_data_by_oauth_grant`,
        arguments: [
          tx.object(oauthGrant.objectId),
          tx.object(editRequestData.itemId),
          tx.pure.string(editRequestData.newValue),
          tx.object('0x6'), // Clock
        ],
      })

      setStatus('Signing and executing transaction...')
      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      setError(null)
      setStatus('✅ Data updated successfully!')
      setAuthorizationSuccess(true)
      
      console.log('Transaction result:', result)
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Update failed'
      setError(`Update failed: ${errorMsg}`)
      setStatus('❌ Update failed')
      console.error('Update error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Show authorization success page
  if (authorizationSuccess) {
    return (
      <div className="oauth-page">
        <div className="oauth-container">
          <div className="oauth-card oauth-success-card">
            <div className="oauth-success-header">
              <div className="oauth-success-icon-wrapper">
                <div className="oauth-success-icon">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="32" fill="#34C759" opacity="0.1"/>
                    <path d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 44c-11.046 0-20-8.954-20-20S20.954 12 32 12s20 8.954 20 20-8.954 20-20 20z" fill="#34C759"/>
                    <path d="M26 32l6 6 10-10" stroke="#34C759" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <h1 className="oauth-success-title">Update Successful</h1>
              <p className="oauth-success-subtitle">
                Your data has been updated successfully.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="oauth-page">
        <div className="oauth-container">
          <div className="oauth-error">
            <div className="oauth-icon">⚠️</div>
            <h1>Authorization Error</h1>
            <p>Missing token parameter. Please provide a valid token.</p>
          </div>
        </div>
      </div>
    )
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
                {loadingData ? (
                  <>
                    <h1 className="oauth-title">Loading...</h1>
                    <p className="oauth-subtitle">Please wait while we load the edit request.</p>
                  </>
                ) : editRequestData ? (
                  <>
                    <h1 className="oauth-title">Data Update Request</h1>
                    <p className="oauth-subtitle">
                      A third-party service is requesting to update your data.
                    </p>
                  </>
                ) : error ? (
                  <>
                    <h1 className="oauth-title">Error</h1>
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
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {!isConnected ? (
            <div className="oauth-content">
              <p className="oauth-description">
                Please connect your wallet to review and authorize the data update request.
              </p>
            </div>
          ) : (
            <>
              <div className="oauth-content">
                {status && status.includes('Loading') && (
                  <div className="oauth-empty">
                    <p>{status}</p>
                  </div>
                )}

                {oauthGrant && editRequestData && itemInfo && (
                  <div className="oauth-resources">
                    <h3 className="resources-title">Update Request Details</h3>
                    <div className="resources-list">
                      <div className="resource-item-container">
                        <div className="resource-info">
                          <div className="resource-main">
                            <span className="resource-label">Item ID</span>
                          </div>
                          <div className="resource-details">
                            <span className="resource-detail-item">
                              {editRequestData.itemId.slice(0, 12)}...{editRequestData.itemId.slice(-8)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="resource-item-container">
                        <div className="resource-info">
                          <div className="resource-main">
                            <span className="resource-label">Current Value</span>
                          </div>
                          <div className="resource-details">
                            <span className="resource-detail-item">
                              {itemInfo.value ? `${itemInfo.value.slice(0, 12)}...${itemInfo.value.slice(-8)}` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="resource-item-container">
                        <div className="resource-info">
                          <div className="resource-main">
                            <span className="resource-label">New Value</span>
                          </div>
                          <div className="resource-details">
                            <span className="resource-detail-item">
                              {editRequestData.newValue.slice(0, 12)}...{editRequestData.newValue.slice(-8)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="resource-item-container">
                        <div className="resource-info">
                          <div className="resource-main">
                            <span className="resource-label">OAuth Grant</span>
                          </div>
                          <div className="resource-details">
                            <span className="resource-detail-item">
                              ✅ Valid grant found with Edit permission
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!oauthGrant && !status.includes('Loading') && editRequestData && (
                  <div className="oauth-empty">
                    <p>No valid OAuth grant found with Edit permission for this item.</p>
                    <p>Please authorize the service first before updating data.</p>
                  </div>
                )}

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
                    onClick={handleAuthorize}
                    disabled={
                      loading ||
                      !oauthGrant ||
                      !editRequestData ||
                      !itemInfo
                    }
                    title={
                      !oauthGrant
                        ? 'No valid OAuth grant found'
                        : !editRequestData
                        ? 'Edit request data not loaded'
                        : 'Click to authorize update'
                    }
                  >
                    {loading ? 'Updating...' : 'Authorize Update'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Status and error messages */}
          {status && !status.includes('Loading') && (
            <div className="oauth-status">
              {status}
            </div>
          )}

          {error && !loadingData && (
            <div className="oauth-error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

