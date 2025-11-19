module bowhead::seal_private_data;

use sui::clock::{Self, Clock};
use sui::object::{Self, UID, ID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use std::string::String;

use bowhead::utils::is_prefix;
use bowhead::oauth_service::{OAuthService, OAuthGrant, ThirdPartyOauthCap};
use std::bool;

// === Errors ===
const ENotOwner: u64 = 0;
const ENoAccess: u64 = 1;
const EShareExpired: u64 = 4;

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
    share_type: u8,  // 0: View, 1: Edit, 2: Delete
    value: String,  // Walrus blob ID
    nonce: vector<u8>,  // Nonce for Seal ID generation
}

/// Capability token for managing a data vault
public struct DataVaultCap has key {
    id: UID,
    vault_id: ID,
}

/// Read-only capability token for viewing a data vault
/// Has an expiration time, after which it becomes invalid
public struct ReadOnlyCap has key {
    id: UID,
    vault_id: ID,
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


/// Create a read-only capability for a vault
/// Only the vault owner can create this
fun create_readonly_cap(
    vault: &DataVault,
    expires_at: u64,
    clock: &Clock,
    ctx: &mut TxContext
): ReadOnlyCap {
    // Ensure expiration time is in the future
    assert!(expires_at > clock::timestamp_ms(clock), EShareExpired);
    ReadOnlyCap {
        id: object::new(ctx),
        vault_id: object::id(vault),
        expires_at,
    }
}

/// Create a data item
fun create_data(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    name: String,
    share_type: u8,
    value: String,  // Walrus blob ID
    nonce: vector<u8>,
    ctx: &mut TxContext
): Data {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);

    let item = Data {
        id: object::new(ctx),
        vault_id: object::id(vault),
        name,
        share_type,
        value,
        nonce,
    };

    vault.items.push_back(object::id(&item));
    item
}

public fun get_data_info(data: &Data): (String, u8, String) {
    (
        data.name,
        data.share_type,
        data.value
    )
}

