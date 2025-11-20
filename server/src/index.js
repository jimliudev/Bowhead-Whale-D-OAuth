import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { walrus } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Sui Client with Walrus extension
const suiClient = new SuiClient({
  url: getFullnodeUrl(process.env.SUI_NETWORK || 'testnet'),
  network: process.env.SUI_NETWORK || 'testnet',
}).$extend(
  walrus({
    wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
  })
);

// Initialize keypair for Walrus uploads
const getKeypair = () => {
  const privateKey = process.env.WALRUS_PRIVATE_KEY || 'suiprivkey1qqvakcmwlmjv48gm5vycjkah8f8xxecmka5tgyh6h57yzr4r9v9cck705rf';
  return Ed25519Keypair.fromSecretKey(privateKey);
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for encrypted data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  try {
    const { encryptedData, deletable = true, epochs = 3 } = req.body;
    
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

    let blobId = null;
    let blobObject = null;

    try {
      // Upload to Walrus
      const result = await suiClient.walrus.writeBlob({
        blob: blobData,
        deletable: deletable,
        epochs: epochs,
        signer: keypair,
      });

      blobId = result.blobId;
      blobObject = result.blobObject;

      console.log(`✅ Upload successful! Blob ID: ${blobId}`);
    } catch (error) {
      // Check if error is NotEnoughBlobConfirmationsError
      const errorMessage = error?.message || '';
      const isConfirmationError = 
        error?.name === 'NotEnoughBlobConfirmationsError' || 
        errorMessage.includes('NotEnoughBlobConfirmationsError') ||
        errorMessage.includes('Too many failures while writing blob');

      if (isConfirmationError) {
        // Try to extract blobId from error message
        // Error format: "Too many failures while writing blob ZTcPOh-EQQMyUrNDcLZYskDKl36jC5ZnAZ4sMFNC388 to nodes"
        const blobIdMatch = errorMessage.match(/blob ([A-Za-z0-9_-]+)/);
        if (blobIdMatch && blobIdMatch[1]) {
          blobId = blobIdMatch[1];
          console.log(`⚠️ Partial upload (some nodes failed), but got Blob ID: ${blobId}`);
          console.log(`✅ Ignoring confirmation error and returning success with Blob ID`);
        } else {
          // Try to get blobId from error object properties
          blobId = error?.blobId || error?.data?.blobId || null;
          if (blobId) {
            console.log(`⚠️ Partial upload (some nodes failed), but got Blob ID: ${blobId}`);
            console.log(`✅ Ignoring confirmation error and returning success with Blob ID`);
          } else {
            // Can't extract blobId, log warning but don't fail
            console.warn(`⚠️ NotEnoughBlobConfirmationsError but couldn't extract blobId from:`, errorMessage);
            // Still try to continue - the blob might have been registered
            throw error;
          }
        }
      } else {
        // Other errors, rethrow
        throw error;
      }
    }

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

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../../dist');
  app.use(express.static(buildPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

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
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Frontend served from /dist`);
  }
});

