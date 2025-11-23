# Bowhead Whale - D OAuth

> Decentralized OAuth infrastructure based on Sui Move smart contracts, Walrus Blob storage, and Seal encryption protocol

## 📋 Project Overview

Bowhead Whale (also known as D OAuth) is a **decentralized OAuth infrastructure** that provides secure, decentralized user data management and authorization mechanisms for the Web3 ecosystem. By combining **Walrus Blob storage** and the **Seal encryption protocol**, it achieves fully decentralized user data management and third-party service authorization flows.

## 🎯 Core Pain Points & Solutions

### **1️⃣ Centralized Dependency of Traditional OAuth → Decentralized OAuth Mechanism**

| Category | Pain Points | Solutions |
| --- | --- | --- |
| **End Users** | ❌ User data is controlled by centralized service providers, lacking autonomy | ✅ Users authorize through wallet signatures, gaining full control over their data<br>➡ Benefit: Users keep full ownership of their data without relying on third-party cloud services (e.g., Google Drive). |
| **Service Providers** | ❌ Traditional OAuth 2.0 relies on centralized authorization servers<br>❌ Single point of failure may cause service interruptions across all integrated services | ✅ Implement a fully decentralized authorization flow using Sui Move smart contracts<br>✅ No centralized servers required, reducing single point of failure risks |

---

### **2️⃣ Fragmented & Insecure User Data Management → Unified Data Management + End-to-End Encryption**

| Category | Pain Points | Solutions |
| --- | --- | --- |
| **End Users** | ❌ User data (images, videos, text, passwords) is scattered across multiple platforms<br>❌ Password managers and storage systems are separated, causing fragmented user experience | ✅ Unified management of all user data (images, videos, text, passwords)<br>✅ All data is encrypted on the client side before storage, accessible only to authorized parties |
| **Service Providers** | ❌ No unified encrypted storage solution | ✅ Integrates Walrus Blob Storage (decentralized storage) and Seal encryption protocol |

---

### **3️⃣ Lack of Trust When Third-Party Services Access User Data → Fine-Grained Authorization Control**

| Category | Pain Points | Solutions |
| --- | --- | --- |
| **End Users** | ❌ Users must provide sensitive data directly to third-party services | ✅ Users can selectively authorize access without exposing sensitive data |
| **Service Providers** | ❌ No fine-grained access control (read, edit, delete)<br>❌ Cannot track or revoke previously granted permissions | ✅ Supports fine-grained permissions: View, Edit, Delete<br>✅ All authorizations recorded on-chain, traceable and revocable<br>➡ Benefit: Third-party services can access authorized Walrus data using traditional HTTP APIs, reducing the learning cost of Walrus and Seal. |

---

### **4️⃣ Complex Onboarding for New Users → Automated Password Management**

| Category | Pain Points | Solutions |
| --- | --- | --- |
| **End Users** | ❌ Users must manually register before using third-party services | ✅ A password is automatically created on first login (auto-registration) |

## 🛠 Technical Architecture

### Core Technology Stack

- **Sui Move Smart Contracts** - Decentralized authorization logic and data structure management
- **Walrus Blob Storage** - Decentralized data storage infrastructure
- **Seal Encryption Protocol** - End-to-end encryption and access policy control
- **Wallet Signature Authentication** - User identity verification and authorization signatures

### Technical Implementation Highlights

1. **On-Chain Authorization Management**
   - `OAuthService` - Third-party service registration and whitelist management
   - `OAuthGrant` - User authorization records (includes resource types and expiration)
   - `check_policy` - Verifies if service is in whitelist

2. **Data Structure Design**
   - `DataVault` - Universal data vault (images, videos, text)
   - `KeyVault` - Password vault
   - `AccessEntry` - Time-limited access control entry

3. **Seal Encryption Integration**
   - Data encrypted and stored as Walrus Blob ID
   - Fine-grained access control through `seal_approve` method
   - Only authorized third-party services can decrypt corresponding resources

## 🚀 Core Features

### Feature Set 1: User Data Management

#### Feature 1: Universal Data Management
- Add, delete, modify data (images, videos, text) through Walrus
- Supports group management (Group Name)
- Fine-grained permission control (View/Edit/Delete)

#### Feature 2: Password Management
- Add, delete, modify passwords through Walrus
- Supports various password types (website passwords, bank passwords, etc.)
- Automated password synchronization and verification

### Feature Set 2: D OAuth Authorization Mechanism

#### Feature 1: Service Registration
- Third-party services register and obtain `clientId`
- Select requestable resource types
- Wallet private key authenticates service identity

#### Feature 2: OAuth Authorization Flow
- Users authorize third-party services through wallet signatures
- Selectively authorize specific resource types
- Supports time-limited access authorization

#### Feature 3: Automatic New User Registration
- Automatically creates passwords when first logging into third-party services
- Seamlessly integrated into OAuth flow
- Automatically synchronized to Bowhead Whale management interface

#### Feature 4: Quick Login for Existing Users
- Supports Common password mechanism
- Set once, use across multiple services
- Automatically validates user input

## 📊 Workflows

### Path 1: Service Provider Registration
```
Service Provider → Bowhead Whale Interface → Register Service
                 → Enter service name, description, Redirect URL
                 → Obtain clientId
                 → Record to DOAuth_Service_AllowList
```

### Path 2: User D OAuth Login
```
User → Third-party service login button
     → Redirect to Bowhead Whale OAuth page
     → Wallet signature authorization
     → Contract verifies if service is in whitelist
     → Create/Update Auth_List
     → Return access_token
```

### Path 3: Service Provider Accessing User Resources
```
Service Provider → HTTP GET Bowhead Whale API
                 → Provide access_token
                 → Contract executes seal_approve
                 → check_policy verifies authorization
                 → Return encrypted resource URL
                 → Service provider decrypts using secret_key
```

## 🔐 Security Features

- ✅ **End-to-End Encryption** - All data encrypted using Seal protocol
- ✅ **On-Chain Authorization Verification** - All authorization records on-chain, tamper-proof
- ✅ **Time-Limited Access** - Supports access expiration control
- ✅ **Fine-Grained Permissions** - Three-level permission control (View/Edit/Delete)
- ✅ **Whitelist Mechanism** - Only registered services can request authorization

## 📁 Contract Structure

- `seal_private_data.move` - Data vault and Seal encryption integration
- `oauth_service.move` - OAuth service registration and authorization management
- `utils.move` - Utility functions

## 🔗 Related Resources

- [Walrus Documentation](https://github.com/MystenLabs/awesome-walrus)
- [Seal Documentation](https://seal-docs.wal.app/)
- [Sui Move Documentation](https://docs.sui.io/build/move)

---

**Bowhead Whale** - Making Web3 user data management more secure, autonomous, and convenient
