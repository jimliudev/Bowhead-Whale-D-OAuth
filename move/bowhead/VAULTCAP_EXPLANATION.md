# VaultCap 管理机制详解

## 什么是 VaultCap？

`VaultCap` 是一个**能力令牌（Capability Token）**，用于证明持有者拥有管理特定 `KeyVault` 的权限。这是 Sui Move 中常用的**Capability Pattern（能力模式）**设计。

## 核心概念

### 1. 分离所有权和管理权

```
KeyVault (保险库)
  ├── 存储数据：items 列表
  ├── 所有者：owner 字段
  └── 可转移：用户可以转移给他人

VaultCap (能力令牌)
  ├── 指向：vault_id (KeyVault 的 ID)
  ├── 权限证明：拥有此 Cap 才能修改 Vault
  └── 可转移：用户可以转移给他人
```

### 2. 创建时的关系

```move
fun create_vault(...): (KeyVault, VaultCap) {
    let vault = KeyVault {
        id: object::new(ctx),
        owner,
        group_name,
        items: vector::empty(),
    };

    let cap = VaultCap {
        id: object::new(ctx),
        vault_id: object::id(&vault),  // 指向 vault
    };

    (vault, cap)
}
```

**关键点**：
- `VaultCap` 的 `vault_id` 字段存储了 `KeyVault` 的对象 ID
- 创建时两者一起返回给用户
- 用户同时拥有 `KeyVault` 和 `VaultCap`

## VaultCap 如何管理 Vault？

### 1. 权限验证机制

所有修改 `KeyVault` 的操作都需要同时提供 `VaultCap` 和 `KeyVault`：

```move
fun create_private_key(
    cap: &VaultCap,        // 能力令牌（只读引用）
    vault: &mut KeyVault,   // 要修改的保险库（可变引用）
    ...
): PrivateKey {
    // 第一步：验证 Cap 指向的 vault_id 是否匹配
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    
    // 第二步：验证调用者是否是 vault 的所有者
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    
    // 第三步：执行操作（添加 item 到 vault）
    vault.items.push_back(object::id(&item));
    item
}
```

### 2. 双重验证保护

```
验证流程：
┌─────────────────────────────────────┐
│ 1. 检查 Cap.vault_id == Vault.id   │  ← 确保 Cap 指向正确的 Vault
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. 检查 Vault.owner == sender()     │  ← 确保调用者是所有者
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. 执行操作（创建/更新/删除）       │
└─────────────────────────────────────┘
```

### 3. 为什么需要双重验证？

**场景 1：防止 Cap 被误用**
```move
// 用户 A 有 Vault1 和 Cap1
// 用户 B 有 Vault2 和 Cap2

// 如果只有 Cap 验证，用户 A 可能：
create_private_key(Cap1, Vault2, ...)  // ❌ 错误！Cap1 指向 Vault1，不是 Vault2

// 双重验证会检查：
assert!(Cap1.vault_id == Vault2.id)  // ❌ 失败！阻止错误操作
```

**场景 2：防止未授权访问**
```move
// 即使用户获得了 Cap，如果不是 Vault 的所有者，也无法操作
assert!(vault.owner == tx_context::sender(ctx))  // 确保是所有者
```

## 实际使用流程

### 场景：用户创建并管理密码

```move
// 步骤 1：创建保险库
let (vault, cap) = create_vault(owner, "Bowhead Whale", ctx);
// 用户现在拥有：
// - vault: KeyVault 对象（可以查看、转移）
// - cap: VaultCap 对象（管理权限）

// 步骤 2：添加密码项（需要同时提供 cap 和 vault）
create_private_key_entry(
    &cap,        // 证明有管理权限
    &mut vault,  // 要修改的保险库
    "github_password",
    "walrus_blob_id_123",
    nonce,
    ctx
);

// 步骤 3：更新密码项
update_private_key_entry(
    &cap,        // 证明有管理权限
    &vault,      // 要修改的保险库（只读，因为只更新 item）
    &mut item,   // 要更新的项
    "new_walrus_blob_id",
    new_nonce,
    ctx
);

// 步骤 4：删除密码项
delete_private_key_entry(
    &cap,        // 证明有管理权限
    &mut vault,  // 要修改的保险库（需要修改 items 列表）
    item,        // 要删除的项
    ctx
);
```

## VaultCap 的优势

### 1. **权限分离**
- `KeyVault` 可以转移给他人（查看数据）
- `VaultCap` 可以单独管理（控制权限）
- 实现**查看权**和**管理权**的分离

### 2. **安全性**
- 即使 `KeyVault` 被共享，没有 `VaultCap` 也无法修改
- 双重验证防止误操作和未授权访问

### 3. **灵活性**
- 可以创建多个 `VaultCap` 给不同的人（如果需要）
- 可以销毁 `VaultCap` 来撤销管理权限

## 与 passman 项目的对比

参考 `passman/move/passman/sources/vault.move`：

```move
// passman 的实现
fun create_item(cap: &Cap, ..., vault: &mut Vault, ...): Item {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    // 注意：passman 只验证 Cap，不验证 owner
    // 因为 Cap 的持有者就是有权限的人
}
```

**区别**：
- **passman**：只验证 `Cap.vault_id == Vault.id`（Cap 持有者 = 有权限）
- **bowhead**：双重验证 `Cap.vault_id == Vault.id` + `Vault.owner == sender()`（更严格）

## 总结

`VaultCap` 管理 `Vault` 的机制：

1. **身份验证**：通过 `vault_id` 字段证明 Cap 属于哪个 Vault
2. **权限验证**：通过 `owner` 字段确保调用者是所有者
3. **操作授权**：只有同时拥有正确的 Cap 和 Vault 才能执行操作
4. **安全保护**：双重验证防止误操作和未授权访问

这是一个标准的**Capability Pattern**，在 Sui Move 中广泛用于资源访问控制。

