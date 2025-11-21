module bowhead::bowhead_tests;

use sui::test_scenario::{Self as ts, Scenario};
use sui::tx_context::TxContext;
use sui::object::{Self, UID};
use sui::sui::SUI;
use std::string;
use sui::clock::{Self, Clock};
use sui::transfer;

use bowhead::seal_private_data::{
    Self,
    DataVault,
    Data,
    DataVaultCap,
    ReadOnlyCap,
    get_data_vault_info,
    create_data_entry,
    get_data_info,
    create_readonly_cap_entry,
    get_vault_info_readonly,
    check_seal_approve_for_test,
    add_to_allow_list
};
use bowhead::oauth_service::{
    Self,
    OAuthService,
    OAuthGrant,
    ServiceCap,
    ThirdPartyOauthCap,
    register_oauth_service_entry,
    get_oauth_service_info,
    get_oauth_cap_service_id,
};

// Test addresses
const OWNER: address = @0xA1;
const USER1: address = @0xB1;
const THIRDPARTY_SERVICE: address = @0xC1;


#[test]
fun test_create_data_vault() {
    let mut scenario = ts::begin(USER1);
    
    // Transaction 1: Create vault
    ts::next_tx(&mut scenario, USER1);
    {
        let group_name = string::utf8(b"TestVault");
        seal_private_data::create_data_vault_entry(group_name, ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let vault = ts::take_shared<DataVault>(&scenario);
        let cap = ts::take_from_sender<DataVaultCap>(&scenario);

        let (vault_id, owner, group_name, items) = get_data_vault_info(&vault);
       
        assert!(owner == USER1, 1);
        assert!(group_name == string::utf8(b"TestVault"), 1);
        assert!(items == 0, 1);
        assert!(vault_id == object::id(&vault), 1);

        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    ts::end(scenario);
}

#[test]
fun test_oauth_service() {
    let mut scenario = ts::begin(THIRDPARTY_SERVICE);
    
    // Transaction 1: Create and share Clock
    ts::next_tx(&mut scenario, THIRDPARTY_SERVICE);
    {
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::share_for_testing(clock);
    };
    
    // Transaction 2: Create OAuth service
    ts::next_tx(&mut scenario, THIRDPARTY_SERVICE);
    {
        let client_id = string::utf8(b"test_client_id");
        let redirect_url = string::utf8(b"https://test.com");
        let resource_types = vector::empty();
        let clock_ref = ts::take_shared<Clock>(&scenario);

        oauth_service::register_oauth_service_entry(client_id, redirect_url, resource_types, &clock_ref, ts::ctx(&mut scenario));
        ts::return_shared<Clock>(clock_ref);
    };

    ts::next_tx(&mut scenario, THIRDPARTY_SERVICE);
    {
        let service = ts::take_shared<OAuthService>(&scenario);
        let cap = ts::take_from_sender<ServiceCap>(&scenario);
        
        let (service_id, client_id, owner, redirect_url, resource_types, created_at) = get_oauth_service_info(&service);
        
        assert!(owner == THIRDPARTY_SERVICE, 1);
        assert!(client_id == string::utf8(b"test_client_id"), 2);
        assert!(redirect_url == string::utf8(b"https://test.com"), 3);
        
        ts::return_shared(service);
        ts::return_to_sender(&scenario, cap);
    };

    ts::end(scenario);
}

#[test]
fun test_create_data_item_gmail(){
    let mut scenario = ts::begin(USER1);
    
    // Transaction 1: Create vault
    ts::next_tx(&mut scenario, USER1);
    {
        let group_name = string::utf8(b"TestVault");
        seal_private_data::create_data_vault_entry(group_name, ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let mut vault = ts::take_shared<DataVault>(&scenario);
        let mut cap = ts::take_from_sender<DataVaultCap>(&scenario);

        create_data_entry(
            &mut cap, 
            &mut vault, 
            string::utf8(b"gmail"), 
            0, 
            string::utf8(b"walrus_blob_id_123"), 
            vector::empty(), 
            ts::ctx(&mut scenario));
       
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let vault = ts::take_shared<DataVault>(&scenario);
        let cap = ts::take_from_sender<DataVaultCap>(&scenario);
        let data = ts::take_shared<Data>(&scenario);

        let (vault_id, owner, group_name, items) = get_data_vault_info(&vault);
        let (name, share_type, value) = get_data_info(&data);
        
        assert!(owner == USER1, 1);
        assert!(group_name == string::utf8(b"TestVault"), 1);
        assert!(items == 1, 1);        
        assert!(name == string::utf8(b"gmail"), 1);
        assert!(share_type == 0, 1);
        assert!(value == string::utf8(b"walrus_blob_id_123"), 1);
        assert!(vault_id == object::id(&vault), 1);
        
        ts::return_shared(data);
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    ts::end(scenario);
}

#[test]
fun test_user_oauth_grant_to_third_party_service() {
    let mut scenario = ts::begin(USER1);
    
    // Transaction 1: Create vault
    ts::next_tx(&mut scenario, USER1);
    {
        let group_name = string::utf8(b"TestVault");
        seal_private_data::create_data_vault_entry(group_name, ts::ctx(&mut scenario));

        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::share_for_testing(clock);
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let mut vault = ts::take_shared<DataVault>(&scenario);
        let mut cap = ts::take_from_sender<DataVaultCap>(&scenario);

        create_data_entry(
            &mut cap, 
            &mut vault, 
            string::utf8(b"gmail"), 
            0, 
            string::utf8(b"walrus_blob_id_123"), 
            vector::empty(), 
            ts::ctx(&mut scenario));
       
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let vault = ts::take_shared<DataVault>(&scenario);
        let cap = ts::take_from_sender<DataVaultCap>(&scenario);
        let data = ts::take_shared<Data>(&scenario);

        let (vault_id, owner, group_name, items) = get_data_vault_info(&vault);
        let (name, share_type, value) = get_data_info(&data);
        
        ts::return_shared(data);
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    ts::next_tx(&mut scenario, USER1);
    {
        let cap = ts::take_from_sender<DataVaultCap>(&scenario);
        let mut vault = ts::take_shared<DataVault>(&scenario);
        let clock_ref = ts::take_shared<Clock>(&scenario);

        create_readonly_cap_entry(
            &vault, 
            1000000000000, 
            &clock_ref, 
            THIRDPARTY_SERVICE, 
            ts::ctx(&mut scenario));

        add_to_allow_list(
            &cap, 
            &mut vault, 
            THIRDPARTY_SERVICE, 
            1058217183006600, 
            &clock_ref, 
            ts::ctx(&mut scenario));

        ts::return_shared(clock_ref);
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, cap);
    };

    // change THIRDPARTY_SERVICE to OWNER for testing other Service without OAuth.
    ts::next_tx(&mut scenario, USER1);
    {
        let vault = ts::take_shared<DataVault>(&scenario);
        let clock_ref = ts::take_shared<Clock>(&scenario);
        let data = ts::take_shared<Data>(&scenario);
        let readonly_cap = ts::take_from_sender<ReadOnlyCap>(&scenario);

       
        
        let result = check_seal_approve_for_test(
            &vault,
            &data, 
            THIRDPARTY_SERVICE, 
            &clock_ref, 
            ts::ctx(&mut scenario));

        // let (vault_id, owner, group_name, items, items_ids) = get_vault_info_readonly(&readonly_cap, &vault, &clock_ref);
        let (name, share_type, value) = get_data_info(&data);
     
        assert!(result, 1);
        // assert!(vault_id == object::id(&vault), 1);
        // assert!(owner == USER1, 1);
        // assert!(group_name == string::utf8(b"TestVault"), 1);
        // assert!(items == 1, 1);
        assert!(name == string::utf8(b"gmail"), 1);
        assert!(share_type == 0, 1);
        assert!(value == string::utf8(b"walrus_blob_id_123"), 1);

        ts::return_shared(data);
        ts::return_shared(vault);
        ts::return_to_sender(&scenario, readonly_cap);
        ts::return_shared(clock_ref);
    };

    ts::end(scenario);
}