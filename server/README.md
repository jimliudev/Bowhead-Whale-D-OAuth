# Bowhead Whale API Server

Express.js backend API server for Bowhead Whale D OAuth application.

## Features

- RESTful API endpoints
- CORS enabled
- Serves React frontend in production
- Health check endpoint

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Services
- `GET /api/services` - List all OAuth services
- `GET /api/services/:serviceId` - Get service details

### Grants
- `GET /api/grants` - List OAuth grants (query params: userAddress, serviceId)
- `POST /api/grants` - Create new OAuth grant

### Walrus Storage
- `POST /api/walrus/upload` - Upload encrypted data to Walrus
  - Body: `{ encryptedData: string (base64), deletable?: boolean, epochs?: number }`
  - Returns: `{ blobId, blobObject, size, epochs, deletable }`
- `GET /api/walrus/read/:blobId` - Read blob from Walrus
  - Returns: `{ blobId, data (base64), size }`

### Cache Management
- `GET /api/cache/:key` - Get cache value by key
  - Returns: `{ key, value }`
- `POST /api/cache` - Set cache value
  - Body: `{ key: string, value: any, ttl?: number }` (ttl in seconds)
  - Returns: `{ key, ttl }`
- `DELETE /api/cache/:key` - Delete cache entry by key
- `GET /api/cache/stats` - Get cache statistics
  - Returns: `{ size, expired, active }`
- `DELETE /api/cache` - Clear all cache entries

## Development

```bash
cd server
npm install
npm run dev
```

## Production

The server will automatically serve the React frontend from `/dist` when `NODE_ENV=production`.

## Environment Variables

See `.env.example` for available environment variables.

