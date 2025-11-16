module bowhead::oauth_service;

use sui::clock::{Self, Clock};
// use sui::event;
use sui::object::{Self, UID, ID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use std::string::String;

// Note: OAuth access control functions are in seal_private_data module
// because they need access to private fields of Data struct

// === Errors ===
const ENotOwner: u64 = 0;
const ENoAccess: u64 = 1;
const EServiceNotRegistered: u64 = 2;
const EInvalidClientId: u64 = 3;
const EShareExpired: u64 = 4;
const ENotAuthorized: u64 = 5;

// === Structs ===

/// OAuth service registration
/// Services must register to use OAuth functionality
public struct OAuthService has key {
    id: UID,
    client_id: String,
    owner: address,
    redirect_url: String,
    resource_types: vector<u8>,  // Allowed resource types
    created_at: u64,
}

/// OAuth authorization grant
/// Stores user's authorization for a service to access specific resources
public struct OAuthGrant has key {
    id: UID,
    client_id: String,  // OAuth service client ID
    user_address: address,  // User who granted access
    owner_address: address,  // Resource owner (usually same as user_address)
    resource_ids: vector<ID>,  // List of authorized resource IDs
    created_at: u64,
    expires_at: u64,  // Expiration timestamp
    access_token: String,  // Access token for the grant
}

/// Capability token for managing OAuth service
public struct ServiceCap has key {
    id: UID,
    service_id: ID,
}

/// Capability token for authorizing third-party OAuth services
/// This cap must be held by the service to use OAuth functionality
public struct ThirdPartyOauthCap has key {
    id: UID,
    service_id: ID,
}

// === Events ===

public struct OAuthServiceRegistered has copy, drop {
    service_id: ID,
    client_id: String,
    owner: address,
}

public struct OAuthGrantCreated has copy, drop {
    grant_id: ID,
    client_id: String,
    user_address: address,
    resource_ids: vector<ID>,
}

// === Functions ===

/// Register an OAuth service
fun register_oauth_service(
    client_id: String,
    owner: address,
    redirect_url: String,
    resource_types: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
): (OAuthService, ServiceCap) {
    let service = OAuthService {
        id: object::new(ctx),
        client_id,
        owner,
        redirect_url,
        resource_types,
        created_at: clock::timestamp_ms(clock),
    };

    let cap = ServiceCap {
        id: object::new(ctx),
        service_id: object::id(&service),
    };

    (service, cap)
}

public fun get_oauth_service_info(service: &OAuthService): (ID, String, address, String, vector<u8>, u64) {
    (
        object::id(service),
        service.client_id,
        service.owner,
        service.redirect_url,
        service.resource_types,
        service.created_at,
    )
}

/// Create a third-party OAuth capability for a service
/// Only the service owner can create this
fun create_third_party_oauth_cap(
    service: &OAuthService,
    ctx: &mut TxContext
): ThirdPartyOauthCap {
    ThirdPartyOauthCap {
        id: object::new(ctx),
        service_id: object::id(service),
    }
}

/// Create an OAuth grant
fun create_oauth_grant(
    client_id: String,
    user_address: address,
    owner_address: address,
    resource_ids: vector<ID>,
    expires_at: u64,
    access_token: String,
    clock: &Clock,
    ctx: &mut TxContext
): OAuthGrant {
    OAuthGrant {
        id: object::new(ctx),
        client_id,
        user_address,
        owner_address,
        resource_ids,
        created_at: clock::timestamp_ms(clock),
        expires_at,
        access_token,
    }
}

// === Entry Functions ===

/// Entry function to register an OAuth service
public entry fun register_oauth_service_entry(
    client_id: String,
    redirect_url: String,
    resource_types: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let owner = tx_context::sender(ctx);

    let (service, cap) = register_oauth_service(
        client_id,
        owner,
        redirect_url,
        resource_types,
        clock,
        ctx
    );

    // event::emit(OAuthServiceRegistered {
    //     service_id: object::id(&service),
    //     client_id: service.client_id,
    //     owner,
    // });

    transfer::share_object(service);
    transfer::transfer(cap, owner);
}

/// Entry function to create a third-party OAuth capability
/// Only the service owner can create this
public entry fun create_third_party_oauth_cap_entry(
    service: &OAuthService,
    ctx: &mut TxContext
) {
    assert!(service.owner == tx_context::sender(ctx), ENotOwner);
    let oauth_cap = create_third_party_oauth_cap(service, ctx);
    transfer::transfer(oauth_cap, tx_context::sender(ctx));
}

/// Entry function to create an OAuth grant
public entry fun create_oauth_grant_entry(
    client_id: String,
    owner_address: address,
    resource_ids: vector<ID>,
    expires_at: u64,
    access_token: String,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let user_address = tx_context::sender(ctx);
    let grant = create_oauth_grant(
        client_id,
        user_address,
        owner_address,
        resource_ids,
        expires_at,
        access_token,
        clock,
        ctx
    );

    // event::emit(OAuthGrantCreated {
    //     grant_id: object::id(&grant),
    //     client_id: grant.client_id,
    //     user_address: grant.user_address,
    //     resource_ids: grant.resource_ids,
    // });

    transfer::share_object(grant);
}

// === OAuth Access Control ===
// Note: check_oauth_policy and seal_approve_oauth are in seal_private_data module
// because they need access to private fields of Data struct

// === View Functions ===

/// Check if service is registered
public fun is_service_registered(service: &OAuthService, client_id: String): bool {
    service.client_id == client_id
}

/// Get service owner
public fun get_service_owner(service: &OAuthService): address {
    service.owner
}

/// Get service client ID
public fun get_service_client_id(service: &OAuthService): String {
    service.client_id
}

/// Get grant client ID
public fun get_grant_client_id(grant: &OAuthGrant): String {
    grant.client_id
}

/// Get grant expiration time
public fun get_grant_expires_at(grant: &OAuthGrant): u64 {
    grant.expires_at
}

/// Get grant resource IDs
public fun get_grant_resource_ids(grant: &OAuthGrant): vector<ID> {
    grant.resource_ids
}

/// Get OAuth cap service ID
public fun get_oauth_cap_service_id(oauth_cap: &ThirdPartyOauthCap): ID {
    oauth_cap.service_id
}

