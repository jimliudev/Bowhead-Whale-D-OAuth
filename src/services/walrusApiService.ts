/**
 * Walrus API Service
 * Handles communication with backend API for Walrus storage operations
 */

/**
 * Get API base URL from environment variables
 * @returns API base URL, empty string for relative paths
 */
const getApiBaseUrl = (): string => {
  // Vite exposes env variables via import.meta.env
  // Only variables prefixed with VITE_ are exposed
  const apiUrl = (import.meta as any).env?.VITE_API_BASE_URL
  
  // Return empty string if not set (for relative paths)
  // This works when frontend and backend are on the same domain
  return apiUrl || ''
}

export interface UploadToWalrusParams {
  encryptedData: Uint8Array
  deletable?: boolean
  epochs?: number
}

export interface UploadToWalrusResult {
  blobId: string
  blobObject: any
  size: number
  epochs: number
  deletable: boolean
}

export interface ReadFromWalrusResult {
  blobId: string
  data: Uint8Array
  size: number
}

export class WalrusApiService {
  /**
   * Upload encrypted data to Walrus via API
   * @param params Upload parameters
   * @returns Upload result with blobId
   */
  async uploadToWalrus(params: UploadToWalrusParams): Promise<UploadToWalrusResult> {
    const { encryptedData, deletable = true, epochs = 3 } = params

    try {
      // Convert encrypted data to base64
      const base64Data = btoa(String.fromCharCode(...encryptedData))

      // Call API to upload to Walrus
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/api/walrus/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encryptedData: base64Data,
          deletable,
          epochs,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to upload to Walrus: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      return result.data
    } catch (error) {
      console.error('Walrus upload error:', error)
      throw error instanceof Error ? error : new Error('Failed to upload to Walrus')
    }
  }

  /**
   * Read blob from Walrus via API
   * @param blobId Blob ID to read
   * @returns Blob data as Uint8Array
   */
  async readFromWalrus(blobId: string): Promise<ReadFromWalrusResult> {
    if (!blobId) {
      throw new Error('Blob ID is required')
    }

    try {
      // Call API to read from Walrus
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/api/walrus/read/${blobId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to read from Walrus: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Read failed')
      }

      // Convert base64 back to Uint8Array
      const base64Data = result.data.data
      const binaryString = atob(base64Data)
      const data = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        data[i] = binaryString.charCodeAt(i)
      }

      return {
        blobId: result.data.blobId,
        data,
        size: result.data.size,
      }
    } catch (error) {
      console.error('Walrus read error:', error)
      throw error instanceof Error ? error : new Error('Failed to read from Walrus')
    }
  }
}

// Export singleton instance
export const walrusApiService = new WalrusApiService()

