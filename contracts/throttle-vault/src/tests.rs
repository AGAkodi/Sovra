//! Unit tests. Signatures below were produced by the backend signer
//! (backend/src/risk/attestation.ts, seed = [7u8; 32]) so these tests also
//! prove the Rust and TypeScript attestation formats are byte-identical.

use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const SIGNER_PK: &str = "ed25519:GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB";
const SIG_ROUTINE: &str = "c627ab69ca22120222a079e539a762cf98dabf9589209a5e0241e2a28b262e9440f200ef4e7cbf3a3fa4cde99feb06844626f73d524df0359d8d7700239c0201";
const SIG_SPIKE: &str = "7e0bc03326dd4ef7b1a16039131bb57cb4c58ac45c0fc26a3fc000594ed10bf55f5426d46b8a39ed04c9f08269aeb98bfda66d506cdd4cef1dd19b6bf5fc2b09";
const SIG_BLOCKED: &str = "3f8dc8e83c6cc27c5e9edf19614279d6960c5f96a656776075b322ef2d98b29fa40f403600a57265edaab57a237f95ed655ea6dec2b87d4d54ba5569e64c450e";
const SIG_OVERCAP: &str = "0a95cabecf9d0a0677678ea967fcf11f9d69555c50bc9b69df8e0b8aa3f31c30c5966ea4585da181bf1ae76842cf71c1568142c335592bfb7e524abeede0ad06";

const NOW: u64 = 1_700_000_000_000_000_000;
const EXPIRY: u64 = 1_700_000_300_000_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn near(n: u128) -> NearToken {
    NearToken::from_near(n)
}
fn vault_id() -> AccountId {
    acc("vault.testnet")
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn agent() -> AccountId {
    acc("agent.testnet")
}
fn worker() -> AccountId {
    acc("service-worker.testnet")
}

fn set_ctx(predecessor: AccountId, balance: NearToken, timestamp: u64) {
    let ctx = VMContextBuilder::new()
        .current_account_id(vault_id())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor)
        .account_balance(balance)
        .block_timestamp(timestamp)
        .build();
    testing_env!(ctx);
}

fn setup_with(chain_id: &str, signer: Option<&str>, balance: NearToken) -> ThrottleVault {
    set_ctx(owner(), balance, NOW);
    let mut v = ThrottleVault::new(
        owner(),
        chain_id.to_string(),
        signer.map(|s| s.parse().unwrap()),
        near(30),
        near(100),
        true,
    );
    v.set_agent(agent(), true);
    v.set_recipient(worker(), true);
    set_ctx(agent(), balance, NOW);
    v
}

fn setup() -> ThrottleVault {
    setup_with("testnet", Some(SIGNER_PK), near(100))
}

fn routine(v: &mut ThrottleVault) -> RequestOutcome {
    v.request_payment(worker(), near(3), "req-routine".into(), U64(EXPIRY), 1, 10, 1, SIG_ROUTINE.into())
}

fn spike(v: &mut ThrottleVault) -> RequestOutcome {
    v.request_payment(worker(), near(25), "req-spike".into(), U64(EXPIRY), 1, 72, 5, SIG_SPIKE.into())
}

#[test]
fn message_format_matches_backend() {
    let msg = attestation_message("testnet", &vault_id(), "req-routine", &worker(), near(3), 10, 1, 1, EXPIRY);
    assert_eq!(
        msg,
        "throttle-attestation-v1|testnet|vault.testnet|req-routine|service-worker.testnet|3000000000000000000000000|10|1|1|1700000300000000000"
    );
}

#[test]
fn routine_payment_with_valid_attestation_executes() {
    let mut v = setup();
    assert_eq!(routine(&mut v), RequestOutcome::Executing { request_id: "req-routine".into() });
    let req = v.get_request("req-routine".into()).unwrap();
    assert_eq!(req.status, RequestStatus::Executing);
    assert_eq!(v.reserved_balance, near(3));
}

#[test]
#[should_panic(expected = "Invalid attestation signature")]
fn tampered_amount_is_rejected() {
    let mut v = setup();
    v.request_payment(worker(), near(4), "req-routine".into(), U64(EXPIRY), 1, 10, 1, SIG_ROUTINE.into());
}

#[test]
#[should_panic(expected = "Invalid attestation signature")]
fn tampered_risk_score_is_rejected() {
    let mut v = setup();
    v.request_payment(worker(), near(3), "req-routine".into(), U64(EXPIRY), 1, 5, 1, SIG_ROUTINE.into());
}