/// Update a data item
fun update_data(
    cap: &DataVaultCap,
    vault: &DataVault,
    item: &mut Data,
    new_value: String,  // New Walrus blob ID
    new_nonce: vector<u8>,
    ctx: &TxContext
) {
    assert!(cap.vault_id == object::id(vault), ENotOwner);
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    assert!(item.vault_id == object::id(vault), ENotOwner);

    item.value = new_value;
    item.nonce = new_nonce;
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

/// Entry function to create a read-only capability
/// Only the vault owner can create this
/// expires_at: Expiration timestamp in milliseconds
public entry fun create_readonly_cap_entry(
    vault: &DataVault,
    expires_at: u64,
    clock: &Clock,
    service_address: address,
    ctx: &mut TxContext
) {
    assert!(vault.owner == tx_context::sender(ctx), ENotOwner);
    let readonly_cap = create_readonly_cap(vault, expires_at, clock, ctx);
    transfer::transfer(readonly_cap, service_address);
}

/// Entry function to create a data item
public entry fun create_data_entry(
    cap: &DataVaultCap,
    vault: &mut DataVault,
    name: String,
    share_type: u8,
    value: String,  // Walrus blob ID
    nonce: vector<u8>,
    ctx: &mut TxContext
) {
    let item = create_data(cap, vault, name, share_type, value, nonce, ctx);

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
    new_nonce: vector<u8>,
    ctx: &TxContext
) {
    update_data(cap, vault, item, new_value, new_nonce, ctx);

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

// === Seal Access Control ===

/// Check policy for owner access
/// Seal ID format: [vault_id_bytes][nonce]
/// Only the owner can decrypt their data
fun check_owner_policy(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    caller: address
): bool {
    // Only owner can access
    if (vault.owner != caller) {
        return false
    };

    // Check vault ID matches
    if (object::id(vault) != item.vault_id) {
        return false
    };

    // Build expected namespace: vault_id + nonce
    let mut namespace = object::id(vault).to_bytes();
    namespace.append(item.nonce);

    // Check if id starts with namespace
    is_prefix(namespace, id)
}

/// Check policy for read-only access
/// Seal ID format: [vault_id_bytes][nonce]
/// Requires valid ReadOnlyCap that hasn't expired
fun check_readonly_policy(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    readonly_cap: &ReadOnlyCap,
    clock: &Clock
): bool {
    // Check ReadOnlyCap is valid for this vault
    if (readonly_cap.vault_id != object::id(vault)) {
        return false
    };

    // Check if cap has expired
    if (clock::timestamp_ms(clock) > readonly_cap.expires_at) {
        return false
    };

    // Check vault ID matches
    if (object::id(vault) != item.vault_id) {
        return false
    };

    true
}

public fun check_seal_approve_for_test(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    readonly_cap: &ReadOnlyCap,
    clock: &Clock,
    _ctx: &TxContext) : bool{
    let result = check_readonly_policy(id, vault, item, readonly_cap, clock);
    result
}

/// Seal approve function for read-only access
/// Allows holders of ReadOnlyCap to decrypt data (read-only access)
/// Requires valid ReadOnlyCap that hasn't expired
public entry fun seal_approve(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    readonly_cap: &ReadOnlyCap,
    clock: &Clock,
    _ctx: &TxContext
) {
    assert!(check_readonly_policy(id, vault, item, readonly_cap, clock), ENoAccess);
}

/// Check policy for OAuth access
/// Verifies that the service is registered and has authorization
/// Also checks that the service has ThirdPartyOauthCap permission
fun check_oauth_policy(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    service: &OAuthService,
    grant: &OAuthGrant,
    oauth_cap: &ThirdPartyOauthCap,
    clock: &Clock,
    caller: address
): bool {
    use bowhead::oauth_service::{
        get_service_owner,
        get_service_client_id,
        get_grant_client_id,
        get_grant_expires_at,
        get_grant_resource_ids,
        get_oauth_cap_service_id,
    };

    // Check service is registered and caller is service owner
    if (get_service_owner(service) != caller) {
        return false
    };

    // Check ThirdPartyOauthCap is valid for this service
    if (get_oauth_cap_service_id(oauth_cap) != object::id(service)) {
        return false
    };

    // Check grant is valid
    if (get_grant_client_id(grant) != get_service_client_id(service)) {
        return false
    };

    // Check grant hasn't expired
    if (clock::timestamp_ms(clock) > get_grant_expires_at(grant)) {
        return false
    };

    // Check resource is in authorized list
    let resource_ids = get_grant_resource_ids(grant);
    let mut found = false;
    let mut i = 0;
    while (i < vector::length(&resource_ids)) {
        if (*vector::borrow(&resource_ids, i) == object::id(item)) {
            found = true;
            break
        };
        i = i + 1;
    };
    if (!found) {
        return false
    };

    // Check vault ID matches
    if (object::id(vault) != item.vault_id) {
        return false
    };

    // Build expected namespace: vault_id + nonce
    let mut namespace = object::id(vault).to_bytes();
    namespace.append(item.nonce);

    // Check if id starts with namespace
    is_prefix(namespace, id)
}

/// Seal approve function for OAuth access
/// Allows registered services to decrypt authorized resources
/// Requires ThirdPartyOauthCap to verify service has permission
public entry fun seal_approve_oauth(
    id: vector<u8>,
    vault: &DataVault,
    item: &Data,
    service: &OAuthService,
    grant: &OAuthGrant,
    oauth_cap: &ThirdPartyOauthCap,
    clock: &Clock,
    ctx: &TxContext
) {
    assert!(check_oauth_policy(id, vault, item, service, grant, oauth_cap, clock, tx_context::sender(ctx)), ENoAccess);
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

/// Get vault information with read-only cap
/// Checks if the cap has expired
public fun get_vault_info_readonly(
    readonly_cap: &ReadOnlyCap,
    vault: &DataVault,
    clock: &Clock
): (ID, address, String, u64, vector<ID>) {
    assert!(readonly_cap.vault_id == object::id(vault), ENoAccess);
    // Check if cap has expired
    assert!(clock::timestamp_ms(clock) <= readonly_cap.expires_at, EShareExpired);
    get_vault_info(vault)
}

/// Get data item information
public fun get_item_info(item: &Data): (ID, ID, String, u8, String) {
    (
        object::id(item),
        item.vault_id,
        item.name,
        item.share_type,
        item.value,
    )
}

/// Get data item information with read-only cap
/// Checks if the cap has expired
public fun get_item_info_readonly(
    readonly_cap: &ReadOnlyCap,
    item: &Data,
    clock: &Clock
): (ID, ID, String, u8, String) {
    assert!(readonly_cap.vault_id == item.vault_id, ENoAccess);
    // Check if cap has expired
    assert!(clock::timestamp_ms(clock) <= readonly_cap.expires_at, EShareExpired);
    get_item_info(item)
}

