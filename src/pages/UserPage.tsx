import { useState, useMemo, useEffect } from 'react'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useCurrentWallet,
} from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { walrus } from '@mysten/walrus'
import { SessionKey } from '@mysten/seal'
import { SealService } from '../services/sealService'
import { contractService } from '../services/contractService'
import { walrusApiService } from '../services/walrusApiService'
import { SEAL_PACKAGE_ID } from '../config'
import Header from '../components/Header'
import './css/PageLayout.css'
import './css/UserPage.css'

// const suiClient = new SuiClient({
//   url: getFullnodeUrl('testnet'),
//   network: 'testnet',
// }).$extend(
//   walrus(),
// )

const suiClient = new SuiJsonRpcClient({
	url: getFullnodeUrl('testnet'),
	network: 'testnet',
}).$extend(
	walrus({
		wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
	}),
);

interface DataVaultWithItems {
  vaultId: string
  vaultCapId: string
  groupName: string
  items: Array<{
    id: string
    name: string
    shareType: number
    walrusBlobId: string
    nonce: number[]
    contentType?: 'text' | 'image' // Will be set after decryption
  }>
}

export default function UserPage() {
  useEffect(() => {
    document.body.classList.add('page-container-active')
    return () => {
      document.body.classList.remove('page-container-active')
    }
  }, [])

  const currentAccount = useCurrentAccount()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const { currentWallet } = useCurrentWallet()
  const isConnected = Boolean(currentAccount)
  const sealService = useMemo(() => new SealService(), [])

  // Sign personal message for SessionKey
  const signPersonalMessage = async (message: Uint8Array): Promise<string> => {
    if (!currentWallet || !currentAccount) {
      throw new Error('Wallet not connected')
    }

    try {
      // Use wallet's signPersonalMessage feature
      const signPersonalMessageFeature = currentWallet.features['sui:signPersonalMessage']
      if (signPersonalMessageFeature) {
        const result = await signPersonalMessageFeature.signPersonalMessage({
          message,
          account: currentAccount,
        })
        return result.signature
      }
      throw new Error('Wallet does not support signPersonalMessage')
    } catch (err: any) {
      console.error('Sign personal message error:', err)
      throw new Error(`Failed to sign message: ${err?.message || 'Unknown error'}`)
    }
  }
  
  // State
  const [vaults, setVaults] = useState<DataVaultWithItems[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  
  // UI State
  const [showCreateVaultModal, setShowCreateVaultModal] = useState(false)
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showViewItemModal, setShowViewItemModal] = useState(false)
  const [selectedVault, setSelectedVault] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<{
    vaultId: string
    itemId: string
    name: string
  } | null>(null)
  const [viewingContent, setViewingContent] = useState<{
    type: 'text' | 'image'
    content: string
    mimeType?: string
    fileName?: string
  } | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  
  // Form states
  const [newVaultName, setNewVaultName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemContent, setNewItemContent] = useState('')
  const [newItemShareType, setNewItemShareType] = useState<number>(0)
  const [newItemType, setNewItemType] = useState<'text' | 'image'>('text')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Fetch user's vaults and items
  const fetchUserVaults = async () => {
    if (!isConnected || !currentAccount) return

    try {
      setStatus('Loading your data vaults...')
      
      // Get all DataVaultCap objects
      const vaultCaps = await contractService.getUserObjectsByType<{
        objectId: string
        fields: {
          id: any
          vault_id: string
        }
      }>(suiClient, currentAccount.address, 'DataVaultCap', {
        showContent: true,
        showType: true,
      })

      console.log('Found vault caps:', vaultCaps)

      const vaultsData: DataVaultWithItems[] = []

      for (const cap of vaultCaps) {
        const vaultId = cap.fields?.vault_id
        if (!vaultId) continue

        try {
          // Get vault info
          const vaultInfo = await contractService.getDataVaultInfo(suiClient, vaultId)
          if (!vaultInfo) continue

          // Get all items in this vault
          const items: DataVaultWithItems['items'] = []
          if (vaultInfo.items.length > 0) {
            const dataItems = await contractService.getBatchDataInfo(suiClient, vaultInfo.items)
            for (const item of dataItems) {
              if (item) {
                items.push({
                  id: item.id,
                  name: item.name,
                  shareType: item.shareType,
                  walrusBlobId: item.value,
                  nonce: Array.from(item.nonce),
                })
              }
            }
          }

          vaultsData.push({
            vaultId,
            vaultCapId: cap.objectId,
            groupName: vaultInfo.groupName,
            items,
          })
        } catch (err) {
          console.warn(`Failed to fetch vault ${vaultId}:`, err)
        }
      }

      // Sort: "Personal Information" first, then others
      vaultsData.sort((a, b) => {
        if (a.groupName === 'Personal Information') return -1
        if (b.groupName === 'Personal Information') return 1
        return a.groupName.localeCompare(b.groupName)
      })

      setVaults(vaultsData)
      setStatus('')
      console.log('Loaded vaults:', vaultsData)
    } catch (err: any) {
      console.error('Error fetching vaults:', err)
      setError(`Failed to load vaults: ${err.message}`)
      setStatus('')
    }
  }

  useEffect(() => {
    if (isConnected && currentAccount) {
      fetchUserVaults()
    }
  }, [isConnected, currentAccount])

  // Create new vault (category)
  const handleCreateVault = async () => {
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    if (!newVaultName.trim()) {
      setError('Please enter a category name')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Creating new category...')

    try {
      const tx = contractService.buildCreateDataVaultTx({
        groupName: newVaultName.trim(),
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Vault creation result:', result)

      // Extract vault and cap IDs
      const resultAny = result as any
      const { created } = contractService.extractObjectIds(resultAny, 'DataVault')
      const { created: createdCaps } = contractService.extractObjectIds(resultAny, 'DataVaultCap')

      if (created.length === 0 || createdCaps.length === 0) {
        throw new Error('Failed to get Vault or VaultCap ID')
      }

      setStatus('✅ Category created successfully!')
      setShowCreateVaultModal(false)
      setNewVaultName('')
      
      // Refresh vaults list
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to create category'
      setError(`Failed to create category: ${errorMsg}`)
      setStatus('❌ Failed to create category')
      console.error('Create vault error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB')
      return
    }

    setSelectedImage(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Add item to vault
  const handleAddItem = async () => {
    if (!isConnected || !currentAccount || !selectedVault) {
      setError('Please select a category first')
      return
    }

    if (!newItemName.trim()) {
      setError('Please enter item name')
      return
    }

    if (newItemType === 'text' && !newItemContent.trim()) {
      setError('Please enter content')
      return
    }

    if (newItemType === 'image' && !selectedImage) {
      setError('Please select an image')
      return
    }

    const vault = vaults.find(v => v.vaultId === selectedVault)
    if (!vault) {
      setError('Category not found')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Adding item...')

    try {
      let contentData: any

      if (newItemType === 'text') {
        // Prepare text content
        contentData = {
          type: 'text',
          content: newItemContent.trim(),
          createdAt: new Date().toISOString(),
        }
      } else {
        // Prepare image content
        setStatus('Processing image...')
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64String = reader.result as string
            // Remove data URL prefix (data:image/...;base64,)
            const base64Data = base64String.split(',')[1]
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(selectedImage!)
        })

        contentData = {
          type: 'image',
          content: imageBase64,
          mimeType: selectedImage!.type,
          fileName: selectedImage!.name,
          fileSize: selectedImage!.size,
          createdAt: new Date().toISOString(),
        }
      }

      const contentJson = JSON.stringify(contentData, null, 2)
      const contentBytes = new TextEncoder().encode(contentJson)

      // Encrypt content
      setStatus('Encrypting content...')
      const encryptionSealId = sealService.getEncryptionSealId()
      const { encryptedObject } = await sealService.encrypt(encryptionSealId, contentBytes)

      // Upload to Walrus via API
      setStatus('Uploading to Walrus...')
      const { blobId } = await walrusApiService.uploadToWalrus({
        encryptedData: encryptedObject,
        deletable: true,
        epochs: 3,
      })

      // Generate nonce
      const nonce = new Uint8Array(16)
      crypto.getRandomValues(nonce)

      // Create Data item
      setStatus('Saving item...')
      const tx = contractService.buildCreateDataEntryTx({
        vaultCapId: vault.vaultCapId,
        vaultId: vault.vaultId,
        name: newItemName.trim(),
        shareType: newItemShareType,
        walrusBlobId: blobId,
        nonce,
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Item creation result:', result)

      setStatus('✅ Item added successfully!')
      setShowAddItemModal(false)
      setNewItemName('')
      setNewItemContent('')
      setNewItemType('text')
      setSelectedImage(null)
      setImagePreview(null)
      setSelectedVault(null)
      
      // Refresh vaults list
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to add item'
      setError(`Failed to add item: ${errorMsg}`)
      setStatus('❌ Failed to add item')
      console.error('Add item error:', err)
    } finally {
      setLoading(false)
    }
  }

  // View item content
  const handleViewItem = async (vaultId: string, itemId: string) => {
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    setLoadingContent(true)
    setViewingContent(null)
    setError(null)
    setStatus('Loading item...')

    try {
      // Step 1: Get item info from chain
      setStatus('Fetching item information...')
      const itemInfo = await contractService.getDataInfo(suiClient, itemId)
      if (!itemInfo) {
        throw new Error('Item not found')
      }

      console.log('Item info:', itemInfo)

      // Step 2: Get encrypted blob from Walrus via API
      setStatus('Downloading encrypted data from Walrus...')
      console.log('Reading blob from Walrus, Blob ID:', itemInfo.value)
      
      const { data: encryptedBlob } = await walrusApiService.readFromWalrus(itemInfo.value)
      console.log('Downloaded encrypted blob, size:', encryptedBlob.length)

      // Step 3: Get seal ID from vault and nonce
      // For now, use the static encryption Seal ID to match encryption
      const sealId = sealService.getEncryptionSealId()
      console.log('Seal ID:', sealId)

      // Step 4: Check vault ownership and find ReadOnlyCap
      setStatus('Checking access permissions...')
      
      const vaultInfo = await contractService.getDataVaultInfo(suiClient, vaultId)
      if (!vaultInfo) {
        throw new Error('Vault not found')
      }
      
      // Check if current user is the owner
      if (vaultInfo.owner !== currentAccount.address) {
        throw new Error('You are not the owner of this vault')
      }
      
      // Find ReadOnlyCap for this vault owned by the user
      setStatus('Finding access capability...')

      const vault = vaults.find(v => v.vaultId === vaultId)
      if (!vault) {
        setError('Category not found')
        return
      }

      const tx = await contractService.buildCreateDataVaultAllowListTx({
        vaultCapId: vault.vaultCapId,
        vaultId: vault.vaultId,
        accessAddress: currentAccount.address,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      })

      await signAndExecuteTransaction({
        transaction: tx as any,
      })
      
      setStatus('Creating session key (please sign message)...')
      
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: SEAL_PACKAGE_ID,
        ttlMin: 30,
        suiClient,
      })

      // Sign personal message
      setStatus('Please sign message in your wallet...')
      const personalMessage = newSessionKey.getPersonalMessage()
      const signature = await signPersonalMessage(personalMessage)
      await newSessionKey.setPersonalMessageSignature(signature)
      console.log('SessionKey created and signed')

      // Step 6: Decrypt using SealService (参考 SealTest.tsx handleManualDecrypt)
      setStatus('Decrypting content...')
      
      console.log('Decryption parameters:', {
        encryptedBlobLength: encryptedBlob.length,
        sealId: sealId,
        vaultId: vaultId,
        itemId: itemId,
        accessAddress: currentAccount.address,
      })

      const decryptedBytes = await sealService.decrypt(
        encryptedBlob as Uint8Array<ArrayBuffer>,
        newSessionKey,
        sealId,
        vaultId,
        itemId,
        currentAccount.address
      )

      console.log('Decrypted successfully, size:', decryptedBytes.length)

      // Step 7: Parse content
      const contentJson = new TextDecoder().decode(decryptedBytes)
      const contentData = JSON.parse(contentJson)

      console.log('Content data:', contentData)

      setViewingContent({
        type: contentData.type,
        content: contentData.content,
        mimeType: contentData.mimeType,
        fileName: contentData.fileName,
      })

      setStatus('✅ Content loaded successfully!')
      
    } catch (err: any) {
      console.error('View item error:', err)
      const errorMsg = err?.message || err?.toString() || 'Failed to load item'
      setError(`Failed to load item: ${errorMsg}`)
      setStatus('❌ Failed to load item')
    } finally {
      setLoadingContent(false)
    }
  }

  // Initialize personal information vault if not exists
  const handleInitializePersonalInfo = async () => {
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    // Check if personal info vault already exists
    const hasPersonalInfo = vaults.some(
      v => v.groupName === 'Personal Information'
    )

    if (hasPersonalInfo) {
      setError('Personal Information category already exists')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Creating Personal Information category...')

    try {
      const tx = contractService.buildCreateDataVaultTx({
        groupName: 'Personal Information',
      })

      await signAndExecuteTransaction({
        transaction: tx as any,
      })

      setStatus('✅ Personal Information category created!')
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to create category'
      setError(`Failed to create category: ${errorMsg}`)
      setStatus('❌ Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <Header
        title="My Data"
        backTo="/"
        backLabel="Back"
        rightLink={{
          to: '/bowheadwhale/thirdparty-service',
          label: 'Service Registration',
        }}
      />

      <div className="page-content">
        {/* User Guide */}
        <div className="info-box">
          <h3>Registration Guide</h3>
          <ul>
            <li>Each category (DataVault) represents a group of related data items</li>
            <li>Your data will be encrypted using <strong>Seal</strong> and stored on <strong>Walrus</strong> decentralized storage</li>
            <li>Only you can access and view this information</li>
            <li>After creating a category, you can add multiple data items to it</li>
            <li>Currently, only text content is supported. Image support will be added in the future</li>
          </ul>
        </div>

        {!isConnected ? (
          <div className="wallet-section">
            <p>Please connect your wallet to view and manage your data</p>
            <p style={{ fontSize: '0.875rem', color: '#86868b', marginTop: '0.5rem' }}>
              Use the connect button in the header to connect your wallet.
            </p>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '2rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowCreateVaultModal(true)}
                className="btn btn-primary"
                style={{ flex: '1', minWidth: '150px' }}
              >
                ➕ New Category
              </button>
              {vaults.length === 0 && (
                <button
                  onClick={handleInitializePersonalInfo}
                  className="btn btn-secondary"
                disabled={loading}
                >
                  📋 Initialize Personal Information
                </button>
              )}
            </div>

            {/* Vaults list */}
            {vaults.length === 0 ? (
              <div className="info-box" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                <h3 style={{ marginBottom: '0.5rem' }}>No Data Categories Yet</h3>
                <p style={{ color: '#86868b', marginBottom: '1.5rem' }}>
                  Create your first category to start managing your data
                </p>
                <button
                  onClick={handleInitializePersonalInfo}
                  className="btn btn-primary"
                disabled={loading}
              >
                  Create "Personal Information" Category
                </button>
              </div>
            ) : (
              <div className="vaults-list">
                {vaults.map((vault) => (
                  <div key={vault.vaultId} className="vault-card">
                    <div className="vault-header">
                      <div className="vault-title-section">
                        <h3 className="vault-title">{vault.groupName}</h3>
                        <span className="vault-item-count">
                          {vault.items.length} {vault.items.length === 1 ? 'item' : 'items'}
                        </span>
            </div>
                      <button
                        onClick={() => {
                          setSelectedVault(vault.vaultId)
                          setShowAddItemModal(true)
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        ➕ Add Data
                      </button>
            </div>

                    {vault.items.length === 0 ? (
                      <div className="vault-empty">
                        <p>This category has no data yet</p>
            <button
                          onClick={() => {
                            setSelectedVault(vault.vaultId)
                            setShowAddItemModal(true)
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}
                        >
                          Add First Item
            </button>
                      </div>
                    ) : (
                      <div className="vault-items">
                        {vault.items.map((item) => (
                          <div
                            key={item.id}
                            className="vault-item"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedItem({
                                vaultId: vault.vaultId,
                                itemId: item.id,
                                name: item.name,
                              })
                              setShowViewItemModal(true)
                              handleViewItem(vault.vaultId, item.id)
                            }}
                          >
                            <div className="vault-item-header">
                              <h4 className="vault-item-name">{item.name}</h4>
                              <span className="vault-item-type">
                                {item.shareType === 0 ? 'View' : item.shareType === 1 ? 'Edit' : 'Delete'}
                              </span>
                            </div>
                            <div className="vault-item-meta">
                              <span className="vault-item-id">
                                {item.contentType === 'image' ? '🖼️ Image' : item.contentType === 'text' ? '📝 Text' : '📄 Data'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status and error messages */}
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
          </>
        )}

        {/* Create Vault Modal */}
        {showCreateVaultModal && (
          <div className="modal-overlay" onClick={() => setShowCreateVaultModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>New Category</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowCreateVaultModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <strong>Category Name *</strong>
                  </label>
                  <input
                    type="text"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="e.g., Work Notes, Personal Photos, etc."
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowCreateVaultModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateVault}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading || !newVaultName.trim()}
                  >
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Item Modal */}
        {showAddItemModal && selectedVault && (
          <div className="modal-overlay" onClick={() => setShowAddItemModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Data</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowAddItemModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <strong>Item Name *</strong>
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g., Email Address, Phone Number, Photo, etc."
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>
                    <strong>Content Type *</strong>
                  </label>
                  <select
                    value={newItemType}
                    onChange={(e) => {
                      setNewItemType(e.target.value as 'text' | 'image')
                      setNewItemContent('')
                      setSelectedImage(null)
                      setImagePreview(null)
                    }}
                    disabled={loading}
                  >
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                {newItemType === 'text' ? (
                  <div className="form-group">
                    <label>
                      <strong>Content *</strong>
                    </label>
                    <textarea
                      value={newItemContent}
                      onChange={(e) => setNewItemContent(e.target.value)}
                      placeholder="Enter data content..."
                      rows={6}
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>
                      <strong>Image *</strong>
                      <span className="form-hint">(Max 10MB, supports JPG, PNG, GIF, etc.)</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1.5px solid #d2d2d7',
                        borderRadius: '12px',
                        fontSize: '0.9375rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    />
                    {imagePreview && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        border: '1px solid #e5e5e7'
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#86868b', marginBottom: '0.5rem' }}>
                          Preview:
                        </p>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            objectFit: 'contain'
                          }}
                        />
                        {selectedImage && (
                          <p style={{
                            fontSize: '0.75rem',
                            color: '#86868b',
                            marginTop: '0.5rem',
                            marginBottom: 0
                          }}>
                            File: {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="form-group">
                  <label>
                    <strong>Share Permission</strong>
                  </label>
                  <select
                    value={newItemShareType}
                    onChange={(e) => setNewItemShareType(Number(e.target.value))}
                    disabled={loading}
                  >
                    <option value={0}>View</option>
                    <option value={1}>Edit</option>
                    <option value={2}>Delete</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowAddItemModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddItem}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading || !newItemName.trim() || (newItemType === 'text' && !newItemContent.trim()) || (newItemType === 'image' && !selectedImage)}
                  >
                    {loading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Item Modal */}
        {showViewItemModal && selectedItem && (
          <div className="modal-overlay" onClick={() => {
            setShowViewItemModal(false)
            setSelectedItem(null)
            setViewingContent(null)
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2>{selectedItem.name}</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowViewItemModal(false)
                    setSelectedItem(null)
                    setViewingContent(null)
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {loadingContent ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>Loading content...</p>
                  </div>
                ) : viewingContent ? (
                  <div>
                    {viewingContent.type === 'text' ? (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          <strong>Text Content:</strong>
                        </label>
                        <div style={{
                          padding: '1rem',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e7',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {viewingContent.content}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          <strong>Image:</strong>
                          {viewingContent.fileName && (
                            <span style={{ fontSize: '0.875rem', color: '#86868b', marginLeft: '0.5rem' }}>
                              {viewingContent.fileName}
                            </span>
                          )}
                        </label>
                        <div style={{
                          padding: '1rem',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e7',
                          textAlign: 'center'
                        }}>
                          <img
                            src={`data:${viewingContent.mimeType || 'image/png'};base64,${viewingContent.content}`}
                            alt={viewingContent.fileName || 'Image'}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '500px',
                              borderRadius: '8px',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: '#86868b' }}>No content to display</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
