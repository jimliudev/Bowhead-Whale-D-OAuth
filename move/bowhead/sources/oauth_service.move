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
    created_at: u64,
}

/// Capability token for managing OAuth service
public struct ServiceCap has key {
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
    clock: &Clock,
    ctx: &mut TxContext
): (OAuthService, ServiceCap) {
    let service = OAuthService {
        id: object::new(ctx),
        client_id,
        owner,
        redirect_url,
        created_at: clock::timestamp_ms(clock),
    };

    let cap = ServiceCap {
        id: object::new(ctx),
        service_id: object::id(&service),
    };

    (service, cap)
}

public fun get_oauth_service_info(service: &OAuthService): (ID, String, address, String, u64) {
    (
        object::id(service),
        service.client_id,
        service.owner,
        service.redirect_url,
        service.created_at,
    )
}

// === Entry Functions ===

/// Entry function to register an OAuth service
public entry fun register_oauth_service_entry(
    client_id: String,
    redirect_url: String,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let owner = tx_context::sender(ctx);

    let (service, cap) = register_oauth_service(
        client_id,
        owner,
        redirect_url,
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