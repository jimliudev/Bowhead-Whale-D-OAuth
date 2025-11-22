module bowhead::seal_private_data;

use sui::clock::{Self, Clock};
use sui::object::{Self, UID, ID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use std::string::String;

use bowhead::utils::is_prefix;
use bowhead::oauth_service::{ OAuthService };
use std::bool;

// === Errors ===
const ENotOwner: u64 = 0;
const ENoAccess: u64 = 1;
const EVaultNotEmpty: u64 = 2;
const EShareExpired: u64 = 4;
const EEditCapExpired: u64 = 5;
const EEditCapMismatch: u64 = 6;
const ENoEditPermission: u64 = 7;

// === Structs ===

/// Data vault for storing general data (images, videos, text)
public struct DataVault has key {
    id: UID,
    owner: address,
    group_name: String,
    allow_access_to: vector<AccessEntry>,  // List of addresses with expiration times
    items: vector<ID>,  // List of Data item IDs
}

/// Data item stored in vault
/// Value stores the Walrus blob ID where encrypted data is stored
public struct Data has key {
    id: UID,
    vault_id: ID,
    name: String,  // File name
    value: String,  // Walrus blob ID
    allow_access_to: vector<AccessEntry>,
}

/// Capability token for managing a data vault for owner only.
public struct DataVaultCap has key {
    id: UID,
    vault_id: ID,
}

/// Access entry with expiration time for allow list
public struct AccessEntry has store, copy, drop {
    address: address,
    allow_type: u8,  // 0: View, 1: Edit,
    expires_at: u64,  // Expiration timestamp in milliseconds
}

/// Capability token for editing a data vault
public struct EditVaultDataCap has key {
    id: UID,
    vault_id: ID,
    data_id: ID,
    expires_at: u64,  // Expiration timestamp in milliseconds
}


// === Events ===

public struct DataVaultCreated has copy, drop {
    vault_id: ID,
    owner: address,
    group_name: String,
}

public struct DataCreated has copy, drop {
    item_id: ID,
    vault_id: ID,
    name: String,
    share_type: u8,
}

public struct DataUpdated has copy, drop {
    item_id: ID,
    vault_id: ID,
}

public struct DataDeleted has copy, drop {
    item_id: ID,
    vault_id: ID,
}

public struct DataVaultDeleted has copy, drop {
    vault_id: ID,
    owner: address,
}

// === Functions ===

/// Create a new data vault
fun create_data_vault(
    owner: address,
    group_name: String,
    ctx: &mut TxContext
): (DataVault, DataVaultCap) {
    let vault = DataVault {
        id: object::new(ctx),
        owner,
        group_name,
        items: vector::empty(),
        allow_access_to: vector::empty<AccessEntry>(),
    };

    let cap = DataVaultCap {
        id: object::new(ctx),
        vault_id: object::id(&vault),
    };

    (vault, cap)
}

public fun get_data_vault_info(vault: &DataVault): (ID, address, String, u64) {
    (
        object::id(vault),
        vault.owner,
        vault.group_name,
        vector::length(&vault.items),
    )
}


/// Create a data item
fun create_data(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    name: String,
    value: String,  // Walrus blob ID
    ctx: &mut TxContext
): Data {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);

    let item = Data {
        id: object::new(ctx),
        vault_id: object::id(vault),
        name,
        value,
        allow_access_to: vector::empty<AccessEntry>(),
    };

    vault.items.push_back(object::id(&item));
    item
}

public fun get_data_info(data: &Data): (String, String) {
    (
        data.name,
        data.value
    )
}

/// Update a data item
fun update_data(
    cap: &DataVaultCap,
    vault: &DataVault,
    item: &mut Data,
    new_value: String,  // New Walrus blob ID
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    assert!(item.vault_id == object::id(vault), ENotOwner);

    item.value = new_value;
}

/// Delete a data item
fun delete_data(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    item: Data,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    assert!(item.vault_id == object::id(vault), ENotOwner);

    // Remove from vault items list
    let mut i = 0;
    while (i < vector::length(&vault.items)) {
        if (*vector::borrow(&vault.items, i) == object::id(&item)) {
            vector::remove(&mut vault.items, i);
            break
        };
        i = i + 1;
    };

    let Data { id, .. } = item;
    object::delete(id);
}

/// Delete a data vault
/// Requires:
/// 1. Valid DataVaultCap matching the vault
/// 2. Caller must be the vault owner
/// 3. Vault must be empty (no items)
/// Note: Since DataVault is a shared object, it cannot be deleted.
/// This function deletes the DataVaultCap, effectively making the vault inaccessible.
fun delete_data_vault(
    cap: DataVaultCap,
    vault: &DataVault,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    // Require vault to be empty before deletion
    assert!(vector::length(&vault.items) == 0, EVaultNotEmpty);

    let DataVaultCap { id, .. } = cap;
    object::delete(id);
}

