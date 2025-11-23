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
    blobObjectId?: string | null  // Sui Object ID for deletion
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
  const [showUpdateItemModal, setShowUpdateItemModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteVaultConfirm, setShowDeleteVaultConfirm] = useState(false)
  const [showBasicInfoModal, setShowBasicInfoModal] = useState(false)
  const [selectedVault, setSelectedVault] = useState<string | null>(null)
  const [selectedVaultForDelete, setSelectedVaultForDelete] = useState<{
    vaultId: string
    vaultCapId: string
    groupName: string
  } | null>(null)
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
  
  // Update form states
  const [updateItemContent, setUpdateItemContent] = useState('')
  const [updateItemType, setUpdateItemType] = useState<'text' | 'image'>('text')
  const [updateSelectedImage, setUpdateSelectedImage] = useState<File | null>(null)
  const [updateImagePreview, setUpdateImagePreview] = useState<string | null>(null)
  
  // Form states
  const [newVaultName, setNewVaultName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemContent, setNewItemContent] = useState('')
  const [newItemType, setNewItemType] = useState<'text' | 'image'>('text')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Basic info form states (for first-time users)
  const [showBasicInfoForm, setShowBasicInfoForm] = useState(false)
  const [basicName, setBasicName] = useState('')
  const [basicEmail, setBasicEmail] = useState('')
  const [basicGender, setBasicGender] = useState('')
  
  // Basic info modal states (for editing existing basic info)
  const [basicInfoModalData, setBasicInfoModalData] = useState<{
    name: string
    email: string
    gender: string
    vaultId: string
    vaultCapId: string
    itemId: string
  } | null>(null)

  // Fetch user's vaults and items
  const fetchUserVaults = async (): Promise<DataVaultWithItems[] | null> => {
    if (!isConnected || !currentAccount) return null

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

      // If no vault caps found, show basic info form
      if (vaultCaps.length === 0) {
        setShowBasicInfoForm(true)
        setVaults([])
        setStatus('')
        return []
      }

      // Hide basic info form if vaults exist
      setShowBasicInfoForm(false)

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
                // Try to get blobObjectId from localStorage
                const storedBlobObjectId = localStorage.getItem(`blobObjectId_${item.id}`)
                items.push({
                  id: item.id,
                  name: item.name,
                  shareType: item.shareType,
                  walrusBlobId: item.value,
                  blobObjectId: storedBlobObjectId || null, // Get from localStorage if available
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

      // Filter out "Basic" vault from display (it will be shown in a separate modal)
      const displayVaults = vaultsData.filter(v => v.groupName !== 'Basic')
      setVaults(displayVaults)
      setStatus('')
      console.log('Loaded vaults:', vaultsData)
      return vaultsData // Return all vaults including Basic for internal use
    } catch (err: any) {
      console.error('Error fetching vaults:', err)
      setError(`Failed to load vaults: ${err.message}`)
      setStatus('')
      return null
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

      const maxRetries = 5
      const retryDelay = 2000 // 2 seconds
      let vault: DataVaultWithItems | undefined = undefined
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const fetchedVaults = await fetchUserVaults()
        console.log(`Fetch attempt ${attempt}/${maxRetries}, Vaults:`, fetchedVaults)
        
        // Use the returned data directly instead of state
        if (fetchedVaults && fetchedVaults.length > 0) {
          vault = fetchedVaults.find(v => v.groupName === newVaultName.trim())
          if (vault) break
        }
      }

      if (!vault) {
        throw new Error('Vault not found after multiple attempts. Please refresh the page and try again.')
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
      const { blobId, blobObjectId } = await walrusApiService.uploadToWalrus({
        encryptedData: encryptedObject,
        deletable: true,
        epochs: 3,
      })
      
      console.log('Upload result:', { blobId, blobObjectId })

      // Generate nonce
      const nonce = new Uint8Array(16)
      crypto.getRandomValues(nonce)

      // Create Data item
      setStatus('Saving item...')
      const tx = contractService.buildCreateDataEntryTx({
        vaultCapId: vault.vaultCapId,
        vaultId: vault.vaultId,
        name: newItemName.trim(),
        shareType: 0,
        walrusBlobId: blobId,
        nonce,
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Item creation result:', result)
      
      // Store blobObjectId mapping in localStorage for deletion support
      // Key: itemId, Value: blobObjectId
      if (blobObjectId) {
        const resultAny = result as any
        const { created } = contractService.extractObjectIds(resultAny, 'Data')
        if (created.length > 0) {
          const itemId = created[0]
          localStorage.setItem(`blobObjectId_${itemId}`, blobObjectId)
          console.log('Stored blobObjectId mapping:', { itemId, blobObjectId })
        }
      }

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

      // Check if current user's address is already in the allow list
      setStatus('Checking allow list...')
      // const allowList = await contractService.getDataVaultAllowListInfo(suiClient, vaultId)
      // const currentTime = Date.now()
      // const userInAllowList = allowList?.some(entry => 
      //   entry.address === currentAccount.address && 
      //   entry.expiresAt > currentTime
      // )

      // Only add to allow list if not already present or expired
      // if (!userInAllowList) {
      //   setStatus('Adding address to allow list...')
      //   const tx = await contractService.buildCreateDataVaultAllowListTx({
      //     vaultCapId: vault.vaultCapId,
      //     vaultId: vault.vaultId,
      //     accessAddress: currentAccount.address,
      //     allowType: 0,
      //     expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      //   })

      //   await signAndExecuteTransaction({
      //     transaction: tx as any,
      //   })
      //   console.log('Address added to allow list')
      // } else {
      //   console.log('Address already in allow list, skipping add')
      // }
      
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
        currentAccount.address,
        0,
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

  // Delete item
  const handleDeleteItem = async () => {
    if (!isConnected || !currentAccount || !selectedItem) {
      setError('Please connect your wallet first')
      return
    }

    const vault = vaults.find(v => v.vaultId === selectedItem.vaultId)
    if (!vault) {
      setError('Category not found')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Deleting item...')

    try {
      // Get current item info to get old blob ID
      const itemInfo = await contractService.getDataInfo(suiClient, selectedItem.itemId)
      if (!itemInfo) {
        throw new Error('Item not found')
      }

      // Delete from contract
      const tx = contractService.buildDeleteDataEntryTx({
        vaultCapId: vault.vaultCapId,
        vaultId: vault.vaultId,
        itemId: selectedItem.itemId,
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Item deletion result:', result)

      // Optionally delete blob from Walrus
      // Try to get blobObjectId from localStorage first, then fallback to blobId
      try {
        if (itemInfo.value) {
          // Try to get blobObjectId from localStorage
          const storedBlobObjectId = localStorage.getItem(`blobObjectId_${selectedItem.itemId}`)
          const blobObjectId = storedBlobObjectId || itemInfo.value
          
          // Check if it's a valid Sui Object ID (starts with 0x and 64 hex chars)
          const isSuiObjectId = /^0x[a-fA-F0-9]{64}$/.test(blobObjectId)
          
          if (isSuiObjectId) {
            await walrusApiService.deleteBlob(blobObjectId)
            console.log('Old blob deleted from Walrus using blobObjectId')
            // Clean up localStorage mapping
            localStorage.removeItem(`blobObjectId_${selectedItem.itemId}`)
          } else {
            console.warn('No valid blobObjectId found, skipping Walrus blob deletion. BlobId:', itemInfo.value)
            console.warn('Note: For new uploads, blobObjectId will be stored automatically.')
          }
        }
      } catch (blobError) {
        console.warn('Failed to delete blob from Walrus (non-critical):', blobError)
        // Don't fail the entire operation if blob deletion fails
      }

      setStatus('✅ Item deleted successfully!')
      setShowDeleteConfirm(false)
      setShowViewItemModal(false)
      setSelectedItem(null)
      setViewingContent(null)
      
      // Refresh vaults list
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to delete item'
      setError(`Failed to delete item: ${errorMsg}`)
      setStatus('❌ Failed to delete item')
      console.error('Delete item error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Open update modal
  const handleOpenUpdateModal = () => {
    if (!viewingContent) return
    
    setUpdateItemType(viewingContent.type)
    if (viewingContent.type === 'text') {
      setUpdateItemContent(viewingContent.content)
    } else {
      // For images, we keep the base64 content
      setUpdateItemContent(viewingContent.content)
    }
    setUpdateSelectedImage(null)
    setUpdateImagePreview(null)
    setError(null)
    setShowUpdateItemModal(true)
  }

  // Handle image selection for update
  const handleUpdateImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB')
      return
    }

    setUpdateSelectedImage(file)
    setError(null)

    const reader = new FileReader()
    reader.onloadend = () => {
      setUpdateImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Update item
  const handleUpdateItem = async () => {
    if (!isConnected || !currentAccount || !selectedItem) {
      setError('Please connect your wallet first')
      return
    }

    if (updateItemType === 'text' && !updateItemContent.trim()) {
      setError('Please enter content')
      return
    }

    // For image type, if no new image selected, we'll keep the existing content
    // The updateItemContent should already contain the existing base64 image

    const vault = vaults.find(v => v.vaultId === selectedItem.vaultId)
    if (!vault) {
      setError('Category not found')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Updating item...')

    try {
      // Get current item info to get old blob ID
      const itemInfo = await contractService.getDataInfo(suiClient, selectedItem.itemId)
      if (!itemInfo) {
        throw new Error('Item not found')
      }

      let contentData: any

      if (updateItemType === 'text') {
        // Prepare text content
        contentData = {
          type: 'text',
          content: updateItemContent.trim(),
          updatedAt: new Date().toISOString(),
        }
        } else {
          // Prepare image content
          setStatus('Processing image...')
          
          if (updateSelectedImage) {
            // New image selected
            const imageBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64String = reader.result as string
                const base64Data = base64String.split(',')[1]
                resolve(base64Data)
              }
              reader.onerror = reject
              reader.readAsDataURL(updateSelectedImage)
            })

            contentData = {
              type: 'image',
              content: imageBase64,
              mimeType: updateSelectedImage.type,
              fileName: updateSelectedImage.name,
              fileSize: updateSelectedImage.size,
              updatedAt: new Date().toISOString(),
            }
          } else {
            // Keep existing image (updateItemContent already contains the base64)
            contentData = {
              type: 'image',
              content: updateItemContent,
              mimeType: viewingContent?.mimeType,
              fileName: viewingContent?.fileName,
              updatedAt: new Date().toISOString(),
            }
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
      const { blobId: newBlobId, blobObjectId: newBlobObjectId } = await walrusApiService.uploadToWalrus({
        encryptedData: encryptedObject,
        deletable: true,
        epochs: 3,
      })
      
      console.log('Update upload result:', { newBlobId, newBlobObjectId })

      // Get old blobObjectId BEFORE updating (so we can delete it later)
      const oldBlobObjectId = localStorage.getItem(`blobObjectId_${selectedItem.itemId}`)
      console.log('Old blobObjectId from localStorage:', oldBlobObjectId)

      // Update contract
      setStatus('Updating contract...')
      const tx = contractService.buildUpdateDataEntryTx({
        vaultCapId: vault.vaultCapId,
        vaultId: vault.vaultId,
        itemId: selectedItem.itemId,
        newBlobId,
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Item update result:', result)
      
      // Store new blobObjectId mapping (AFTER getting old one)
      if (newBlobObjectId) {
        localStorage.setItem(`blobObjectId_${selectedItem.itemId}`, newBlobObjectId)
        console.log('Stored new blobObjectId mapping:', { itemId: selectedItem.itemId, blobObjectId: newBlobObjectId })
      }

      // Optionally delete old blob from Walrus
      try {
        if (itemInfo.value && itemInfo.value !== newBlobId) {
          // Use the old blobObjectId we saved before updating
          const blobObjectIdToDelete = oldBlobObjectId || itemInfo.value
          
          // Check if it's a valid Sui Object ID
          const isSuiObjectId = /^0x[a-fA-F0-9]{64}$/.test(blobObjectIdToDelete)
          
          if (isSuiObjectId && oldBlobObjectId) {
            // Only delete if we have a valid old blobObjectId
            await walrusApiService.deleteBlob(blobObjectIdToDelete)
            console.log('Old blob deleted from Walrus using blobObjectId:', blobObjectIdToDelete)
          } else {
            console.warn('No valid blobObjectId for old blob, skipping deletion. Old BlobId:', itemInfo.value, 'Old blobObjectId:', oldBlobObjectId)
          }
        }
      } catch (blobError) {
        console.warn('Failed to delete old blob from Walrus (non-critical):', blobError)
        // Don't fail the entire operation if blob deletion fails
      }

      setStatus('✅ Item updated successfully!')
      setShowUpdateItemModal(false)
      setUpdateItemContent('')
      setUpdateItemType('text')
      setUpdateSelectedImage(null)
      setUpdateImagePreview(null)
      
      // Refresh vaults list
      await fetchUserVaults()
      
      // Wait a bit for the new blob to be distributed to aggregator before trying to read it
      // Note: This is a workaround - in production, you might want to poll or use a better approach
      setStatus('Waiting for blob distribution...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      
      // Try to reload content, but don't fail if it's not ready yet
      if (selectedItem) {
        try {
          await handleViewItem(selectedItem.vaultId, selectedItem.itemId)
        } catch (viewError) {
          console.warn('Failed to reload content immediately after update (blob may not be distributed yet):', viewError)
          setStatus('✅ Item updated successfully! (Content may take a moment to be available)')
          // Clear viewing content so user can manually refresh
          setViewingContent(null)
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to update item'
      setError(`Failed to update item: ${errorMsg}`)
      setStatus('❌ Failed to update item')
      console.error('Update item error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete vault
  const handleDeleteVault = async () => {
    if (!isConnected || !currentAccount || !selectedVaultForDelete) {
      setError('Please connect your wallet first')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Deleting vault...')

    try {
      // Check if vault is empty
      const vaultInfo = await contractService.getDataVaultInfo(suiClient, selectedVaultForDelete.vaultId)
      if (!vaultInfo) {
        throw new Error('Vault not found')
      }

      if (vaultInfo.items.length > 0) {
        throw new Error('Cannot delete vault: Please delete all items first')
      }

      // Delete vault
      const tx = contractService.buildDeleteDataVaultTx({
        vaultCapId: selectedVaultForDelete.vaultCapId,
        vaultId: selectedVaultForDelete.vaultId,
      })

      const result = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Vault deletion result:', result)

      setStatus('✅ Vault deleted successfully!')
      setShowDeleteVaultConfirm(false)
      setSelectedVaultForDelete(null)
      
      // Refresh vaults list
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to delete vault'
      setError(`Failed to delete vault: ${errorMsg}`)
      setStatus('❌ Failed to delete vault')
      console.error('Delete vault error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load basic info for editing
  const handleLoadBasicInfo = async () => {
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Loading basic information...')

    try {
      const allVaults = await fetchUserVaults()
      if (!allVaults) {
        throw new Error('Failed to fetch vaults')
      }

      const basicVault = allVaults.find(v => v.groupName === 'Basic')
      if (!basicVault) {
        throw new Error('Basic vault not found')
      }

      // Find the "Basic Info" item
      const basicInfoItem = basicVault.items.find(item => item.name === 'Basic Info')
      if (!basicInfoItem) {
        throw new Error('Basic Info item not found')
      }

      // Load and decrypt the content
      setStatus('Loading basic info content...')
      const itemInfo = await contractService.getDataInfo(suiClient, basicInfoItem.id)
      if (!itemInfo) {
        throw new Error('Item not found')
      }

      // Get encrypted blob from Walrus
      const { data: encryptedBlob } = await walrusApiService.readFromWalrus(itemInfo.value)

      // Create session key for decryption
      const vaultInfo = await contractService.getDataVaultInfo(suiClient, basicVault.vaultId)
      if (!vaultInfo) {
        throw new Error('Vault not found')
      }

      // Check allow list and create if needed
      // const allowList = await contractService.getDataVaultAllowListInfo(suiClient, basicVault.vaultId)
      // const currentTime = Date.now()
      // const userInAllowList = allowList?.some(entry => 
      //   entry.address === currentAccount.address && 
      //   entry.expiresAt > currentTime
      // )

      // if (!userInAllowList) {
      //   setStatus('Adding address to allow list...')
      //   const tx = await contractService.buildCreateDataVaultAllowListTx({
      //     vaultCapId: basicVault.vaultCapId,
      //     vaultId: basicVault.vaultId,
      //     accessAddress: currentAccount.address,
      //     allowType: 0,
      //     expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      //   })
      //   await signAndExecuteTransaction({ transaction: tx as any })
      // }

      setStatus('Creating session key...')
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: SEAL_PACKAGE_ID,
        ttlMin: 30,
        suiClient,
      })

      const personalMessage = newSessionKey.getPersonalMessage()
      const signature = await signPersonalMessage(personalMessage)
      await newSessionKey.setPersonalMessageSignature(signature)

      // Decrypt content
      setStatus('Decrypting content...')
      const decryptedBytes = await sealService.decrypt(
        encryptedBlob as Uint8Array<ArrayBuffer>,
        newSessionKey,
        sealService.getEncryptionSealId(),
        basicVault.vaultId,
        basicInfoItem.id,
        currentAccount.address,
        0,
      )

      // Parse content
      const contentJson = new TextDecoder().decode(decryptedBytes)
      const contentData = JSON.parse(contentJson)
      const basicInfoJson = JSON.parse(contentData.content)

      setBasicInfoModalData({
        name: basicInfoJson.name || '',
        email: basicInfoJson.email || '',
        gender: basicInfoJson.gender || '',
        vaultId: basicVault.vaultId,
        vaultCapId: basicVault.vaultCapId,
        itemId: basicInfoItem.id,
      })

      setShowBasicInfoModal(true)
      setStatus('')
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to load basic information'
      setError(`Failed to load basic information: ${errorMsg}`)
      setStatus('❌ Failed to load basic information')
      console.error('Load basic info error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Update basic info
  const handleUpdateBasicInfo = async () => {
    if (!isConnected || !currentAccount || !basicInfoModalData) {
      setError('Please connect your wallet first')
      return
    }

    if (!basicInfoModalData.name.trim() || !basicInfoModalData.email.trim() || !basicInfoModalData.gender.trim()) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Updating basic information...')

    try {
      // Prepare JSON content
      const basicInfoData = {
        name: basicInfoModalData.name.trim(),
        email: basicInfoModalData.email.trim(),
        gender: basicInfoModalData.gender.trim(),
      }

      const contentData = {
        type: 'text',
        content: JSON.stringify(basicInfoData, null, 2),
        updatedAt: new Date().toISOString(),
      }

      const contentJson = JSON.stringify(contentData, null, 2)
      const contentBytes = new TextEncoder().encode(contentJson)

      // Encrypt content
      const encryptionSealId = sealService.getEncryptionSealId()
      const { encryptedObject } = await sealService.encrypt(encryptionSealId, contentBytes)

      // Upload to Walrus
      const { blobId: newBlobId, blobObjectId: newBlobObjectId } = await walrusApiService.uploadToWalrus({
        encryptedData: encryptedObject,
        deletable: true,
        epochs: 3,
      })

      // Get old blobObjectId before updating
      const oldBlobObjectId = localStorage.getItem(`blobObjectId_${basicInfoModalData.itemId}`)

      // Update contract
      const tx = contractService.buildUpdateDataEntryTx({
        vaultCapId: basicInfoModalData.vaultCapId,
        vaultId: basicInfoModalData.vaultId,
        itemId: basicInfoModalData.itemId,
        newBlobId,
      })

      await signAndExecuteTransaction({
        transaction: tx as any,
      })

      // Store new blobObjectId
      if (newBlobObjectId) {
        localStorage.setItem(`blobObjectId_${basicInfoModalData.itemId}`, newBlobObjectId)
      }

      // Delete old blob
      if (oldBlobObjectId && /^0x[a-fA-F0-9]{64}$/.test(oldBlobObjectId)) {
        try {
          await walrusApiService.deleteBlob(oldBlobObjectId)
        } catch (blobError) {
          console.warn('Failed to delete old blob (non-critical):', blobError)
        }
      }

      setStatus('✅ Basic information updated successfully!')
      setShowBasicInfoModal(false)
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to update basic information'
      setError(`Failed to update basic information: ${errorMsg}`)
      setStatus('❌ Failed to update basic information')
      console.error('Update basic info error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle basic info submission (for first-time users)
  const handleSubmitBasicInfo = async () => {
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    if (!basicName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!basicEmail.trim()) {
      setError('Please enter your email')
      return
    }

    if (!basicGender.trim()) {
      setError('Please select your gender')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Creating basic information...')

    try {
      // Step 1: Create "Basic" vault
      setStatus('Creating Basic category...')
      const vaultTx = contractService.buildCreateDataVaultTx({
        groupName: 'Basic',
      })

      const vaultResult = await signAndExecuteTransaction({
        transaction: vaultTx as any,
      })

      // Wait for transaction to be indexed on chain
      setStatus('Waiting for transaction to be indexed...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      
      // Retry fetching vaults with timeout
      setStatus('Fetching vault information...')
      let vault: DataVaultWithItems | undefined = undefined
      const maxRetries = 5
      const retryDelay = 2000 // 2 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const fetchedVaults = await fetchUserVaults()
        console.log(`Fetch attempt ${attempt}/${maxRetries}, Vaults:`, fetchedVaults)
        
        // Use the returned data directly instead of state
        if (fetchedVaults && fetchedVaults.length > 0) {
          vault = fetchedVaults.find(v => v.groupName === 'Basic')
          if (vault) {
            console.log('Found Basic vault:', vault)
            break
          }
        }
        
        if (attempt < maxRetries) {
          console.log(`Vault not found yet, waiting ${retryDelay}ms before retry...`)
          setStatus(`Waiting for vault to be available... (${attempt}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
      
      if (!vault) {
        throw new Error('Vault not found after multiple attempts. Please refresh the page and try again.')
      }

      const vaultId = vault.vaultId
      const vaultCapId = vault.vaultCapId

      // Step 2: Create a single data item containing all basic info as JSON
      setStatus('Adding basic information...')

      // Prepare JSON content with all three fields
      const basicInfoData = {
        name: basicName.trim(),
        email: basicEmail.trim(),
        gender: basicGender.trim(),
      }

      // Wrap in content data structure
      const contentData = {
        type: 'text',
        content: JSON.stringify(basicInfoData, null, 2),
        createdAt: new Date().toISOString(),
      }

      const contentJson = JSON.stringify(contentData, null, 2)
      const contentBytes = new TextEncoder().encode(contentJson)

      // Encrypt content
      const encryptionSealId = sealService.getEncryptionSealId()
      const { encryptedObject } = await sealService.encrypt(encryptionSealId, contentBytes)

      // Upload to Walrus
      const { blobId, blobObjectId } = await walrusApiService.uploadToWalrus({
        encryptedData: encryptedObject,
        deletable: true,
        epochs: 3,
      })

      const nonce = new Uint8Array(16)

      // Create Data item with name "Basic Info"
      const itemTx = contractService.buildCreateDataEntryTx({
        vaultCapId,
        vaultId,
        name: 'Basic Info',
        shareType: 0,
        walrusBlobId: blobId,
        nonce,
      })

      const itemResult = await signAndExecuteTransaction({
        transaction: itemTx as any,
      })

      // Store blobObjectId mapping
      if (blobObjectId) {
        const itemResultAny = itemResult as any
        const { created: createdItems } = contractService.extractObjectIds(itemResultAny, 'Data')
        if (createdItems.length > 0) {
          const itemId = createdItems[0]
          localStorage.setItem(`blobObjectId_${itemId}`, blobObjectId)
        }
      }

      setStatus('✅ Basic information created successfully!')
      setShowBasicInfoForm(false)
      setBasicName('')
      setBasicEmail('')
      setBasicGender('')
      
      // Refresh vaults list
      await fetchUserVaults()
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to create basic information'
      setError(`Failed to create basic information: ${errorMsg}`)
      setStatus('❌ Failed to create basic information')
      console.error('Create basic info error:', err)
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
        onAccountClick={handleLoadBasicInfo}
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
            {/* Action buttons - Hide when showing basic info form */}
            {!showBasicInfoForm && (
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
              </div>
            )}

            {/* Basic Info Form (for first-time users) */}
            {showBasicInfoForm ? (
              <div className="info-box" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Welcome to Bowhead Whale</h3>
                  <p style={{ color: '#86868b' }}>
                    Let's start by adding your basic information
                  </p>
                </div>

                <div className="form-group">
                  <label>
                    <strong>Name *</strong>
                  </label>
                  <input
                    type="text"
                    value={basicName}
                    onChange={(e) => setBasicName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>
                    <strong>Email *</strong>
                  </label>
                  <input
                    type="email"
                    value={basicEmail}
                    onChange={(e) => setBasicEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <strong>Gender *</strong>
                  </label>
                  <select
                    value={basicGender}
                    onChange={(e) => setBasicGender(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={handleSubmitBasicInfo}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading || !basicName.trim() || !basicEmail.trim() || !basicGender.trim()}
                  >
                    {loading ? 'Creating...' : 'Create Basic Information'}
                  </button>
                </div>
              </div>
            ) : vaults.length === 0 ? (
              <div className="info-box" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                <h3 style={{ marginBottom: '0.5rem' }}>No Data Categories Yet</h3>
                <p style={{ color: '#86868b', marginBottom: '1.5rem' }}>
                  Create your first category to start managing your data
                </p>
                <button
                  onClick={() => setShowCreateVaultModal(true)}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  ➕ New Category
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                        <button
                          onClick={() => {
                            setSelectedVaultForDelete({
                              vaultId: vault.vaultId,
                              vaultCapId: vault.vaultCapId,
                              groupName: vault.groupName,
                            })
                            setShowDeleteVaultConfirm(true)
                          }}
                          className="btn btn-secondary"
                          style={{ 
                            fontSize: '0.875rem', 
                            padding: '0.5rem 1rem',
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                            color: '#ff3b30',
                            border: '1px solid rgba(255, 59, 48, 0.3)'
                          }}
                          title="Delete vault"
                        >
                          🗑️
                        </button>
                      </div>
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
                            style={{ cursor: 'pointer', position: 'relative' }}
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
                            </div>
                            <div className="vault-item-meta">
                              <span className="vault-item-id">
                                {item.contentType === 'image' ? '🖼️ Image' : item.contentType === 'text' ? '📝 Text' : '📄 Data'}
                              </span>
                            </div>
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation() // Prevent triggering item click
                                setSelectedItem({
                                  vaultId: vault.vaultId,
                                  itemId: item.id,
                                  name: item.name,
                                })
                                setShowDeleteConfirm(true)
                              }}
                              style={{
                                position: 'absolute',
                                bottom: '0.5rem',
                                right: '0.5rem',
                                padding: '0.25rem',
                                fontSize: '0.875rem',
                                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                                color: '#ff3b30',
                                border: '1px solid rgba(255, 59, 48, 0.3)',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                opacity: loading ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!loading) {
                                  e.currentTarget.style.backgroundColor = '#ff3b30'
                                  e.currentTarget.style.color = 'white'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!loading) {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)'
                                  e.currentTarget.style.color = '#ff3b30'
                                }
                              }}
                              disabled={loading}
                              title="Delete item"
                            >
                              🗑️
                            </button>
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
              {/* Action buttons */}
              {viewingContent && !loadingContent && (
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #e5e5e7',
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn btn-secondary"
                    style={{ 
                      backgroundColor: '#ff3b30',
                      color: 'white',
                      border: 'none'
                    }}
                    disabled={loading}
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={handleOpenUpdateModal}
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    ✏️ Update
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Update Item Modal */}
        {showUpdateItemModal && selectedItem && viewingContent && (
          <div className="modal-overlay" onClick={() => setShowUpdateItemModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2>Update {selectedItem.name}</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowUpdateItemModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <strong>Content Type *</strong>
                  </label>
                  <select
                    value={updateItemType}
                    onChange={(e) => {
                      setUpdateItemType(e.target.value as 'text' | 'image')
                      if (e.target.value === 'text') {
                        setUpdateSelectedImage(null)
                        setUpdateImagePreview(null)
                      }
                    }}
                    disabled={loading}
                  >
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                {updateItemType === 'text' ? (
                  <div className="form-group">
                    <label>
                      <strong>Content *</strong>
                    </label>
                    <textarea
                      value={updateItemContent}
                      onChange={(e) => setUpdateItemContent(e.target.value)}
                      placeholder="Enter data content..."
                      rows={6}
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>
                      <strong>Image *</strong>
                      <span className="form-hint">(Max 10MB, leave empty to keep current image)</span>
                    </label>
                    {updateImagePreview && (
                      <div style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        border: '1px solid #e5e5e7'
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#86868b', marginBottom: '0.5rem' }}>
                          New Preview:
                        </p>
                        <img
                          src={updateImagePreview}
                          alt="Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                    {!updateImagePreview && viewingContent.type === 'image' && (
                      <div style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        border: '1px solid #e5e5e7'
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#86868b', marginBottom: '0.5rem' }}>
                          Current Image:
                        </p>
                        <img
                          src={`data:${viewingContent.mimeType || 'image/png'};base64,${viewingContent.content}`}
                          alt="Current"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUpdateImageSelect}
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
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowUpdateItemModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateItem}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading || (updateItemType === 'text' && !updateItemContent.trim())}
                  >
                    {loading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2>Delete Item</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '1.5rem' }}>
                  Are you sure you want to delete <strong>{selectedItem.name}</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteItem}
                    className="btn btn-primary"
                    style={{ 
                      flex: 1,
                      backgroundColor: '#ff3b30',
                      color: 'white',
                      border: 'none'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic Info Edit Modal */}
        {showBasicInfoModal && basicInfoModalData && (
          <div className="modal-overlay" onClick={() => setShowBasicInfoModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2>Personal Information</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowBasicInfoModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <strong>Name *</strong>
                  </label>
                  <input
                    type="text"
                    value={basicInfoModalData.name}
                    onChange={(e) => setBasicInfoModalData({
                      ...basicInfoModalData,
                      name: e.target.value
                    })}
                    placeholder="Enter your name"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>
                    <strong>Email *</strong>
                  </label>
                  <input
                    type="email"
                    value={basicInfoModalData.email}
                    onChange={(e) => setBasicInfoModalData({
                      ...basicInfoModalData,
                      email: e.target.value
                    })}
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <strong>Gender *</strong>
                  </label>
                  <select
                    value={basicInfoModalData.gender}
                    onChange={(e) => setBasicInfoModalData({
                      ...basicInfoModalData,
                      gender: e.target.value
                    })}
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowBasicInfoModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateBasicInfo}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading || !basicInfoModalData.name.trim() || !basicInfoModalData.email.trim() || !basicInfoModalData.gender.trim()}
                  >
                    {loading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Vault Confirmation Modal */}
        {showDeleteVaultConfirm && selectedVaultForDelete && (
          <div className="modal-overlay" onClick={() => setShowDeleteVaultConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2>Delete Vault</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowDeleteVaultConfirm(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '1.5rem' }}>
                  Are you sure you want to delete the vault <strong>{selectedVaultForDelete.groupName}</strong>?
                </p>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#86868b' }}>
                  <strong>Note:</strong> The vault must be empty (no items) before it can be deleted. This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowDeleteVaultConfirm(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteVault}
                    className="btn btn-primary"
                    style={{ 
                      flex: 1,
                      backgroundColor: '#ff3b30',
                      color: 'white',
                      border: 'none'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Delete Vault'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
