import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { walrus, RetryableWalrusClientError } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey, SealClient } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for encrypted data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Seal configuration
const SEAL_PACKAGE_ID = process.env.SEAL_PACKAGE_ID || '0x01154b902550f24ae090153ae6fbae05600cf5ee7c8a16cff95ab3e064bf13e3';
const SEAL_PACKAGE_ID_ACCESS_DATA_POLICY = 'BOWHEADWHALE-D-OAUTH_ACCESS-DATA-POLICY';
const SEAL_KEY_SERVER_OBJECT_IDS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8'
];

// Helper function to convert string to hex
const stringToHexString = (str) => {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper function to get encryption Seal ID
const getEncryptionSealId = () => {
  return stringToHexString(SEAL_PACKAGE_ID_ACCESS_DATA_POLICY);
};

const suiClient = new SuiJsonRpcClient({
  url: getFullnodeUrl('testnet'),
  network: 'testnet',
}).$extend(
  walrus({
      uploadRelay: {
          // 使用官方或自架的 Relay
          host: 'https://upload-relay.testnet.walrus.space', 
          sendTip: { max: 1_000 }, // 視情況設定小費
      },
  }),
);

// Initialize keypair for Walrus uploads
const getKeypair = () => {
  const privateKey = process.env.WALRUS_PRIVATE_KEY || 'suiprivkey1qqvakcmwlmjv48gm5vycjkah8f8xxecmka5tgyh6h57yzr4r9v9cck705rf';
  return Ed25519Keypair.fromSecretKey(privateKey);
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Bowhead Whale API is running',
    timestamp: new Date().toISOString(),
  });
});

// Upload encrypted data to Walrus
app.post('/api/walrus/upload', async (req, res) => {
  // Set extended timeout for upload endpoint (5 minutes)
  req.setTimeout(300000);
  res.setTimeout(300000);

  try {
    const { encryptedData, deletable = true, epochs = 1, isAuth = false } = req.body;
    
    if (!encryptedData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: encryptedData (base64 encoded)',
      });
    }

    // Convert base64 to Uint8Array
    let blobData;
    try {
      if (typeof encryptedData === 'string') {
        // Remove data URL prefix if present
        const base64Data = encryptedData.includes(',') 
          ? encryptedData.split(',')[1] 
          : encryptedData;
        const binaryString = Buffer.from(base64Data, 'base64');
        blobData = new Uint8Array(binaryString);
      } else {
        return res.status(400).json({
          success: false,
          error: 'encryptedData must be a base64 encoded string',
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64 encoded data',
      });
    }

    console.log(`📤 Uploading ${blobData.length} bytes to Walrus...`);

    // Get keypair
    const keypair = getKeypair();

    const { blobId, blobObject } = await suiClient.walrus.writeBlob({
      blob: blobData,
      deletable: deletable,
      epochs: epochs,
      signer: keypair,
    })
    
    // If we have blobId, return success (even if there were confirmation errors)
    if (blobId) {
      res.json({
        success: true,
        message: 'Data uploaded to Walrus successfully',
        data: {
          blobId,
          blobObject: blobObject || null,
          size: blobData.length,
          epochs,
          deletable,
        },
      });
    } else {
      // This shouldn't happen if error handling worked correctly
      throw new Error('Failed to get blobId from upload');
    }
  } catch (error) {
    console.error('❌ Walrus upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload to Walrus',
    });
  }
});

// Read blob from Walrus
app.get('/api/walrus/read/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    
    if (!blobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing blobId parameter',
      });
    }

    console.log(`📥 Reading blob from Walrus: ${blobId}`);

    // Read blob from Walrus
    const blobData = await suiClient.walrus.readBlob({ blobId });

    // Convert to base64 for response
    const base64Data = Buffer.from(blobData).toString('base64');

    res.json({
      success: true,
      message: 'Blob read successfully',
      data: {
        blobId,
        data: base64Data,
        size: blobData.length,
      },
    });
  } catch (error) {
    console.error('❌ Walrus read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to read from Walrus',
    });
  }
});

