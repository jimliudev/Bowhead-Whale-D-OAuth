# Bowhead Whale Move 合约设计文档

## 概述

Bowhead Whale 是一个去中心化的 OAuth 基础设施（D OAuth），结合了 Walrus（去中心化存储）和 Seal（加密协议）技术。本合约实现了两个核心功能模块。

## 模块架构

### 1. `seal_private_key.move` - 私人密钥管理

**用途**：存储和管理用户的私人数据，包括：
- Private keys
- 各平台的账号密码
- 只有用户本人可以访问

**核心结构**：
- `KeyVault`: 密钥保险库，包含多个 `PrivateKey` 项目
- `PrivateKey`: 单个密钥/密码项，存储 Walrus blob ID
- `VaultCap`: 管理保险库的能力令牌

**Seal 访问控制**：
- `seal_approve` 函数验证：
  - 调用者必须是保险库所有者
  - Seal ID 必须匹配命名空间：`[vault_id_bytes][nonce]`

**数据流程**：
1. 用户创建 `KeyVault`（可以创建多个，通过 `group_name` 分组）
2. 使用 Seal 加密密码/密钥数据
3. 上传加密数据到 Walrus，获得 `blob_id`
4. 创建 `PrivateKey` 项，存储 `blob_id` 和 `nonce`
5. 解密时：构建 `seal_approve` 交易字节码，传给 Seal SDK

### 2. `seal_private_data.move` - OAuth 数据管理

**用途**：管理一般数据（图片、视频、文字）并提供 OAuth 授权机制

**核心结构**：
- `DataVault`: 数据保险库
- `Data`: 数据项，包含 `share_type`（View/Edit/Delete）
- `OAuthService`: OAuth 服务注册
- `OAuthGrant`: OAuth 授权令牌

**Seal 访问控制**：

1. **所有者访问** (`seal_approve`):
   - 调用者必须是保险库所有者
   - Seal ID 必须匹配命名空间

2. **OAuth 访问** (`seal_approve_oauth`):
   - 服务必须已注册（`OAuthService`）
   - 必须存在有效的授权令牌（`OAuthGrant`）
   - 授权令牌未过期
   - 资源 ID 在授权列表中
   - Seal ID 必须匹配命名空间

**OAuth 流程**：

1. **服务注册**：
   - 服务方调用 `register_oauth_service_entry`
   - 提供 `client_id`、`redirect_url`、`resource_types`
   - 获得 `ServiceCap` 用于管理服务

2. **用户授权**：
   - 用户访问第三方服务
   - 第三方服务重定向到 Bowhead Whale OAuth 页面
   - 用户选择要授权的资源
   - 创建 `OAuthGrant`，包含：
     - `client_id`
     - `resource_ids`（授权的资源列表）
     - `expires_at`（过期时间）
     - `access_token`

3. **服务访问数据**：
   - 服务方使用 `access_token` 调用 Seal 解密
   - 构建 `seal_approve_oauth` 交易字节码
   - Seal Key Server 验证：
     - 服务已注册
     - 授权令牌有效且未过期
     - 资源在授权列表中

## Seal ID 生成规则

两个模块都遵循相同的 Seal ID 格式：

```
Seal ID = [vault_id_bytes][nonce]
```

- `vault_id_bytes`: 保险库对象 ID 的字节表示
- `nonce`: 随机生成的 nonce（存储在 `PrivateKey` 或 `Data` 中）

## 数据结构映射

### 功能一：用户数据管理

**一般数据**：
```
DataVault (group_name: "用户性别、信箱")
  └── Data (name: "文件名", share_type: View/Edit/Delete, value: "walrus_blob_id")
```

**密码数据**：
```
KeyVault (group_name: "Bowhead Whale")
  └── PrivateKey (name: "服务名称hash", value: "walrus_blob_id")
```

### 功能二：OAuth 授权

```
OAuthService (client_id, redirect_url, resource_types)
  └── OAuthGrant (user_address, resource_ids, expires_at, access_token)
```

## 安全考虑

1. **访问控制**：
   - 所有操作都验证调用者身份
   - Seal 访问通过 `seal_approve` 函数严格验证

2. **OAuth 安全**：
   - 服务必须注册才能使用
   - 授权令牌有过期时间
   - 资源级别的访问控制

3. **数据隐私**：
   - 实际数据存储在 Walrus（链下）
   - 链上只存储 blob ID 引用
   - 所有数据都经过 Seal 加密

## 使用示例

### 创建密钥保险库并存储密码

```move
// 1. 创建保险库
seal_private_key::create_vault_entry("Bowhead Whale", ctx);

// 2. 创建密钥项（客户端需要先加密数据并上传到 Walrus）
seal_private_key::create_private_key_entry(
    cap,
    vault,
    "github_password_hash",
    "walrus_blob_id_123",
    nonce,
    ctx
);
```

### 注册 OAuth 服务

```move
seal_private_data::register_oauth_service_entry(
    "my_service_client_id",
    "https://myservice.com/callback",
    resource_types,
    clock,
    ctx
);
```

### 创建 OAuth 授权

```move
seal_private_data::create_oauth_grant_entry(
    "my_service_client_id",
    user_address,
    resource_ids,
    expires_at,
    "access_token_xyz",
    clock,
    ctx
);
```

## 测试

运行测试：
```bash
sui move test
```

测试覆盖：
- 创建保险库
- 创建/更新/删除数据项
- OAuth 服务注册
- OAuth 授权创建
- Seal 访问控制验证

