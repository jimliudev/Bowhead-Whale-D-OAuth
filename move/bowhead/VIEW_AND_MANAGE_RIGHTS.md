# KeyVault 和 VaultCap 的权限分离原理详解

## 核心概念：查看权 vs 管理权

### 1. 两种权限的定义

```
查看权（View Right）
├── 可以查看 KeyVault 的内容
├── 可以读取 items 列表
├── 可以查看每个 PrivateKey 的信息
└── 但不能修改、添加、删除

管理权（Manage Right）
├── 可以添加新的 PrivateKey
├── 可以更新现有的 PrivateKey
├── 可以删除 PrivateKey
└── 可以修改 KeyVault 的结构
```

### 2. 对象的所有权机制

在 Sui Move 中，对象的所有权决定了谁可以访问它：

```move
// KeyVault 的结构
public struct KeyVault has key {
    id: UID,
    owner: address,
    group_name: String,
    items: vector<ID>,  // 公开的列表，任何人都可以读取
}

// VaultCap 的结构
public struct VaultCap has key {
    id: UID,
    vault_id: ID,  // 指向 KeyVault 的 ID
}
```

## 权限分离的工作原理

### 场景 1：正常使用（用户同时拥有两者）

```move
// 创建时
let (vault, cap) = create_vault(owner, "My Vault", ctx);
transfer::transfer(vault, owner);   // 转移给用户
transfer::transfer(cap, owner);     // 转移给用户

// 用户现在拥有：
// - vault: 可以查看内容
// - cap: 可以管理内容
```

**用户的操作能力**：
- ✅ 查看：可以直接读取 `vault.items`
- ✅ 管理：可以使用 `cap` 来添加/更新/删除 items

### 场景 2：分离查看权和管理权

#### 2.1 转移 KeyVault（只转移查看权）

```move
// 用户 A 创建 vault
let (vault, cap) = create_vault(@0xA, "Vault", ctx);
transfer::transfer(vault, @0xA);
transfer::transfer(cap, @0xA);

// 用户 A 转移 vault 给用户 B（但保留 cap）
transfer::transfer(vault, @0xB);  // 只转移 vault，不转移 cap

// 结果：
// - 用户 B 拥有 vault：可以查看所有 items
// - 用户 A 拥有 cap：可以管理 vault（添加/删除 items）
```

**权限分布**：
```
用户 A (拥有 VaultCap)
├── ✅ 可以添加 PrivateKey 到 vault
├── ✅ 可以更新 vault 中的 PrivateKey
├── ✅ 可以删除 vault 中的 PrivateKey
└── ❌ 无法直接查看 vault（需要 vault 对象）

用户 B (拥有 KeyVault)
├── ✅ 可以查看 vault.items 列表
├── ✅ 可以读取每个 PrivateKey 的信息
├── ✅ 可以查看 vault.group_name
└── ❌ 无法修改 vault（没有 VaultCap）
```

#### 2.2 为什么需要同时提供两者才能修改？

```move
fun create_private_key(
    cap: &VaultCap,        // 证明有管理权限
    vault: &mut KeyVault,  // 要修改的对象
    ...
): PrivateKey {
    // 验证 1：确保 cap 指向这个 vault
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    
    // 验证 2：确保调用者是 vault 的所有者
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    
    // 执行：修改 vault
    vault.items.push_back(object::id(&item));
}
```

**关键点**：
1. **需要 `cap`**：证明调用者有管理权限
2. **需要 `vault`**：需要修改的对象本身
3. **双重验证**：确保 cap 属于这个 vault，且调用者是 vault 的所有者

## 实际应用场景

### 场景 A：家庭共享密码库

```
家庭成员共享查看权，但只有家长有管理权

创建者（家长）：
├── 创建 vault 和 cap
├── 转移 vault 给家庭成员（共享查看）
└── 保留 cap（保留管理权）

家庭成员：
├── 可以查看所有密码（拥有 vault）
└── 无法添加/删除密码（没有 cap）

家长：
├── 可以添加新密码（拥有 cap）
├── 可以删除旧密码（拥有 cap）
└── 无法直接查看（需要 vault，但可以要求家庭成员提供）
```

### 场景 B：企业密码管理

```
员工可以查看，但只有管理员可以修改

管理员：
├── 创建 vault 和 cap
├── 转移 vault 给员工（查看权）
└── 保留 cap（管理权）

员工：
├── 可以查看密码（拥有 vault）
└── 无法修改（没有 cap）

管理员：
├── 可以添加/更新/删除密码（拥有 cap）
└── 需要时可以从员工那里获取 vault 来查看
```

### 场景 C：临时授权

```
临时给某人管理权限，但保留查看权

所有者：
├── 创建 vault 和 cap
├── 保留 vault（查看权）
└── 临时转移 cap 给助手（管理权）

助手：
├── 可以添加/删除密码（拥有 cap）
└── 无法直接查看（没有 vault，但可以要求所有者提供）

所有者：
├── 可以查看所有密码（拥有 vault）
└── 可以随时收回 cap（撤销管理权）
```

## 技术实现细节

### 1. Sui 对象的所有权系统

在 Sui 中，对象的所有权有几种类型：

```move
// 1. Owned Object（拥有对象）
transfer::transfer(vault, owner);
// - 只有 owner 可以访问
// - 可以转移给他人
// - 可以销毁

// 2. Shared Object（共享对象）
transfer::share_object(vault);
// - 任何人都可以读取
// - 任何人都可以修改（通过交易）
// - 不能转移所有权

// 3. Immutable Object（不可变对象）
transfer::freeze_object(vault);
// - 任何人都可以读取
// - 不能修改
// - 不能转移
```

