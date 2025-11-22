import { Transaction } from '@mysten/sui/transactions'
import { SuiClient } from '@mysten/sui/client'
import { SEAL_PACKAGE_ID } from '../config'

/**
 * Contract Service
 * Handles all interactions with Move smart contracts
 */
export class ContractService {
  private packageId: string

  constructor(packageId: string = SEAL_PACKAGE_ID) {
    this.packageId = packageId
  }

  /**
   * Register an OAuth service
   */
  buildRegisterOAuthServiceTx(params: {
    clientId: string
    redirectUrl: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::oauth_service::register_oauth_service_entry`,
      arguments: [
        tx.pure.string(params.clientId),
        tx.pure.string(params.redirectUrl),
        tx.object('0x6'), // Clock
      ],
    })
    return tx
  }

  /**
   * Create an OAuth grant
   */
  buildCreateOAuthGrantTx(params: {
    clientId: string
    ownerAddress: string
    resourceIds: string[]
    expiresAt: number
    accessToken: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::oauth_service::create_oauth_grant_entry`,
      arguments: [
        tx.pure.string(params.clientId),
        tx.pure.address(params.ownerAddress),
        tx.pure.vector('address', params.resourceIds),
        tx.pure.u64(params.expiresAt),
        tx.pure.string(params.accessToken),
        tx.object('0x6'), // Clock
      ],
    })
    return tx
  }

  /**
   * Create a third-party OAuth capability
   */
  buildCreateThirdPartyOAuthCapTx(serviceId: string): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::oauth_service::create_third_party_oauth_cap_entry`,
      arguments: [tx.object(serviceId)],
    })
    return tx
  }

  /**
   * Create a read-only capability for a vault
   */
  buildCreateReadOnlyCapTx(params: {
    vaultId: string
    expiresAt: number
    serviceAddress: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::create_readonly_cap_entry`,
      arguments: [
        tx.object(params.vaultId),
        tx.pure.u64(params.expiresAt),
        tx.object('0x6'), // Clock
        tx.pure.address(params.serviceAddress),
      ],
    })
    return tx
  }

  /**
   * Create a DataVault
   */
  buildCreateDataVaultTx(params: {
    groupName: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::create_data_vault_entry`,
      arguments: [tx.pure.string(params.groupName)],
    })
    return tx
  }

  /**
   * Create a Data item in a DataVault
   */
  buildCreateDataEntryTx(params: {
    vaultCapId: string
    vaultId: string
    name: string
    walrusBlobId: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::create_data_entry`,
      arguments: [
        tx.object(params.vaultCapId),
        tx.object(params.vaultId),
        tx.pure.string(params.name),
        tx.pure.string(params.walrusBlobId),
      ],
    })
    return tx
  }

  /**
   * Update a Data item
   */
  buildUpdateDataEntryTx(params: {
    vaultCapId: string
    vaultId: string
    itemId: string
    newBlobId: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::update_data_entry`,
      arguments: [
        tx.object(params.vaultCapId),
        tx.object(params.vaultId),
        tx.object(params.itemId),
        tx.pure.string(params.newBlobId),
      ],
    })
    return tx
  }

  /**
   * Delete a Data item
   */
  buildDeleteDataEntryTx(params: {
    vaultCapId: string
    vaultId: string
    itemId: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::delete_data_entry`,
      arguments: [
        tx.object(params.vaultCapId),
        tx.object(params.vaultId),
        tx.object(params.itemId),
      ],
    })
    return tx
  }

  /**
   * Delete a DataVault
   * Requires the vault to be empty (no items)
   * Deletes the DataVaultCap, making the vault inaccessible
   */
  buildDeleteDataVaultTx(params: {
    vaultCapId: string
    vaultId: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::delete_data_vault_entry`,
      arguments: [
        tx.object(params.vaultCapId),
        tx.object(params.vaultId),
      ],
    })
    return tx
  }

  /**
   * Add an address to the DataVault allow list
   */
  buildCreateDataVaultAllowListTx(params: {
    vaultCapId: string
    vaultId: string
    accessAddress: string
    allowType: number
    expiresAt: number
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::create_data_vault_allow_list`,
      arguments: [
        tx.object(params.vaultCapId),
        tx.object(params.vaultId),
        tx.pure.address(params.accessAddress),
        tx.pure.u8(params.allowType),
        tx.pure.u64(params.expiresAt),
        tx.object('0x6'), // Clock
      ],
    })
    return tx
  }

  /**
   * Build seal_approve transaction bytes for owner access
   */
  buildSealApproveTx(params: {
    sealId: Uint8Array
    vaultId: string
    dataId: string
    readonlyCapId?: string
  }): Transaction {
    const tx = new Transaction()
    
    if (params.readonlyCapId) {
      // Use ReadOnlyCap for access
      tx.moveCall({
        target: `${this.packageId}::seal_private_data::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(params.sealId)),
          tx.object(params.vaultId),
          tx.object(params.dataId),
          tx.object(params.readonlyCapId),
        ],
      })
    } else {
      // Owner access (no cap needed, but we still need to build the transaction)
      tx.moveCall({
        target: `${this.packageId}::seal_private_data::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(params.sealId)),
          tx.object(params.vaultId),
          tx.object(params.dataId),
        ],
      })
    }
    
    return tx
  }

  /**
   * Build seal_approve_oauth transaction bytes for OAuth access
   */
  buildSealApproveOAuthTx(params: {
    sealId: Uint8Array
    vaultId: string
    dataId: string
    serviceId: string
    grantId: string
    oauthCapId: string
  }): Transaction {
    const tx = new Transaction()
    tx.moveCall({
      target: `${this.packageId}::seal_private_data::seal_approve_oauth`,
      arguments: [
        tx.pure.vector('u8', Array.from(params.sealId)),
        tx.object(params.vaultId),
        tx.object(params.dataId),
        tx.object(params.serviceId),
        tx.object(params.grantId),
        tx.object(params.oauthCapId),
        tx.object('0x6'), // Clock
      ],
    })
    return tx
  }

  /**
   * Get OAuth service information
   */
  async getOAuthServiceInfo(
    client: SuiClient,
    serviceId: string
  ): Promise<{
    id: string
    clientId: string
    owner: string
    redirectUrl: string
    resourceTypes: number[]
    createdAt: number
  } | null> {
    try {
      const object = await client.getObject({
        id: serviceId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        return {
          id: serviceId,
          clientId: fields.client_id || '',
          owner: fields.owner || '',
          redirectUrl: fields.redirect_url || '',
          resourceTypes: fields.resource_types || [],
          createdAt: fields.created_at || 0,
        }
      }
      return null
    } catch (error) {
      console.error('Error fetching OAuth service:', error)
      return null
    }
  }

  /**
   * Get OAuth grant information
   */
  async getOAuthGrantInfo(
    client: SuiClient,
    grantId: string
  ): Promise<{
    id: string
    clientId: string
    userAddress: string
    ownerAddress: string
    resourceIds: string[]
    createdAt: number
    expiresAt: number
    accessToken: string
  } | null> {
    try {
      const object = await client.getObject({
        id: grantId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        return {
          id: grantId,
          clientId: fields.client_id || '',
          userAddress: fields.user_address || '',
          ownerAddress: fields.owner_address || '',
          resourceIds: fields.resource_ids || [],
          createdAt: fields.created_at || 0,
          expiresAt: fields.expires_at || 0,
          accessToken: fields.access_token || '',
        }
      }
      return null
    } catch (error) {
      console.error('Error fetching OAuth grant:', error)
      return null
    }
  }

  /**
   * Get DataVault information
   */
  async getDataVaultInfo(
    client: SuiClient,
    vaultId: string
  ): Promise<{
    id: string
    owner: string
    groupName: string
    items: string[]
  } | null> {
    try {
      const object = await client.getObject({
        id: vaultId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        return {
          id: vaultId,
          owner: fields.owner || '',
          groupName: fields.group_name || '',
          items: fields.items || [],
        }
      }
      return null
    } catch (error) {
      console.error('Error fetching DataVault:', error)
      return null
    }
  }

  /**
   * Get allow list information for a DataVault
   * Reference: seal_private_data.move::get_allow_list_info
   * Returns the list of addresses with their access types and expiration times
   */
  async getDataVaultAllowListInfo(
    client: SuiClient,
    vaultId: string
  ): Promise<Array<{
    address: string
    allowType: number  // 0: View, 1: Edit
    expiresAt: number  // Expiration timestamp in milliseconds
  }> | null> {
    try {
      const object = await client.getObject({
        id: vaultId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        const allowAccessTo = fields.allow_access_to || []
        
        console.log('allow_access_to raw:', JSON.stringify(allowAccessTo, null, 2))
        console.log('First entry structure:', allowAccessTo[0])
        
        // Convert the array of AccessEntry objects to a typed array
        // AccessEntry may be stored in different formats:
        // 1. Direct struct: { address, allow_type, expires_at }
        // 2. With fields: { fields: { address, allow_type, expires_at } }
        // 3. With type only: { type: '...' } - need to check actual structure
        return allowAccessTo.map((entry: any, index: number) => {
          console.log(`Entry ${index}:`, entry)
          
          // Try different ways to access the fields
          let address = ''
          let allowType = 0
          let expiresAt = 0
          
          // Check if entry has fields property (nested structure)
          if (entry.fields) {
            address = entry.fields.address || ''
            allowType = entry.fields.allow_type || entry.fields.allowType || 0
            expiresAt = Number(entry.fields.expires_at || entry.fields.expiresAt || 0)
          } 
          // Check if fields are directly on entry
          else if (entry.address !== undefined) {
            address = entry.address || ''
            allowType = entry.allow_type || entry.allowType || 0
            expiresAt = Number(entry.expires_at || entry.expiresAt || 0)
          }
          // If entry only has type, log warning
          else if (entry.type) {
            console.warn(`Entry ${index} only has type field, cannot extract AccessEntry data:`, entry)
          }
          
          return {
            address,
            allowType,
            expiresAt,
          }
        }).filter(entry => entry.address !== '') // Filter out invalid entries
      }
      return null
    } catch (error) {
      console.error('Error fetching DataVault allow list:', error)
      return null
    }
  }

  /**
   * Get Data item information
   */
  async getDataInfo(
    client: SuiClient,
    dataId: string
  ): Promise<{
    id: string
    vaultId: string
    name: string
    shareType: number
    value: string // Walrus blob ID
    nonce: Uint8Array
  } | null> {
    try {
      const object = await client.getObject({
        id: dataId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        return {
          id: dataId,
          vaultId: fields.vault_id || '',
          name: fields.name || '',
          shareType: fields.share_type || 0,
          value: fields.value || '',
          nonce: new Uint8Array(fields.nonce || []),
        }
      }
      return null
    } catch (error) {
      console.error('Error fetching Data:', error)
      return null
    }
  }

  /**
   * Get allow list information for a Data item
   * Reference: seal_private_data.move::Data struct has allow_access_to field
   * Returns the list of addresses with their access types and expiration times
   */
  async getDataAllowListInfo(
    client: SuiClient,
    dataId: string
  ): Promise<Array<{
    address: string
    allowType: number  // 0: View, 1: Edit
    expiresAt: number  // Expiration timestamp in milliseconds
  }> | null> {
    try {
      const object = await client.getObject({
        id: dataId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (object.data?.content && 'fields' in object.data.content) {
        const fields = object.data.content.fields as any
        const allowAccessTo = fields.allow_access_to || []
        
        console.log('Data allow_access_to raw:', allowAccessTo)
        
        // Convert the array of AccessEntry objects to a typed array
        // AccessEntry may be stored as objects with fields property or directly as structs
        return allowAccessTo.map((entry: any) => {
          // Check if entry has fields (nested structure)
          const entryFields = entry.fields || entry
          
          return {
            address: entryFields.address || '',
            allowType: entryFields.allow_type || entryFields.allowType || 0,
            expiresAt: Number(entryFields.expires_at || entryFields.expiresAt || 0),
          }
        })
      }
      return null
    } catch (error) {
      console.error('Error fetching Data allow list:', error)
      return null
    }
  }

  /**
   * Batch get multiple Data items
   * Uses multiGetObjects for better performance when fetching multiple Data objects
   */
  async getBatchDataInfo(
    client: SuiClient,
    dataIds: string[]
  ): Promise<Array<{
    id: string
    vaultId: string
    name: string
    shareType: number
    value: string // Walrus blob ID
    nonce: Uint8Array
  } | null>> {
    try {
      if (dataIds.length === 0) {
        return []
      }

      console.log(`Batch fetching ${dataIds.length} Data objects`)

      const objects = await client.multiGetObjects({
        ids: dataIds,
        options: {
          showContent: true,
          showType: true,
        },
      })

      return objects.map((obj, index) => {
        if (obj.data?.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as any
          return {
            id: dataIds[index],
            vaultId: fields.vault_id || '',
            name: fields.name || '',
            shareType: fields.share_type || 0,
            value: fields.value || '',
            nonce: new Uint8Array(fields.nonce || []),
          }
        }
        return null
      })
    } catch (error) {
      console.error('Error batch fetching Data:', error)
      return []
    }
  }

  /**
   * Get all Data items from a specific DataVault
   * Returns full Data information including encrypted blob IDs
   */
  async getDataVaultAllItems(
    client: SuiClient,
    vaultId: string
  ): Promise<Array<{
    id: string
    vaultId: string
    name: string
    shareType: number
    value: string // Walrus blob ID
    nonce: Uint8Array
  }>> {
    try {
      // First, get the vault to get item IDs
      const vault = await this.getDataVaultInfo(client, vaultId)
      if (!vault || vault.items.length === 0) {
        console.log(`Vault ${vaultId} has no items`)
        return []
      }

      console.log(`Vault ${vaultId} has ${vault.items.length} items`)

      // Batch fetch all Data items
      const dataItems = await this.getBatchDataInfo(client, vault.items)

      // Filter out null results
      return dataItems.filter((item): item is NonNullable<typeof item> => item !== null)
    } catch (error) {
      console.error('Error fetching DataVault items:', error)
      return []
    }
  }

  /**
   * Build a PTB transaction to reference Data objects in a transaction
   * Note: This doesn't return data, it's used to build transactions that use Data objects
   * For reading data, use getDataInfo() or getBatchDataInfo() instead
   */
  buildReadDataTx(dataIds: string[]): Transaction {
    const tx = new Transaction()
    
    // Example: Reference Data objects in a transaction
    // This is useful when you need to pass Data objects to other Move functions
    dataIds.forEach((dataId) => {
      // Store the object reference for later use in the transaction
      tx.object(dataId)
    })

    // Note: You would need to add actual moveCall here based on your use case
    // This is just a template showing how to reference objects in PTB
    
    return tx
  }

  /**
   * Get all DataVaults owned by an address
   */
  async getUserDataVaults(
    client: SuiClient,
    ownerAddress: string
  ): Promise<string[]> {
    try {
      const ownedObjects = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::seal_private_data::DataVault`,
        },
        options: {
          showContent: false,
        },
      })

      return ownedObjects.data
        .map((obj) => obj.data?.objectId)
        .filter((id): id is string => Boolean(id))
    } catch (error) {
      console.error('Error fetching user DataVaults:', error)
      return []
    }
  }

  /**
   * Get all Data items in a DataVault
   */
  async getDataVaultItems(
    client: SuiClient,
    vaultId: string
  ): Promise<string[]> {
    try {
      const vault = await this.getDataVaultInfo(client, vaultId)
      return vault?.items || []
    } catch (error) {
      console.error('Error fetching DataVault items:', error)
      return []
    }
  }

  /**
   * Extract object IDs from transaction result
   * Supports both objectChanges and effects.changedObjects
   */
  extractObjectIds(
    result: any,
    objectType: string
  ): { created: string[]; mutated: string[] } {
    const created: string[] = []
    const mutated: string[] = []

    // Method 1: Try objectChanges first (if available)
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        if (
          change.type === 'created' &&
          change.objectType?.includes(objectType)
        ) {
          created.push(change.objectId)
        } else if (
          change.type === 'mutated' &&
          change.objectType?.includes(objectType)
        ) {
          mutated.push(change.objectId)
        }
      }
    }
    // Method 2: Fallback to effects.changedObjects (when objectChanges is undefined)
    else if (result.effects?.changedObjects) {
      for (const change of result.effects.changedObjects) {
        const objType = change.objectType || ''
        if (
          change.idOperation === 'Created' &&
          objType.includes(objectType)
        ) {
          created.push(change.id || change.objectId)
        } else if (
          change.idOperation === 'Mutated' &&
          objType.includes(objectType)
        ) {
          mutated.push(change.id || change.objectId)
        }
      }
    }

    return { created, mutated }
  }

  /**
   * Get all objects of a specific type owned by a user
   * Note: Data objects are shared objects, so we need to get them through DataVault
   * @param client SuiClient instance
   * @param ownerAddress User's wallet address
   * @param structType Struct type name (e.g., 'DataVault', 'Data', 'OAuthService', 'OAuthGrant')
   * @param options Options for fetching objects (showContent, showType, etc.)
   * @returns Array of object data
   */
  async getUserObjectsByType<T = any>(
    client: SuiClient,
    ownerAddress: string,
    structType: 'DataVault' | 'Data' | 'OAuthService' | 'OAuthGrant' | 'DataVaultCap' | 'ServiceCap' | 'ThirdPartyOauthCap' | 'ReadOnlyCap',
    options?: {
      showContent?: boolean
      showType?: boolean
      showOwner?: boolean
      showPreviousTransaction?: boolean
      showDisplay?: boolean
      showStorageRebate?: boolean
    }
  ): Promise<T[]> {
    try {
      // Special handling for Data objects - they are shared objects stored in DataVault
      if (structType === 'Data') {
        return await this.getUserDataObjects(client, ownerAddress, options)
      }

      const fullType = `${this.packageId}::${this.getModuleName(structType)}::${structType}`
      
      // console.log('Fetching objects:', {
      //   ownerAddress,
      //   structType,
      //   fullType,
      // })

      const ownedObjects = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: fullType,
        },
        options: {
          showContent: options?.showContent ?? true,
          showType: options?.showType ?? true,
          showOwner: options?.showOwner ?? false,
          showPreviousTransaction: options?.showPreviousTransaction ?? false,
          showDisplay: options?.showDisplay ?? false,
          showStorageRebate: options?.showStorageRebate ?? false,
        },
      })

      console.log(`Found ${ownedObjects.data.length} ${structType} objects`)

      const objects: T[] = []
      
      for (const obj of ownedObjects.data) {
        if (obj.data?.objectId) {
          try {
            // Fetch full object details
            const fullObject = await client.getObject({
              id: obj.data.objectId,
              options: {
                showContent: options?.showContent ?? true,
                showType: options?.showType ?? true,
                showOwner: options?.showOwner ?? false,
                showPreviousTransaction: options?.showPreviousTransaction ?? false,
                showDisplay: options?.showDisplay ?? false,
                showStorageRebate: options?.showStorageRebate ?? false,
              },
            })

            if (fullObject.data) {
              const objectData: any = {
                objectId: fullObject.data.objectId,
                version: fullObject.data.version,
                digest: fullObject.data.digest,
                type: fullObject.data.type,
                owner: fullObject.data.owner,
              }

              // Extract fields if content is available
              if (fullObject.data.content && 'fields' in fullObject.data.content) {
                objectData.fields = fullObject.data.content.fields
              }

              // Add previous transaction if available
              if (fullObject.data.previousTransaction) {
                objectData.previousTransaction = fullObject.data.previousTransaction
              }

              objects.push(objectData as T)
            }
          } catch (error) {
            console.warn(`Failed to fetch object ${obj.data.objectId}:`, error)
          }
        }
      }

      return objects
    } catch (error) {
      console.error(`Error fetching ${structType} objects:`, error)
      return []
    }
  }

  /**
   * Get all Data objects for a user
   * Data objects are shared objects, so we need to get them through DataVault
   */
  private async getUserDataObjects<T = any>(
    client: SuiClient,
    ownerAddress: string,
    options?: {
      showContent?: boolean
      showType?: boolean
      showOwner?: boolean
      showPreviousTransaction?: boolean
      showDisplay?: boolean
      showStorageRebate?: boolean
    }
  ): Promise<T[]> {
    try {
      // First, get all DataVaults owned by the user
      const vaults = await this.getUserObjectsByType<{
        objectId: string
        fields: {
          id: any
          owner: string
          group_name: string
          items: string[]
        }
      }>(client, ownerAddress, 'DataVault', options)

      console.log(`Found ${vaults.length} DataVaults`)

      const allDataItems: T[] = []

      // For each vault, get all Data items
      for (const vault of vaults) {
        const dataIds = vault.fields?.items || []
        console.log(`Vault ${vault.objectId} has ${dataIds.length} items`)

        for (const dataId of dataIds) {
          try {
            const dataObject = await client.getObject({
              id: dataId,
              options: {
                showContent: options?.showContent ?? true,
                showType: options?.showType ?? true,
                showOwner: options?.showOwner ?? false,
                showPreviousTransaction: options?.showPreviousTransaction ?? false,
                showDisplay: options?.showDisplay ?? false,
                showStorageRebate: options?.showStorageRebate ?? false,
              },
            })

            if (dataObject.data) {
              const objectData: any = {
                objectId: dataObject.data.objectId,
                version: dataObject.data.version,
                digest: dataObject.data.digest,
                type: dataObject.data.type,
                owner: dataObject.data.owner,
              }

              // Extract fields if content is available
              if (dataObject.data.content && 'fields' in dataObject.data.content) {
                objectData.fields = dataObject.data.content.fields
              }

              // Add previous transaction if available
              if (dataObject.data.previousTransaction) {
                objectData.previousTransaction = dataObject.data.previousTransaction
              }

              allDataItems.push(objectData as T)
            }
          } catch (error) {
            console.warn(`Failed to fetch Data object ${dataId}:`, error)
          }
        }
      }

      return allDataItems
    } catch (error) {
      console.error('Error fetching Data objects:', error)
      return []
    }
  }

  /**
   * Get module name for a struct type
   */
  private getModuleName(structType: string): string {
    const moduleMap: Record<string, string> = {
      'DataVault': 'seal_private_data',
      'Data': 'seal_private_data',
      'DataVaultCap': 'seal_private_data',
      'ReadOnlyCap': 'seal_private_data',
      'OAuthService': 'oauth_service',
      'OAuthGrant': 'oauth_service',
      'ServiceCap': 'oauth_service',
      'ThirdPartyOauthCap': 'oauth_service',
    }
    return moduleMap[structType] || 'seal_private_data'
  }

  /**
   * Get all user's DataVault objects with full details
   */
  async getUserDataVaultsWithDetails(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      owner: string
      group_name: string
      items: string[]
    }
  }>> {
    return this.getUserObjectsByType(client, ownerAddress, 'DataVault', {
      showContent: true,
      showType: true,
    })
  }

  /**
   * Get all user's Data objects with full details
   */
  async getUserDataItemsWithDetails(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      vault_id: string
      name: string
      share_type: number
      value: string
      nonce: number[]
    }
  }>> {
    return this.getUserObjectsByType(client, ownerAddress, 'Data', {
      showContent: true,
      showType: true,
    })
  }

  /**
   * Get all DataVault IDs for a specific owner by querying owned objects
   * Since DataVault is a shared object, we need to check ownership field in the content
   * @param client SuiClient instance
   * @param ownerAddress Owner's wallet address
   * @returns Array of DataVault IDs owned by the user
   */
  async getUserDataVaultIds(
    client: SuiClient,
    ownerAddress: string
  ): Promise<string[]> {
    try {
      console.log('Fetching DataVault IDs for owner:', ownerAddress)

      // Note: Since DataVault is shared, we need to use a different approach
      // We'll get owned DataVaultCap objects and extract vault IDs from them
      const fullType = `${this.packageId}::seal_private_data::DataVaultCap`
      
      const ownedCaps = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: fullType,
        },
        options: {
          showContent: true,
          showType: true,
        },
      })

      console.log(`Found ${ownedCaps.data.length} DataVaultCap objects`)

      const vaultIds: string[] = []
      
      for (const obj of ownedCaps.data) {
        if (obj.data?.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as any
          const vaultId = fields.vault_id
          if (vaultId) {
            vaultIds.push(vaultId)
          }
        }
      }

      console.log(`Extracted ${vaultIds.length} vault IDs from DataVaultCap objects`)
      return vaultIds
    } catch (error) {
      console.error('Error fetching DataVault IDs:', error)
      return []
    }
  }

  /**
   * Get all Data objects for a specific user
   * This method works by:
   * 1. Getting user's DataVaultCap objects to find vault IDs
   * 2. For each vault, getting the Data items from the vault's items list
   * @param client SuiClient instance
   * @param ownerAddress User's wallet address
   * @returns Array of Data objects owned by the user
   */
  async getUserDataItemsViaVaultCaps(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      vault_id: string
      name: string
      share_type: number
      value: string
      nonce: number[]
    }
  }>> {
    try {
      console.log('Fetching user data via DataVaultCap method for:', ownerAddress)

      // Step 1: Get vault IDs from user's DataVaultCap objects
      const vaultIds = await this.getUserDataVaultIds(client, ownerAddress)
      
      if (vaultIds.length === 0) {
        console.log('User has no DataVaults')
        return []
      }

      console.log(`User has ${vaultIds.length} DataVaults`)

      // Step 2: For each vault, get all Data items
      const allDataItems: Array<{
        objectId: string
        version: string
        digest: string
        type: string
        owner: any
        fields: {
          id: any
          vault_id: string
          name: string
          share_type: number
          value: string
          nonce: number[]
        }
      }> = []

      for (const vaultId of vaultIds) {
        try {
          // Get vault info to get item IDs
          const vault = await this.getDataVaultInfo(client, vaultId)
          if (!vault || vault.items.length === 0) {
            console.log(`Vault ${vaultId} has no items`)
            continue
          }

          console.log(`Vault ${vaultId} has ${vault.items.length} items`)

          // Batch fetch all Data items from this vault
          const dataObjects = await client.multiGetObjects({
            ids: vault.items,
            options: {
              showContent: true,
              showType: true,
              showOwner: true,
            },
          })

          // Process each Data object
          for (let i = 0; i < dataObjects.length; i++) {
            const obj = dataObjects[i]
            if (obj.data) {
              const objectData: any = {
                objectId: obj.data.objectId,
                version: obj.data.version,
                digest: obj.data.digest,
                type: obj.data.type,
                owner: obj.data.owner,
              }

              if (obj.data.content && 'fields' in obj.data.content) {
                objectData.fields = obj.data.content.fields
              }

              allDataItems.push(objectData)
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch Data items for vault ${vaultId}:`, error)
        }
      }

      console.log(`Total Data items found: ${allDataItems.length}`)
      return allDataItems
    } catch (error) {
      console.error('Error fetching user data via VaultCap:', error)
      return []
    }
  }

  async getOAuthSerViceViaServiceCaps(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      client_id: string
      owner: string
      redirect_url: string
      resource_types: number[]
      created_at: number
    }
  }>>  {
    try {
      console.log('Fetching OAuth Service via ServiceCap method for:', ownerAddress)

      // Step 1: Get user's ServiceCap objects
      const serviceCaps = await this.getUserObjectsByType<{
        objectId: string
        fields: {
          id: any
          service_id: string
        }
      }>(client, ownerAddress, 'ServiceCap', {
        showContent: true,
        showType: true,
      })

      if (serviceCaps.length === 0) {
        console.log('User has no ServiceCaps')
        return []
      }

      console.log(`User has ${serviceCaps.length} ServiceCaps`)

      // Step 2: Extract service IDs from ServiceCaps
      const serviceIds: string[] = []
      for (const serviceCap of serviceCaps) {
        const serviceId = serviceCap.fields?.service_id
        if (serviceId) {
          serviceIds.push(serviceId)
        }
      }

      if (serviceIds.length === 0) {
        console.log('No service IDs found in ServiceCaps')
        return []
      }

      console.log(`Found ${serviceIds.length} service IDs`)

      // Step 3: Batch fetch all OAuthService objects
      const allOAuthServices: Array<{
        objectId: string
        version: string
        digest: string
        type: string
        owner: any
        fields: {
          id: any
          client_id: string
          owner: string
          redirect_url: string
          resource_types: number[]
          created_at: number
        }
      }> = []

      const serviceObjects = await client.multiGetObjects({
        ids: serviceIds,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
        },
      })

      // Process each OAuthService object
      for (let i = 0; i < serviceObjects.length; i++) {
        const obj = serviceObjects[i]
        if (obj.data) {
          const objectData: any = {
            objectId: obj.data.objectId,
            version: obj.data.version,
            digest: obj.data.digest,
            type: obj.data.type,
            owner: obj.data.owner,
          }

          if (obj.data.content && 'fields' in obj.data.content) {
            objectData.fields = obj.data.content.fields
          }

          allOAuthServices.push(objectData)
        }
      }

      console.log(`Total OAuthService objects found: ${allOAuthServices.length}`)
      return allOAuthServices
    } catch (error) {
      console.error('Error fetching OAuth services via ServiceCap:', error)
      return []
    }
  }

  /**
   * Get all user's OAuthService objects with full details
   */
  async getUserOAuthServicesWithDetails(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      client_id: string
      owner: string
      redirect_url: string
      resource_types: number[]
      created_at: number
    }
  }>> {
    return this.getUserObjectsByType(client, ownerAddress, 'OAuthService', {
      showContent: true,
      showType: true,
    })
  }

  /**
   * Get all user's OAuthGrant objects with full details
   */
  async getUserOAuthGrantsWithDetails(
    client: SuiClient,
    ownerAddress: string
  ): Promise<Array<{
    objectId: string
    version: string
    digest: string
    type: string
    owner: any
    fields: {
      id: any
      client_id: string
      user_address: string
      owner_address: string
      resource_ids: string[]
      created_at: number
      expires_at: number
      access_token: string
    }
  }>> {
    return this.getUserObjectsByType(client, ownerAddress, 'OAuthGrant', {
      showContent: true,
      showType: true,
    })
  }
}

// Export singleton instance
export const contractService = new ContractService()