#[test]
#[should_panic(expected = "Invalid attestation signature")]
fn cross_network_attestation_is_rejected() {
    let mut v = setup_with("mainnet", Some(SIGNER_PK), near(100));
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Invalid attestation signature")]
fn forged_signature_is_rejected() {
    let mut v = setup();
    let forged = "00".repeat(64);
    v.request_payment(worker(), near(3), "req-routine".into(), U64(EXPIRY), 1, 10, 1, forged);
}

#[test]
#[should_panic(expected = "Policy signer not configured")]
fn unsigned_path_does_not_exist() {
    let mut v = setup_with("testnet", None, near(100));
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Duplicate request ID")]
fn replay_is_rejected() {
    let mut v = setup();
    routine(&mut v);
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Attestation expired")]
fn expired_attestation_is_rejected() {
    let mut v = setup();
    set_ctx(agent(), near(100), EXPIRY + 1);
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Policy version mismatch")]
fn stale_policy_version_is_rejected() {
    let mut v = setup();
    set_ctx(owner(), near(100), NOW);
    v.set_policy(near(30), near(100), true, 69, Some(SIGNER_PK.parse().unwrap()));
    set_ctx(agent(), near(100), NOW);
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Unauthorized agent")]
fn unknown_caller_is_rejected() {
    let mut v = setup();
    set_ctx(acc("attacker-probe.testnet"), near(100), NOW);
    routine(&mut v);
}

#[test]
#[should_panic(expected = "Vault is frozen")]
fn frozen_vault_refuses_requests() {
    let mut v = setup();
    set_ctx(owner(), near(100), NOW);
    v.freeze();
    set_ctx(agent(), near(100), NOW);
    routine(&mut v);
}

#[test]
fn spike_is_held_then_owner_approves() {
    let mut v = setup();
    match spike(&mut v) {
        RequestOutcome::HeldForApproval { .. } => {}
        other => panic!("expected hold, got {:?}", other),
    }
    let req = v.get_request("req-spike".into()).unwrap();
    assert_eq!(req.status, RequestStatus::PendingApproval);
    assert_eq!(req.expiry_ns.0, NOW + APPROVAL_TTL_NS);
    assert_eq!(v.reserved_balance, near(25));

    // Approval works after the 5-minute attestation expiry, within the approval TTL.
    set_ctx(owner(), near(100), EXPIRY + 1);
    assert_eq!(v.approve_request("req-spike".into()), RequestOutcome::Executing { request_id: "req-spike".into() });
}

#[test]
#[should_panic(expected = "Only vault owner")]
fn agent_cannot_approve_own_request() {
    let mut v = setup();
    spike(&mut v);
    v.approve_request("req-spike".into());
}

#[test]
#[should_panic(expected = "Vault is frozen")]
fn approval_refused_while_frozen() {
    let mut v = setup();
    spike(&mut v);
    set_ctx(owner(), near(100), NOW);
    v.freeze();
    v.approve_request("req-spike".into());
}

#[test]
#[should_panic(expected = "Request has expired")]
fn approval_refused_after_ttl() {
    let mut v = setup();
    spike(&mut v);
    set_ctx(owner(), near(100), NOW + APPROVAL_TTL_NS + 1);
    v.approve_request("req-spike".into());
}

#[test]
fn level6_is_recorded_as_rejected_even_when_balance_is_low() {
    // Vault holds only 5 NEAR; the 20 NEAR level-6 request must be refused and
    // recorded on-chain rather than panicking on the balance check.
    let mut v = setup_with("testnet", Some(SIGNER_PK), near(5));
    let out = v.request_payment(worker(), near(20), "req-blocked".into(), U64(EXPIRY), 1, 95, 6, SIG_BLOCKED.into());
    assert!(matches!(out, RequestOutcome::Rejected { .. }));
    assert_eq!(v.get_request("req-blocked".into()).unwrap().status, RequestStatus::Rejected);
    assert_eq!(v.reserved_balance, near(0));
}

#[test]
fn over_cap_is_rejected_on_chain() {
    let mut v = setup();
    let out = v.request_payment(worker(), near(80), "req-overcap".into(), U64(EXPIRY), 1, 95, 6, SIG_OVERCAP.into());
    match out {
        RequestOutcome::Rejected { reason, .. } => assert!(reason.contains("per_tx_cap")),
        other => panic!("expected rejection, got {:?}", other),
    }
}

#[test]
fn failed_transfer_restores_reservation() {
    let mut v = setup();
    routine(&mut v);
    set_ctx(vault_id(), near(100), NOW);
    let ok = v.on_transfer_complete("req-routine".into(), worker(), near(3), Err(PromiseError::Failed));
    assert!(!ok);
    assert_eq!(v.reserved_balance, near(0));
    assert_eq!(v.daily_spent, near(0));
    assert_eq!(v.get_request("req-routine".into()).unwrap().status, RequestStatus::Failed);
}

#[test]
fn successful_transfer_counts_toward_daily_budget() {
    let mut v = setup();
    routine(&mut v);
    set_ctx(vault_id(), near(97), NOW);
    assert!(v.on_transfer_complete("req-routine".into(), worker(), near(3), Ok(())));
    assert_eq!(v.reserved_balance, near(0));
    assert_eq!(v.daily_spent, near(3));
    assert_eq!(v.get_request("req-routine".into()).unwrap().status, RequestStatus::Succeeded);
}

#[test]
#[should_panic(expected = "Invalid request ID format")]
fn request_id_with_separator_is_rejected() {
    let mut v = setup();
    v.request_payment(worker(), near(3), "req|x".into(), U64(EXPIRY), 1, 10, 1, SIG_ROUTINE.into());
}

#[test]
#[should_panic(expected = "Approval window has not lapsed yet")]
fn expire_before_ttl_is_refused() {
    let mut v = setup();
    spike(&mut v);
    v.expire_request("req-spike".into());
}

#[test]
fn expire_after_ttl_releases_reservation() {
    let mut v = setup();
    spike(&mut v);
    assert_eq!(v.reserved_balance, near(25));
    // Anyone may expire; use an unrelated caller.
    set_ctx(acc("anyone.testnet"), near(100), NOW + APPROVAL_TTL_NS + 1);
    v.expire_request("req-spike".into());
    assert_eq!(v.reserved_balance, near(0));
    assert_eq!(v.get_request("req-spike".into()).unwrap().status, RequestStatus::Expired);
}

#[test]
#[should_panic(expected = "Request is not pending approval")]
fn executing_request_cannot_be_expired() {
    let mut v = setup();
    routine(&mut v);
    set_ctx(acc("anyone.testnet"), near(100), NOW + APPROVAL_TTL_NS + 1);
    v.expire_request("req-routine".into());
}

#[test]
#[should_panic(expected = "Only vault owner")]
fn agent_cannot_withdraw() {
    let mut v = setup();
    v.withdraw(near(1));
}

#[test]
#[should_panic(expected = "Amount exceeds unreserved vault balance")]
fn withdraw_cannot_touch_reserved_funds() {
    let mut v = setup();
    spike(&mut v); // reserves 25 of 100
    set_ctx(owner(), near(100), NOW);
    v.withdraw(near(80));
}

#[test]
fn owner_can_withdraw_unreserved_funds_while_frozen() {
    let mut v = setup();
    set_ctx(owner(), near(100), NOW);
    v.freeze();
    let _ = v.withdraw(near(50));
}

#[test]
fn event_log_is_bounded_and_newest_first() {
    let mut v = setup();
    for i in 0..(MAX_STORED_EVENTS + 25) {
        // Fresh context per call: each is its own transaction with its own gas budget.
        set_ctx(owner(), near(100), NOW);
        v.set_recipient(acc(&format!("r{}.testnet", i)), true);
    }
    assert_eq!(v.recent_events.len(), MAX_STORED_EVENTS);
    let events = v.get_recent_events(Some(3));
    assert_eq!(events.len(), 3);
    let last = MAX_STORED_EVENTS + 24;
    assert!(events[0].details.contains(&format!("r{}.testnet", last)));
    assert!(events[2].details.contains(&format!("r{}.testnet", last - 2)));
    assert_eq!(v.get_recent_events(Some(10_000)).len(), MAX_STORED_EVENTS as usize);
}

#[test]
fn views_report_agent_and_recipients() {
    let v = setup();
    let status = v.get_agent_status(agent());
    assert!(status.approved);
    assert!(!status.vault_frozen);
    assert_eq!(v.get_allowed_recipients(), vec![worker()]);
}