### 2. 为什么 KeyVault 使用 Owned，而不是 Shared？

```move
// 当前设计：KeyVault 是 Owned Object
transfer::transfer(vault, owner);

// 如果使用 Shared Object：
transfer::share_object(vault);
// 问题：任何人都可以修改，失去了访问控制
```

**选择 Owned 的原因**：
- ✅ 只有所有者可以访问（查看权控制）
- ✅ 可以转移给他人（实现查看权共享）
- ✅ 配合 VaultCap 实现管理权分离

### 3. 为什么需要 VaultCap？

**如果没有 VaultCap**：
```move
// 假设只有 KeyVault，没有 Cap
fun create_private_key(
    vault: &mut KeyVault,
    ...
) {
    // 只能验证 owner
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    vault.items.push_back(...);
}

// 问题：
// - 如果 vault 被转移，新所有者自动获得管理权
// - 无法实现"查看权"和"管理权"的分离
```

**有了 VaultCap**：
```move
// 需要同时提供 cap 和 vault
fun create_private_key(
    cap: &VaultCap,
    vault: &mut KeyVault,
    ...
) {
    // 验证 1：cap 指向这个 vault
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    // 验证 2：调用者是 vault 的所有者
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    vault.items.push_back(...);
}

// 优势：
// - vault 可以转移（查看权）
// - cap 可以单独控制（管理权）
// - 实现权限分离
```

## 权限矩阵

| 操作 | 拥有 KeyVault | 拥有 VaultCap | 同时拥有两者 |
|------|--------------|---------------|--------------|
| 查看 items 列表 | ✅ | ❌ | ✅ |
| 读取 PrivateKey 信息 | ✅ | ❌ | ✅ |
| 添加 PrivateKey | ❌ | ✅ | ✅ |
| 更新 PrivateKey | ❌ | ✅ | ✅ |
| 删除 PrivateKey | ❌ | ✅ | ✅ |
| 转移查看权 | ✅ | ❌ | ✅ |
| 转移管理权 | ❌ | ✅ | ✅ |

## 安全考虑

### 1. 防止权限滥用

```move
// 场景：用户 A 有 cap，用户 B 有 vault
// 用户 A 尝试修改用户 B 的 vault

create_private_key_entry(
    &cap_A,      // 用户 A 的 cap
    &mut vault_B, // 用户 B 的 vault
    ...
);

// 验证会失败：
assert!(cap_A.vault_id == object::id(vault_B))  // ❌ 失败！cap 指向不同的 vault
```

### 2. 防止未授权访问

```move
// 场景：用户 C 尝试使用用户 A 的 cap 来修改用户 B 的 vault

create_private_key_entry(
    &cap_A,      // 用户 A 的 cap（指向 vault_A）
    &mut vault_B, // 用户 B 的 vault
    ...
);

// 验证会失败：
assert!(cap_A.vault_id == object::id(vault_B))  // ❌ 失败！
```

### 3. 防止误操作

```move
// 场景：用户有多个 vault，但 cap 指向错误的 vault

let vault1 = ...;  // 用户想修改这个
let vault2 = ...;  // 但 cap 指向这个
let cap = ...;     // cap.vault_id == vault2.id

create_private_key_entry(&cap, &mut vault1, ...);

// 验证会失败：
assert!(cap.vault_id == object::id(vault1))  // ❌ 失败！防止误操作
```

## 代码示例：完整的权限分离流程

```move
// === 步骤 1：创建并分离权限 ===

// 用户 A 创建 vault
let (vault, cap) = create_vault(@0xA, "Shared Vault", ctx);
transfer::transfer(vault, @0xA);
transfer::transfer(cap, @0xA);

// 用户 A 转移查看权给用户 B
transfer::transfer(vault, @0xB);  // 用户 B 现在可以查看

// 用户 A 保留管理权（cap 还在 @0xA）

// === 步骤 2：用户 B 查看内容 ===

// 用户 B 可以读取 vault（因为拥有 vault）
let items = vault.items;  // ✅ 可以查看

// === 步骤 3：用户 A 管理内容 ===

// 用户 A 需要从用户 B 那里获取 vault 的引用
// （在实际场景中，可能需要用户 B 提供或使用共享对象）

// 用户 A 添加新密码
create_private_key_entry(
    &cap,        // 用户 A 的 cap（证明有管理权）
    &mut vault,  // 需要 vault 对象（用户 B 拥有，但可以提供引用）
    "new_password",
    "blob_id",
    nonce,
    ctx
);

// === 步骤 4：用户 B 查看更新 ===

// 用户 B 可以立即看到新添加的 item（因为拥有 vault）
let updated_items = vault.items;  // ✅ 包含新添加的 item
```

## 总结

### 权限分离的核心原理

1. **KeyVault（查看权）**：
   - 存储实际数据（items 列表）
   - 可以转移给他人（共享查看权）
   - 拥有者可以查看内容

2. **VaultCap（管理权）**：
   - 不存储数据，只存储 vault_id（指向关系）
   - 可以单独控制（独立于 vault）
   - 拥有者可以修改 vault

3. **双重验证机制**：
   - 验证 cap 指向正确的 vault
   - 验证调用者是 vault 的所有者
   - 确保只有同时拥有两者才能修改

### 设计优势

- ✅ **灵活性**：可以分别控制查看权和管理权
- ✅ **安全性**：双重验证防止误操作和未授权访问
- ✅ **可扩展性**：可以创建多个 cap 给不同的人
- ✅ **可撤销性**：可以销毁 cap 来撤销管理权

这是 Sui Move 中经典的 **Capability Pattern（能力模式）**，实现了细粒度的权限控制。

