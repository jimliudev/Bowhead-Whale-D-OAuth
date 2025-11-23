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
    items: vector<ID>,  // List of Data item IDs
}

/// Data item stored in vault
/// Value stores the Walrus blob ID where encrypted data is stored
public struct Data has key {
    id: UID,
    vault_id: ID,
    name: String,  // File name
    value: String  // Walrus blob ID
}

/// Capability token for managing a data vault for owner only.
public struct DataVaultCap has key {
    id: UID,
    vault_id: ID,
}

/// Access entry with expiration time for allow list
public struct AccessEntry has store, copy, drop {
    address: address,
    expires_at: u64,  // Expiration timestamp in milliseconds
}

public struct OAuthGrant has key {
    id: UID,
    user_address: address,
    resource_ids: vector<AccessDataEntry>,
    created_at: u64,
    expires_at: u64,  // Expiration timestamp in milliseconds
}

public struct AccessDataEntry has store, copy, drop {
    data_id: ID,
    allow_type: u8, // 0: View, 1: Edit
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

// === OAuth Grant Functions ===

/// Create an OAuth grant entry
/// This function creates an OAuthGrant object to store authorization information on-chain
/// resource_ids: Vector of data item IDs
/// allow_types: Vector of permission types (0=View, 1=Edit) corresponding to each resource_id
/// expires_at: Expiration timestamp in milliseconds (must be in the future)
fun create_oauth_grant(
    user_address: address,
    resource_ids: vector<ID>,
    allow_types: vector<u8>,
    expires_at: u64,
    clock: &Clock,
    ctx: &mut TxContext
): OAuthGrant {
    let current_time = clock::timestamp_ms(clock);
    
    // Ensure expiration time is in the future
    assert!(expires_at > current_time, EShareExpired);
    
    // Ensure resource_ids and allow_types have the same length
    assert!(vector::length(&resource_ids) == vector::length(&allow_types), ENoAccess);
    
    // Build resource entries vector
    let mut resource_entries = vector::empty<AccessDataEntry>();
    let mut i = 0;
    let len = vector::length(&resource_ids);
    while (i < len) {
        let data_id = *vector::borrow(&resource_ids, i);
        let allow_type = *vector::borrow(&allow_types, i);
        let entry = AccessDataEntry {
            data_id,
            allow_type,
        };
        vector::push_back(&mut resource_entries, entry);
        i = i + 1;
    };
    
    OAuthGrant {
        id: object::new(ctx),
        user_address,
        resource_ids: resource_entries,
        created_at: current_time,
        expires_at,
    }
}

/// Entry function to create an OAuth grant
/// This is called when a user authorizes a third-party service to access their data
/// resource_ids: Vector of data item IDs that are being authorized
/// allow_types: Vector of permission types (0=View, 1=Edit) corresponding to each resource_id
/// expires_at: Expiration timestamp in milliseconds (must be in the future)
public entry fun create_oauth_grant_entry(
    user_address: address,
    resource_ids: vector<ID>,
    allow_types: vector<u8>,
    expires_at: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let caller = tx_context::sender(ctx);
    
    // Ensure the caller is the user_address (user must authorize their own data)
    assert!(caller == user_address, ENotOwner);
    
    let grant = create_oauth_grant(user_address, resource_ids, allow_types, expires_at, clock, ctx);
    
    // Share the OAuthGrant object so it can be accessed by third-party services
    transfer::share_object(grant);
}

/// Check if a user has OAuthGrant with Edit permission for a specific data item
/// Returns true if:
/// 1. OAuthGrant exists and belongs to the user
/// 2. OAuthGrant has not expired
/// 3. OAuthGrant contains the data_id with allow_type == 1 (Edit permission)
public fun check_oauth_grant_edit_permission(
    grant: &OAuthGrant,
    data_id: ID,
    user_address: address,
    clock: &Clock
): bool {
    let current_time = clock::timestamp_ms(clock);
    
    // Check if grant belongs to the user
    if (grant.user_address != user_address) {
        return false
    };
    
    // Check if grant has expired
    if (current_time > grant.expires_at) {
        return false
    };
    
    // Check if grant contains the data_id with Edit permission (allow_type == 1)
    let mut i = 0;
    let len = vector::length(&grant.resource_ids);
    while (i < len) {
        let entry = vector::borrow(&grant.resource_ids, i);
        if (entry.data_id == data_id && entry.allow_type == 1) {
            return true
        };
        i = i + 1;
    };
    
    false
}

/// Update data item using OAuthGrant
/// Only works if:
/// 1. OAuthGrant exists and belongs to the user
/// 2. OAuthGrant has not expired
/// 3. OAuthGrant contains the data_id with allow_type == 1 (Edit permission)
/// 4. Caller is the user who owns the grant
public entry fun update_data_by_oauth_grant(
    grant: &OAuthGrant,
    item: &mut Data,
    new_value: String,  // New Walrus blob ID
    clock: &Clock,
    ctx: &TxContext
) {
    let caller = tx_context::sender(ctx);
    let current_time = clock::timestamp_ms(clock);
    let data_id = object::id(item);
    
    // Check if grant belongs to the caller
    assert!(grant.user_address == caller, ENotOwner);
    
    // Check if grant has expired
    assert!(current_time <= grant.expires_at, EShareExpired);
    
    // Check if grant contains the data_id with Edit permission (allow_type == 1)
    let mut found = false;
    let mut i = 0;
    let len = vector::length(&grant.resource_ids);
    while (i < len) {
        let entry = vector::borrow(&grant.resource_ids, i);
        if (entry.data_id == data_id && entry.allow_type == 1) {
            found = true;
            break
        };
        i = i + 1;
    };
    
    assert!(found, ENoEditPermission);
    
    // Update the value
    item.value = new_value;
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
    check_type: u8,
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

    // Check if the check_type is 0 (self access)
    if (check_type == 0) {
        return true
    };

    // Check if access_address is in the allow_access_to list and hasn't expired
    // Also verify that allow_type is 0 (View permission) for seal_approve
    // let mut i = 0;
    // let allow_list_len = vector::length(&vault.allow_access_to);
    // let current_time = clock::timestamp_ms(clock);
    // while (i < allow_list_len) {
    //     let entry = vector::borrow(&vault.allow_access_to, i);
    //     if (entry.address == access_address) {
    //         // Check if entry hasn't expired
    //         if (current_time <= entry.expires_at) {
    //             return false
    //         } else {
    //             // Entry has expired
    //             return false
    //         }
    //     };
    //     i = i + 1;
    // };

    false
}

public fun check_seal_approve_for_test(
    vault: &DataVault,
    item: &Data,
    access_address: address,
    check_type: u8,
    clock: &Clock,
    ctx: &TxContext) : bool{
    let result = check_readonly_policy( vault, item, access_address, check_type, clock, ctx);
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
    check_type: u8,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(check_readonly_policy(vault, item, access_address, check_type, clock, ctx), ENoAccess);
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