# ReadOnlyCap 设计说明

## 问题：为什么需要 ReadOnlyCap？

### 原来的设计问题

```move
// 原来的设计：只有 VaultCap
public struct VaultCap has key {
    id: UID,
    vault_id: ID,
}

// 所有操作都需要 VaultCap
fun create_private_key(cap: &VaultCap, vault: &mut KeyVault, ...)
fun update_private_key(cap: &VaultCap, vault: &KeyVault, ...)
fun delete_private_key(cap: &VaultCap, vault: &mut KeyVault, ...)
```

**问题**：
- 如果 VaultCap 和 Vault 总是由同一个人拥有，Cap 就没有意义
- 无法区分"查看权"和"管理权"
- 无法实现真正的权限分离

### 新的设计：ReadOnlyCap + VaultCap

```move
// 管理权：可以修改
public struct VaultCap has key {
    id: UID,
    vault_id: ID,
}

// 查看权：只能查看，不能修改
public struct ReadOnlyCap has key {
    id: UID,
    vault_id: ID,
}
```

## 权限分离

### 权限矩阵

| 操作 | ReadOnlyCap | VaultCap | 拥有 Vault |
|------|------------|----------|-----------|
| 查看 vault 信息 | ✅ | ✅ | ✅ |
| 查看 item 信息 | ✅ | ✅ | ✅ |
| 创建 item | ❌ | ✅ | ❌ |
| 更新 item | ❌ | ✅ | ❌ |
| 删除 item | ❌ | ✅ | ❌ |
| 创建 ReadOnlyCap | ❌ | ✅ | ❌ |

### 使用场景

#### 场景 1：家庭共享

```move
// 家长创建 vault
let (vault, manage_cap, read_only_cap) = create_vault(@0xParent, "Family", ctx);

// 家长保留管理权
transfer::transfer(manage_cap, @0xParent);

// 家长给每个家庭成员 ReadOnlyCap（查看权）
transfer::transfer(read_only_cap, @0xChild1);
transfer::transfer(read_only_cap, @0xChild2);

// 家庭成员可以查看，但不能修改
get_vault_info(&read_only_cap, &vault);  // ✅ 可以
create_private_key_entry(&read_only_cap, &mut vault, ...);  // ❌ 不可以

// 家长可以修改
create_private_key_entry(&manage_cap, &mut vault, ...);  // ✅ 可以
```

#### 场景 2：企业密码管理

```move
// 管理员创建 vault
let (vault, manage_cap, read_only_cap) = create_vault(@0xAdmin, "Company", ctx);

// 管理员保留管理权
transfer::transfer(manage_cap, @0xAdmin);

// 管理员给员工 ReadOnlyCap
transfer::transfer(read_only_cap, @0xEmployee1);
transfer::transfer(read_only_cap, @0xEmployee2);

// 员工可以查看，但不能修改
get_item_info(&read_only_cap, &vault, &item);  // ✅ 可以
update_private_key_entry(&read_only_cap, &vault, &mut item, ...);  // ❌ 不可以

// 管理员可以修改
update_private_key_entry(&manage_cap, &vault, &mut item, ...);  // ✅ 可以
```

## 实现细节

### 1. 创建时同时生成两个 Cap

```move
fun create_vault(...): (KeyVault, VaultCap, ReadOnlyCap) {
    let vault = KeyVault { ... };
    let manage_cap = VaultCap { vault_id: object::id(&vault) };
    let read_only_cap = ReadOnlyCap { vault_id: object::id(&vault) };
    (vault, manage_cap, read_only_cap)
}
```

### 2. 查看函数需要 ReadOnlyCap 或 VaultCap

```move
// 使用 ReadOnlyCap 查看
public fun get_vault_info(
    cap: &ReadOnlyCap,  // 只需要 ReadOnlyCap
    vault: &KeyVault
): (ID, address, String, u64) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    // 返回信息
}

// 使用 VaultCap 也可以查看（VaultCap 权限更高）
public fun get_vault_info_with_manage_cap(
    cap: &VaultCap,  // VaultCap 也可以用于查看
    vault: &KeyVault
): (ID, address, String, u64) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    // 返回信息
}
```

### 3. 修改函数只接受 VaultCap

```move
// 只接受 VaultCap，不接受 ReadOnlyCap
fun create_private_key(
    cap: &VaultCap,        // 必须是 VaultCap
    vault: &mut KeyVault,
    ...
): PrivateKey {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    // 创建 item
}
```

### 4. 可以从 VaultCap 创建 ReadOnlyCap

```move
// 管理员可以创建多个 ReadOnlyCap 给不同的人
public entry fun create_read_only_cap_entry(
    manage_cap: &VaultCap,  // 需要管理权才能创建
    vault: &KeyVault,
    ctx: &mut TxContext
) {
    let read_only_cap = ReadOnlyCap {
        id: object::new(ctx),
        vault_id: object::id(vault),
    };
    transfer::transfer(read_only_cap, tx_context::sender(ctx));
}
```

## 优势

### 1. 真正的权限分离

```
ReadOnlyCap（查看权）
├── 可以查看 vault 和 items
├── 不能修改任何内容
└── 可以转移给他人（共享查看权）

VaultCap（管理权）
├── 可以查看 vault 和 items
├── 可以创建/更新/删除 items
├── 可以创建 ReadOnlyCap
└── 可以转移给他人（转移管理权）
```

### 2. 灵活的使用场景

- **家庭共享**：家长有管理权，家庭成员有查看权
- **企业密码管理**：管理员有管理权，员工有查看权
- **临时授权**：可以临时给某人 ReadOnlyCap，随时可以撤销（销毁 Cap）

### 3. 清晰的权限边界

- ReadOnlyCap：明确表示"只能查看"
- VaultCap：明确表示"可以管理"
- 编译器会阻止用 ReadOnlyCap 调用修改函数

## 总结

### 关键改进

1. **ReadOnlyCap**：专门用于查看，不能修改
2. **VaultCap**：用于管理，可以修改
3. **权限分离**：真正实现了查看权和管理权的分离
4. **灵活性**：可以从 VaultCap 创建多个 ReadOnlyCap 给不同的人

### 使用建议

- 创建 vault 时，同时获得两个 Cap
- 保留 VaultCap（管理权）
- 将 ReadOnlyCap 转移给需要查看的人
- 需要时可以创建更多 ReadOnlyCap

这样的设计才能真正体现出 Cap 的价值！