// Decrypt data using Seal
// Set timeout to 5 minutes for this endpoint
app.post('/api/bowheadwhale/get-user-data', async (req, res) => {
  // Set response timeout to 5 minutes (300000ms)
  req.setTimeout(300000);
  res.setTimeout(300000);
  
  try {
    const { accessToken, vaultId, itemId } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accessToken',
      });
    }

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: vaultId',
      });
    }

    if (!itemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: itemId',
      });
    }

    console.log('🔓 Starting decryption process...');
    console.log('📋 Parameters:', { vaultId, itemId });

    // Step 1: Get Data object from chain to extract blob ID and nonce
    console.log('📡 Fetching Data object from chain...');
    const dataObject = await Promise.race([
      suiClient.getObject({
        id: itemId,
        options: {
          showContent: true,
          showType: true,
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Failed to fetch Data object from chain (5 minutes)')), 300000)
      ),
    ]);

    if (!dataObject.data?.content || !('fields' in dataObject.data.content)) {
      return res.status(404).json({
        success: false,
        error: 'Data object not found',
      });
    }

    const fields = dataObject.data.content.fields;
    const blobId = fields.value;
    const nonce = fields.nonce || [];
    const dataVaultId = fields.vault_id || vaultId;

    if (!blobId) {
      return res.status(400).json({
        success: false,
        error: 'Data object does not contain blob ID',
      });
    }

    console.log('✅ Data object retrieved:', { blobId, nonceLength: nonce.length });

    // Step 2: Read encrypted blob from Walrus with retry logic
    console.log('📥 Reading encrypted blob from Walrus...');
    // Set timeout for Walrus read operation (5 minutes)
    // Walrus is fault-tolerant: individual node errors are logged but don't fail the operation
    // The operation only fails if not enough nodes respond successfully
    let encryptedBlob;
    const maxRetries = 2; // Retry up to 2 times
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        encryptedBlob = await Promise.race([
          suiClient.walrus.readBlob({ blobId }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Failed to read blob from Walrus (5 minutes)')), 300000)
          ),
        ]);
        console.log('✅ Encrypted blob retrieved, size:', encryptedBlob.length);
        break; // Success, exit retry loop
      } catch (walrusError) {
        console.error(`❌ Walrus read error (attempt ${retryCount + 1}/${maxRetries + 1}):`, {
          message: walrusError.message,
          name: walrusError.name,
          status: walrusError.status,
          blobId,
        });
        
        // Check if this is a retryable error
        if (walrusError instanceof RetryableWalrusClientError && retryCount < maxRetries) {
          console.log(`🔄 Retrying after resetting Walrus client...`);
          suiClient.walrus.reset();
          retryCount++;
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          continue;
        }
        
        // Check for network errors (fetch failed)
        if (walrusError.message?.includes('fetch failed') || 
            walrusError.name === 'TypeError' ||
            walrusError.message?.includes('ECONNREFUSED') ||
            walrusError.message?.includes('ENOTFOUND')) {
          return res.status(503).json({
            success: false,
            error: 'Network connectivity issue: Unable to connect to Walrus storage nodes. This may indicate: 1) Container network restrictions, 2) DNS resolution issues, 3) Firewall blocking outbound connections, 4) Storage nodes temporarily unavailable.',
            details: {
              blobId,
              errorType: 'NetworkError',
              suggestion: 'Please check: 1) Container network configuration, 2) Outbound connectivity from Azure Web App, 3) DNS resolution, 4) Firewall rules.',
            },
          });
        }
        
        // Check for specific error types
        if (walrusError.message?.includes('sliver') || 
            walrusError.message?.includes('unavailable') ||
            walrusError.message?.includes('NotEnoughSlivers')) {
          return res.status(404).json({
            success: false,
            error: 'Blob data unavailable: Unable to retrieve enough data fragments (slivers) from storage nodes. This may happen if: 1) The data was recently uploaded and not yet fully distributed, 2) Many storage nodes are temporarily unavailable, 3) Network connectivity issues preventing access to storage nodes, 4) The data may have expired or been deleted.',
            details: {
              blobId,
              errorType: 'NotEnoughSlivers',
              suggestion: 'Please try again later. If the problem persists, check network connectivity from the container to Walrus storage nodes.',
            },
          });
        }
        
        if (walrusError.message?.includes('Timeout')) {
          return res.status(504).json({
            success: false,
            error: 'Request timeout: Failed to read blob from Walrus within 5 minutes. This may be due to network issues or insufficient storage node responses.',
          });
        }
        
        // If we've exhausted retries or it's not retryable, throw the error
        if (retryCount >= maxRetries) {
          throw walrusError;
        }
        
        retryCount++;
      }
    }

    // Step 3: Import SessionKey from base64
    console.log('🔑 Importing SessionKey from base64...');
    let sessionKey;
    try {
      // Decode base64 to JSON string
      // The base64 was encoded using: btoa(unescape(encodeURIComponent(jsonString)))
      // In Node.js, we need to reverse this process
      // Buffer.from(base64, 'base64') gives us the binary string
      // Then we need to decode it properly
      const binaryString = Buffer.from(accessToken, 'base64').toString('binary');
      // Convert binary string to UTF-8, handling the unescape/encodeURIComponent reversal
      const jsonString = Buffer.from(binaryString, 'binary').toString('utf-8');
      const keyData = JSON.parse(jsonString);
      
      console.log('📋 SessionKey data:', {
        address: keyData.address,
        packageId: keyData.packageId,
        hasSignature: !!keyData.personalMessageSignature,
      });
      
      // Import SessionKey
      sessionKey = SessionKey.import(keyData, suiClient);
      console.log('✅ SessionKey imported');
    } catch (error) {
      console.error('❌ Failed to import SessionKey:', error);
      return res.status(400).json({
        success: false,
        error: `Failed to import SessionKey: ${error.message}`,
      });
    }

    // Step 4: Get access address from SessionKey
    const accessAddress = sessionKey.getAddress();
    console.log('👤 Access address:', accessAddress);

    // Step 5: Get Seal ID (using encryption Seal ID)
    const sealId = getEncryptionSealId();
    console.log('🔐 Seal ID:', sealId);

    // Step 6: Create SealClient
    console.log('🔧 Creating SealClient...');
    // SealClient may need longer timeout for key server communication
    const sealClient = new SealClient({
      suiClient,
      serverConfigs: SEAL_KEY_SERVER_OBJECT_IDS.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
      // Note: SealClient doesn't expose timeout config directly,
      // but we'll handle timeout at the decrypt call level
    });
    console.log('✅ SealClient created');

    // Step 7: Build transaction for seal_approve
    console.log('📝 Building transaction...');
    const tx = new Transaction();
    const clockObject = tx.object('0x6');
    
    // Clean seal ID (remove 0x prefix)
    const cleanSealId = sealId.replace(/^0x/i, '');
    
    tx.moveCall({
      target: `${SEAL_PACKAGE_ID}::seal_private_data::seal_approve`,
      arguments: [
        tx.pure.vector('u8', Array.from(fromHex(cleanSealId))),
        tx.object(dataVaultId),
        tx.object(itemId),
        tx.pure.address(accessAddress),
        clockObject,
      ],
    });

    // Build transaction bytes
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
    console.log('✅ Transaction built, length:', txBytes.length);

    // Step 8: Decrypt using Seal
    console.log('🔓 Decrypting data...');
    // Set timeout for Seal decryption (5 minutes)
    // Seal decryption may need to contact multiple key servers to retrieve slivers
    const decryptedBytes = await Promise.race([
      sealClient.decrypt({
        data: encryptedBlob,
        sessionKey,
        txBytes,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Failed to decrypt data. Unable to retrieve enough slivers from key servers (5 minutes)')), 300000)
      ),
    ]);
    console.log('✅ Decryption successful, decrypted data length:', decryptedBytes.length);

    // Step 9: Convert decrypted bytes to base64 for response
    const decryptedBase64 = Buffer.from(decryptedBytes).toString('base64');

    res.json({
      success: true,
      message: 'Data decrypted successfully',
      data: {
        decryptedData: decryptedBase64,
        size: decryptedBytes.length,
        blobId,
        vaultId: dataVaultId,
        itemId,
      },
    });
  } catch (error) {
    console.error('❌ Seal decryption error:', error);
    
    // Handle specific error types
    if (error.message?.includes('Timeout')) {
      return res.status(504).json({
        success: false,
        error: 'Request timeout: Failed to decrypt data within 2 minutes. Unable to retrieve enough slivers from key servers.',
        details: {
          suggestion: 'This may be due to network issues, key server unavailability, or insufficient storage node responses. Please try again later.',
        },
      });
    }
    
    if (error.message?.includes('slivers') || error.message?.includes('Unable to retrieve enough')) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable: Unable to retrieve enough data fragments (slivers) to decrypt. This may happen if: 1) Key servers are temporarily unavailable, 2) Network connectivity issues, 3) Data fragments not fully distributed yet.',
        details: {
          suggestion: 'Please try again later. The system needs to contact multiple key servers and storage nodes to retrieve all required data fragments.',
        },
      });
    }
    
    // Handle Walrus-related errors that might have been caught here
    if (error.message?.includes('sliver') || error.message?.includes('unavailable')) {
      return res.status(404).json({
        success: false,
        error: 'Data unavailable: Required data fragments are not available. This may indicate the data was recently uploaded and not yet fully distributed, or some storage nodes are temporarily unavailable.',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to decrypt data',
    });
  }
});

// Serve static files from React build
// In Docker: __dirname is /app/src, dist is at /app/dist
const buildPath = path.join(__dirname, '../dist');
app.use(express.static(buildPath));

// Serve React app for all non-API routes (SPA fallback for React Router)
// This must be after all API routes
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    // API route not found
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend served from ${buildPath}`);
});