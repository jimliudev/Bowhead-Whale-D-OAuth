# API Usage Examples

## Walrus Upload API

### Upload Encrypted Data to Walrus

**Endpoint:** `POST /api/walrus/upload`

**Request Body:**
```json
{
  "encryptedData": "base64_encoded_encrypted_data_here",
  "deletable": true,
  "epochs": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data uploaded to Walrus successfully",
  "data": {
    "blobId": "0x...",
    "blobObject": {...},
    "size": 1024,
    "epochs": 3,
    "deletable": true
  }
}
```

**Example with cURL:**
```bash
curl -X POST http://localhost:3000/api/walrus/upload \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedData": "SGVsbG8gV29ybGQ=",
    "deletable": true,
    "epochs": 3
  }'
```

**Example with JavaScript:**
```javascript
const encryptedData = new Uint8Array([...]); // Your encrypted data
const base64Data = btoa(String.fromCharCode(...encryptedData));

const response = await fetch('http://localhost:3000/api/walrus/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    encryptedData: base64Data,
    deletable: true,
    epochs: 3,
  }),
});

const result = await response.json();
console.log('Blob ID:', result.data.blobId);
```

## Read Blob from Walrus

**Endpoint:** `GET /api/walrus/read/:blobId`

**Response:**
```json
{
  "success": true,
  "message": "Blob read successfully",
  "data": {
    "blobId": "0x...",
    "data": "base64_encoded_data",
    "size": 1024
  }
}
```

**Example with cURL:**
```bash
curl http://localhost:3000/api/walrus/read/0x...
```

**Example with JavaScript:**
```javascript
const blobId = '0x...';
const response = await fetch(`http://localhost:3000/api/walrus/read/${blobId}`);
const result = await response.json();

// Convert base64 back to Uint8Array
const binaryString = atob(result.data.data);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
console.log('Decrypted data:', bytes);
```

## Integration with Frontend

Replace the client-side Walrus upload code with API call:

**Before (Client-side):**
```typescript
const keypair = await getKeypair();
const { blobId } = await (suiClient as any).walrus.writeBlob({
  blob: encryptedObject,
  deletable: true,
  epochs: 3,
  signer: keypair,
});
```

**After (Using API):**
```typescript
// Convert encrypted data to base64
const base64Data = btoa(String.fromCharCode(...encryptedObject));

// Call API
const response = await fetch('/api/walrus/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    encryptedData: base64Data,
    deletable: true,
    epochs: 3,
  }),
});

const result = await response.json();
const blobId = result.data.blobId;
```

