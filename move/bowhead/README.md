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

sui keytool import suiprivkey1qr8ex8v60jq4h43ad8xr38v8z6tetkce4czdsk5wsr0a2mzl3g0qzr3ta2r ed25519

sui client switch --address 0x1e73c640d345028a6fe7c656a1a094d5c2d292e1818487d456177bae1daaf32f

sui client call \
--package 0x41b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c74 \
--module seal_private_data \
--function create_data_vault_entry \
--args Basic

sui client call \
--package 0x41b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c74 \
--module seal_private_data \
--function create_data_entry \
--args 0x2e6e700277e63f861619405ecba860535efcba3a45be01b23a42c1323528f22f 0x9268c62a439a270552b462059eeb79332320d16ca34f287530aa1a05c364a9db Email 0 test@gmail.com 0


create_readonly_cap_entry

sui client call \
--package 0x41b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c74 \
--module seal_private_data \
--function create_readonly_cap_entry \
--args 0xd25766a545d94444aa5d6ec9e83efd2884919f6b24b59226576c92ba4e9dbb65 1058165238189000 0x6 0x1e73c640d345028a6fe7c656a1a094d5c2d292e1818487d456177bae1daaf32f


1300 成功 - User1 DataVault User1 SessionId

packageid :
0xcf402055c5e349e9baf41004c328e4bf851842a3714ea362d9844d8ced972676

User1 DataVaultCap:
0x2e6e700277e63f861619405ecba860535efcba3a45be01b23a42c1323528f22f

User1 DataVault:
0x9268c62a439a270552b462059eeb79332320d16ca34f287530aa1a05c364a9db

User1 ReadCap :
0x18dfdccedb1ca4a29cb91e6ce77f6c43e011bc2ffb04e4cde825a97a6f1ac9cc

User1 Data Object : 
0x4375833d80f4748320f722340bc7679baa60a97dec903f7f03cd602c74368d83

- User1 DataVault Owner SessionId

Owner ReadCap :
0x8dde58e5f2bcb1574e44b0509945718f256dfea88ba50d80bfe5025a287ae8b3

加密訊息：
00cf402055c5e349e9baf41004c328e4bf851842a3714ea362d9844d8ced97267627424f57484541445748414c452d442d4f415554485f4143434553532d444154412d504f4c4943590273d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db7501f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8020200adf9467ba92767bb791108883e84ffdac389c6f652b5ef7abf378a0cb20cf1ffeb0abf6fc07bcdcfb6ededb4e4a5037717bc53ca340f0647145395a88e508572e73b06e23facd1d126efcc23afbbc308aaebb01c38a093a3bc93e39fc398a639021359d3eb52eac23a131faa0b44a705cfc587eeeb8e7177b3f9830bdd3250a03c729496031a93b8c0bbd21189f993685ab6928001ce3186a9095fd14dc69afb33b5301a7b185c6af8fc176f10f119a1f19511518faee46e8376b6fcac11ffeb00002cd22f0c7bb6a355fface211fa14a38d76bf6af18baa2d1645b943df461f5e7a3d475be5a840ba0bc98f94bb520100

seal id:
424f57484541445748414c452d442d4f415554485f4143434553532d444154412d504f4c494359

{
  "address": "0x1e73c640d345028a6fe7c656a1a094d5c2d292e1818487d456177bae1daaf32f",
  "packageId": "0xcf402055c5e349e9baf41004c328e4bf851842a3714ea362d9844d8ced972676",
  "timestamp": 1763452628960
}


share object.
packageid = 0x41b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c74

User1 DataVaultCap:
0x6961d211e82d1d406c53de10be20c0759d2563f219d044e430a1b00c66bb38df

User1 DataVault:
0xd25766a545d94444aa5d6ec9e83efd2884919f6b24b59226576c92ba4e9dbb65

User1 ReadCap :
0xab38440c72c903975b9d6167e3273c5491474b1497163e829e18ea09a3f4228a


User1 Data Object : 
0x713b43eac604fa074107b8826967dbf585bc9a869295b14b41b5026b236e5ddc


- User1 DataVault Owner SessionId

Owner ReadCap :
0x6296bbcaf4e7facd4f7fbb7e9284072d34f7b7180729d4b5f2c6994d2a66b5f9

加密訊息：
0041b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c7427424f57484541445748414c452d442d4f415554485f4143434553532d444154412d504f4c4943590273d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db7501f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c802020092273e346c20c11329bc34d743a74116e11c01cc01fe1857f68908c65766fab449636a9ff5258d04b292fa8d6405a89b0f6ca74c3aad57c031219b62b1a25e854fe573755a329ebae7f632da63d6d53cbea9bd7518e762ad9e0a136e2bc152e202e41a1632154d3304b703ce7930eedcda3fc052ccf615746e75048284f6281f2dff5da38b68218bd06dc1b686c900c242d8453d5a7a1e3091dbfe97a0523a06312dccda1ee57d1a666dc4352023d0fbdcb657d55a5f9386f3cb06a75c8fa20f96002ff1fa2743375964cb2592e0a74bca76f464d906942541759f3316f7c5394bb36509b15e5182a38daef9771dfe4ddcb30100




加密訊息：
0041b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c7427424f57484541445748414c452d442d4f415554485f4143434553532d444154412d504f4c4943590273d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db7501f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8020200a815bd4ac570b0a2c7d92266153a95eb3ca5018db21524cf4270da3f5655cead908e02409acfa77ad28bfff8d40c1fc00fca63bd8f5a7c9793a35635b9383ac11fa6c3ee208a5de7c199dd62b993a7f6cba7d280808e55b1fab197385b06a5e002c326cfd8dc1229e62bc43246ebf4090a3ade6a124bcc42f360a9211b6ac3362e7850e7887a7ebdccb0bd9b9d37c1ae0e2ed3c1c9f12e10c7c0181046ec63947b42a7082eb95be11fd7d6d2e4bf71cec56a951fa865faf56b9cdee4db00f5a0bd00143211ec6ae93122872346d9e7809d91e1885913190100


{
  "address": "0x1e73c640d345028a6fe7c656a1a094d5c2d292e1818487d456177bae1daaf32f",
  "packageId": "0x41b85c5f88a0ff61e6e97a570e538cfb44d3856a43ae281cedd1e402a50f4c74",
  "timestamp": 1763456156013
}


walrus
ovD7zkp0waCSpK2SQwItrxY3DUxrxbVBGKpyF0a29Ko