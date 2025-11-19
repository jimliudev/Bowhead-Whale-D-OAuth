import { useState, useMemo, useEffect } from 'react'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { walrus } from '@mysten/walrus'
import { SealService } from '../services/sealService'
import { getFundedKeypair } from '../funded-keypair'
import { SEAL_PACKAGE_ID } from '../config'
import Header from '../components/Header'
import './css/PageLayout.css'
import './css/UserPage.css'

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
    storageNodeClientOptions: {
      timeout: 60_000,
    },
  }),
)

export default function UserPage() {
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
  const sealService = useMemo(() => new SealService(), [])
  
  // 表单状态
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [vaultId, setVaultId] = useState<string | null>(null)


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !currentAccount) {
      setError('Please connect your wallet first')
      return
    }

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Invalid email format')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('Preparing to register user information...')

    try {
      // 1. Prepare user data
      const userData = {
        email: email.trim(),
        gender: gender || 'Not specified',
        additionalInfo: additionalInfo.trim() || '',
        registeredAt: new Date().toISOString(),
      }

      const userDataJson = JSON.stringify(userData, null, 2)
      const userDataBytes = new TextEncoder().encode(userDataJson)

      setStatus('Encrypting user data...')
      console.log('User data:', userData)

      // 2. Encrypt data using Seal
      const encryptionSealId = sealService.getEncryptionSealId()
      const { encryptedObject } = await sealService.encrypt(encryptionSealId, userDataBytes)
      
      console.log('Encryption complete, encrypted data size:', encryptedObject.length)

      // 3. Upload to Walrus
      setStatus('Uploading encrypted data to Walrus...')
      const keypair = await getFundedKeypair('suiprivkey1qqvakcmwlmjv48gm5vycjkah8f8xxecmka5tgyh6h57yzr4r9v9cck705rf')
      
      const { blobId } = await (suiClient as any).walrus.writeBlob({
        blob: encryptedObject,
        deletable: true,
        epochs: 3,
        signer: keypair,
      })

      console.log('Walrus Blob ID:', blobId)

      // 4. 生成 nonce (用于 Seal ID)
      const nonce = new Uint8Array(16)
      crypto.getRandomValues(nonce)

      // 5. Create DataVault
      setStatus('Creating data vault...')
      const tx = new Transaction()
      
      // Create DataVault with group_name "User Information"
      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::seal_private_data::create_data_vault_entry`,
        arguments: [
          tx.pure.string('User Information'),
        ],
      })
      const vaultResult = await signAndExecuteTransaction({
        transaction: tx as any,
      })

      console.log('Vault creation result:', vaultResult)

      // 从 objectChanges 中提取 Vault ID
      const vaultResultAny = vaultResult as any
      let newVaultId: string | null = null
      if (vaultResultAny.objectChanges) {
        const vaultChange = vaultResultAny.objectChanges.find(
          (change: any) => change.type === 'created' && change.objectType?.includes('DataVault')
        )
        if (vaultChange) {
          newVaultId = vaultChange.objectId
          setVaultId(newVaultId)
        }
      }

      if (!newVaultId) {
        throw new Error('Failed to get Vault ID, please try again')
      }

      // 6. Get DataVaultCap (from objectChanges)
      let vaultCapId: string | null = null
      if (vaultResultAny.objectChanges) {
        const capChange = vaultResultAny.objectChanges.find(
          (change: any) => change.type === 'created' && change.objectType?.includes('DataVaultCap')
        )
        if (capChange) {
          vaultCapId = capChange.objectId
        }
      }

      if (!vaultCapId) {
        throw new Error('Failed to get VaultCap ID, please try again')
      }

      // 7. Create Data item to store user information
      setStatus('Saving user information...')
      const dataTx = new Transaction()
      
      dataTx.moveCall({
        target: `${SEAL_PACKAGE_ID}::seal_private_data::create_data_entry`,
        arguments: [
          dataTx.object(vaultCapId),
          dataTx.object(newVaultId),
          dataTx.pure.string('Personal Information'),
          dataTx.pure.u8(0), // share_type: 0 = View
          dataTx.pure.string(blobId),
          dataTx.pure.vector('u8', Array.from(nonce)),
        ],
      })

      const dataResult = await signAndExecuteTransaction({
        transaction: dataTx as any,
      })

      console.log('Data creation result:', dataResult)

      setStatus(`✅ User registered successfully!\nVault ID: ${newVaultId}\nTransaction: ${dataResult.digest}\nView on: https://suiexplorer.com/txblock/${dataResult.digest}?network=testnet`)

      // Clear form
      setEmail('')
      setGender('')
      setAdditionalInfo('')
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
        title="User Registration"
        backTo="/"
        backLabel="Back"
        rightLink={{
          to: '/bowheadwhale/thirdparty-service',
          label: 'Service Registration',
        }}
      />

      <div className="page-content">
        <div className="info-box">
          <h3>Registration Guide</h3>
          <ul>
            <li>Fill in your personal information to register on the Bowhead Whale platform</li>
            <li>Your data will be encrypted using <strong>Seal</strong> and stored on <strong>Walrus</strong> decentralized storage</li>
            <li>Only you can access and view this information</li>
            <li>After successful registration, you will receive a <code>DataVault</code> to manage your data</li>
          </ul>
        </div>

        {!isConnected ? (
          <div className="wallet-section">
            <p>Please connect your wallet to register user information</p>
            <p style={{ fontSize: '0.875rem', color: '#86868b', marginTop: '0.5rem' }}>
              Use the connect button in the header to connect your wallet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-group">
              <label htmlFor="email">
                <strong>Email *</strong>
                <span className="form-hint">(For identity verification)</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">
                <strong>Gender</strong>
                <span className="form-hint">(Optional)</span>
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={loading}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="additionalInfo">
                <strong>Additional Information</strong>
                <span className="form-hint">(Optional, e.g., name, phone)</span>
              </label>
              <textarea
                id="additionalInfo"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Enter additional personal information here..."
                rows={4}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              {loading ? 'Registering...' : 'Register User'}
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

        {vaultId && (
          <div className="success-box" style={{ marginTop: '2rem' }}>
            <h3>Registration Successful</h3>
            <p><strong>Vault ID:</strong></p>
            <code>{vaultId}</code>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6e6e73' }}>
              Your personal information has been encrypted and stored. Please save your Vault ID securely, as you will need it to manage your data.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