/// Add addresses to the allow list of a data vault with expiration time
/// Only the vault owner can modify the allow list
/// If address already exists, update its expiration time
/// expires_at: Expiration timestamp in milliseconds (must be in the future)
public entry fun add_to_allow_list(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    access_address: address,
    allow_type: u8,
    expires_at: u64,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    // Ensure expiration time is in the future
    assert!(expires_at > clock::timestamp_ms(clock), EShareExpired);

    // Check if address is already in the list
    let mut found = false;
    let mut i = 0;
    let allow_list_len = vector::length(&vault.allow_access_to);
    while (i < allow_list_len) {
        let entry = vector::borrow(&vault.allow_access_to, i);
        if (entry.address == access_address) {
            // Update expiration time for existing entry
            let mut updated_entry = *entry;
            updated_entry.expires_at = expires_at;
            *vector::borrow_mut(&mut vault.allow_access_to, i) = updated_entry;
            found = true;
            break
        };
        i = i + 1;
    };
    
    // Add new entry if not found
    if (!found) {
        let new_entry = AccessEntry {
            address: access_address,
            allow_type: allow_type,
            expires_at,
        };
        vector::push_back(&mut vault.allow_access_to, new_entry);
    };
}

// === Entry Functions ===

/// Entry function to create a data vault
public entry fun create_data_vault_entry(
    group_name: String,
    ctx: &mut TxContext
) {
    let owner = tx_context::sender(ctx);
    let (vault, cap) = create_data_vault(owner, group_name, ctx);

    // event::emit(DataVaultCreated {
    //     vault_id: object::id(&vault),
    //     owner,
    //     group_name: vault.group_name,
    // });

    transfer::share_object(vault);
    transfer::transfer(cap, owner);
}

/// Entry function to create a data item
public entry fun create_data_entry(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    name: String,
    value: String,  // Walrus blob ID
    ctx: &mut TxContext
) {
    let item = create_data(cap, vault, name, value, ctx);

    // event::emit(DataCreated {
    //     item_id: object::id(&item),
    //     vault_id: item.vault_id,
    //     name: item.name,
    //     share_type: item.share_type,
    // });

    transfer::share_object(item);
}

/// Entry function to update a data item
public entry fun update_data_entry(
    cap: &DataVaultCap,
    vault: &DataVault,
    item: &mut Data,
    new_value: String,  // New Walrus blob ID
    ctx: &TxContext
) {
    update_data(cap, vault, item, new_value, ctx);

    // event::emit(DataUpdated {
    //     item_id: object::id(item),
    //     vault_id: item.vault_id,
    // });
}

/// Entry function to delete a data item
public entry fun delete_data_entry(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    item: Data,
    ctx: &TxContext
) {
    let item_id = object::id(&item);
    let vault_id = item.vault_id;
    delete_data(cap, vault, item, ctx);

    // event::emit(DataDeleted {
    //     item_id,
    //     vault_id,
    // });
}

/// Entry function to delete a data vault
/// Requires the vault to be empty (no items)
/// Deletes the DataVaultCap, making the vault inaccessible
public entry fun delete_data_vault_entry(
    cap: DataVaultCap,
    vault: &DataVault,
    ctx: &TxContext
) {
    let vault_id = object::id(vault);
    let owner = vault.owner;
    delete_data_vault(cap, vault, ctx);

    // event::emit(DataVaultDeleted {
    //     vault_id,
    //     owner,
    // });
}

/// Update a data item's value using EditVaultDataCap
/// Only third-party services with valid EditVaultDataCap and whitelist permission can call this
/// 
/// Security checks:
/// 1. EditVaultDataCap must not be expired
/// 2. EditVaultDataCap's data_id must match the data item
/// 3. Caller (tx_context::sender) must be in Data's allow_access_to whitelist
/// 4. Whitelist entry must have Edit permission (allow_type == 1)
/// 5. Whitelist entry must not be expired
public entry fun update_data_by_third_party(
    edit_cap: &EditVaultDataCap,
    item: &mut Data,
    new_value: String,  // New Walrus blob ID
    clock: &Clock,
    ctx: &TxContext
) {
    let caller = tx_context::sender(ctx);
    let current_time = clock::timestamp_ms(clock);
    
    // Check if EditVaultDataCap has expired
    assert!(edit_cap.expires_at >= current_time, EEditCapExpired);
    
    // Check if EditVaultDataCap's data_id matches the data item
    assert!(edit_cap.data_id == object::id(item), EEditCapMismatch);
    
    // Check if caller is in Data's allow_access_to whitelist with Edit permission
    let mut found = false;
    let mut i = 0;
    let allow_list_len = vector::length(&item.allow_access_to);
    while (i < allow_list_len) {
        let entry = vector::borrow(&item.allow_access_to, i);
        if (entry.address == caller) {
            // Check if entry has Edit permission (allow_type == 1)
            assert!(entry.allow_type == 1, ENoEditPermission);
            // Check if entry hasn't expired
            assert!(current_time <= entry.expires_at, EShareExpired);
            found = true;
            break
        };
        i = i + 1;
    };
    
    // Ensure caller is in whitelist
    assert!(found, ENoAccess);
    
    // Update the value
    item.value = new_value;
    
    // event::emit(DataUpdated {
    //     item_id: object::id(item),
    //     vault_id: item.vault_id,
    // });
}

