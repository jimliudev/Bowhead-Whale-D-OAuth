# Bowhead Whale Move Contract

This Move contract provides storage and access control for encrypted data stored on Walrus.

## Architecture

### Modules

1. **`storage.move`** - Core storage module
   - `StorageContainer`: Stores encrypted data references (Walrus blob IDs)
   - `StorageCap`: Capability token for managing containers
   - `Namespace`: Manages Seal ID namespace for encryption/decryption
   - Functions: Create, update, delete storage containers
   - Seal access control via `seal_approve`

2. **`share.move`** - Sharing module
   - `Share`: Temporary access grants to encrypted data
   - `ShareCap`: Capability token for managing shares
   - Functions: Create, update, delete shares
   - Time-based access control (TTL)
   - Seal access control for shared data

3. **`utils.move`** - Utility functions
   - `is_prefix`: Helper for Seal ID namespace validation

## Workflow

### Creating and Storing Encrypted Data

1. **Encrypt data with Seal** (client-side)
   - Generate Seal ID: `[container_id][nonce]`
   - Encrypt data using Seal SDK
   - Upload encrypted data to Walrus → get `blob_id`

2. **Create storage container** (on-chain)
   ```move
   storage::create_storage_entry(name, blob_id, ctx)
   ```
   - Creates `StorageContainer` with blob reference
   - Creates `StorageCap` for management
   - Creates `Namespace` with nonce for Seal ID

### Decrypting Data

1. **Read storage container** (on-chain)
   - Get `blob_id` from `StorageContainer`
   - Get `nonce` from `Namespace`

2. **Build Seal ID**
   - Seal ID = `[container_id_bytes][nonce]`

3. **Build seal_approve transaction bytes** (don't execute)
   ```move
   storage::seal_approve(seal_id, container, namespace, ctx)
   ```

4. **Decrypt with Seal SDK** (client-side)
   - Pass transaction bytes to Seal Key Server
   - Seal Key Server validates access policy
   - Returns decryption key if valid
   - Client decrypts data

### Sharing Data

1. **Create share**
   ```move
   share::create_share_entry(container, namespace, recipients, ttl, ctx)
   ```

2. **Recipients decrypt**
   - Build Seal ID using container namespace
   - Build `share::seal_approve` transaction bytes
   - Seal Key Server validates:
     - Recipient is in recipients list
     - Share hasn't expired (TTL check)
     - Seal ID matches namespace

## Seal Access Control

### Storage Container Access
- `seal_approve` checks:
  - Caller owns the container, OR
  - Seal ID matches namespace policy: `[container_id][nonce]`

### Share Access
- `seal_approve` checks:
  - Caller is in recipients list
  - Share hasn't expired (current_time < created_at + ttl)
  - Seal ID matches container namespace

## Building and Testing

```bash
# Build
sui move build

# Test
sui move test

# Publish (after setting up addresses)
sui client publish --gas-budget 100000000
```

## Integration with Frontend

See `src/lib/construct-move-call.ts` for TypeScript functions to build Move transactions.