/// Entry function to add addresses to the allow list of a data vault
/// Only the vault owner can modify the allow list
/// expires_at: Expiration timestamp in milliseconds (must be in the future)
public entry fun create_data_vault_allow_list(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    access_address: address,
    allow_type: u8,
    expires_at: u64,
    clock: &Clock,
    ctx: &TxContext
) {
    add_to_allow_list(cap, vault, access_address, allow_type, expires_at, clock, ctx);
}

// === Seal Access Control ===


/// Check policy for read-only access
/// Seal ID format: [vault_id_bytes][nonce]
/// Requires valid ReadOnlyCap that hasn't expired
/// Also checks if access_address is in the allow_access_to list and hasn't expired
fun check_readonly_policy(
    vault: &DataVault,
    item: &Data,
    access_address: address,
    clock: &Clock,
    ctx: &TxContext
): bool {
    // Only owner's sessionKey can access the data vault
    let caller = tx_context::sender(ctx);

    if (caller != vault.owner) {
        return false
    };

    // Check vault ID matches
    if (object::id(vault) != item.vault_id) {
        return false
    };

    // Check if access_address is in the allow_access_to list and hasn't expired
    let mut i = 0;
    let allow_list_len = vector::length(&vault.allow_access_to);
    let current_time = clock::timestamp_ms(clock);
    while (i < allow_list_len) {
        let entry = vector::borrow(&vault.allow_access_to, i);
        if (entry.address == access_address) {
            // Check if entry hasn't expired
            if (current_time <= entry.expires_at) {
                return true
            } else {
                // Entry has expired
                return false
            }
        };
        i = i + 1;
    };

    false
}

/// Remove expired entries from the allow list
/// Only the vault owner can clean the allow list
public entry fun clean_expired_allow_list(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);

    let current_time = clock::timestamp_ms(clock);
    let mut i = 0;
    while (i < vector::length(&vault.allow_access_to)) {
        let entry = vector::borrow(&vault.allow_access_to, i);
        if (entry.expires_at < current_time) {
            // Entry has expired, remove it
            vector::remove(&mut vault.allow_access_to, i);
        } else {
            i = i + 1;
        };
    };
}

/// Remove a specific address from the allow list
/// Only the vault owner can remove addresses
public entry fun remove_from_allow_list(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    access_address: address,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);

    let mut i = 0;
    while (i < vector::length(&vault.allow_access_to)) {
        let entry = vector::borrow(&vault.allow_access_to, i);
        if (entry.address == access_address) {
            vector::remove(&mut vault.allow_access_to, i);
            break
        };
        i = i + 1;
    };
}

public fun check_seal_approve_for_test(
    vault: &DataVault,
    item: &Data,
    access_address: address,
    clock: &Clock,
    ctx: &TxContext) : bool{
    let result = check_readonly_policy(vault, item, access_address, clock, ctx);
    result
}

/// Seal approve function for read-only access
/// Allows holders of ReadOnlyCap to decrypt data (read-only access)
/// Requires valid ReadOnlyCap that hasn't expired
/// Also checks if caller is in the allow_access_to list
public entry fun seal_approve(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    access_address: address,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(check_readonly_policy(vault, item, access_address, clock, ctx), ENoAccess);
}


// === View Functions ===

/// Get vault information
/// Can be called with either DataVaultCap or ReadOnlyCap
public fun get_vault_info(vault: &DataVault): (ID, address, String, u64, vector<ID>) {
    (
        object::id(vault),
        vault.owner,
        vault.group_name,
        vector::length(&vault.items),
        vault.items,
    )
}


/// Get allow list information
/// Returns vector of addresses and their expiration times
/// Only vault owner can view this information
public fun get_allow_list_info(
    cap: &DataVaultCap,
    vault: &DataVault,
    ctx: &TxContext
): vector<AccessEntry> {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    vault.allow_access_to
}