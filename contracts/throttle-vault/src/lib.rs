use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U64;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{IterableSet, LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, CurveType, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PublicKey,
};

const CALLBACK_GAS: Gas = Gas::from_tgas(20);
const DAY_IN_NANOSECONDS: u64 = 86_400 * 1_000_000_000;
/// How long the owner has to approve a held request before it lapses.
/// Separate from the attestation expiry, which only bounds submission freshness.
const APPROVAL_TTL_NS: u64 = 3_600 * 1_000_000_000;
const MAX_REQUEST_ID_LEN: usize = 64;
/// Domain separator for signed attestations. Must match backend/src/risk/attestation.ts.
pub const ATTESTATION_DOMAIN: &str = "throttle-attestation-v1";

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[borsh(use_discriminant = true)]
#[serde(crate = "near_sdk::serde")]
pub enum AuthorityLevel {
    FullAutonomous = 1,
    LoggedMonitored = 2,
    VelocityRestricted = 3,
    MonitoredWarning = 4,
    ApprovalRequired = 5,
    FrozenBlocked = 6,
}

impl AuthorityLevel {
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            1 => Some(Self::FullAutonomous),
            2 => Some(Self::LoggedMonitored),
            3 => Some(Self::VelocityRestricted),
            4 => Some(Self::MonitoredWarning),
            5 => Some(Self::ApprovalRequired),
            6 => Some(Self::FrozenBlocked),
            _ => None,
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[borsh(use_discriminant = true)]
#[serde(crate = "near_sdk::serde")]
pub enum RequestStatus {
    PendingApproval = 1,
    Approved = 2,
    Executing = 3,
    Succeeded = 4,
    Failed = 5,
    Rejected = 6,
}

/// Timestamps are `U64` so they serialize as JSON strings; nanosecond values
/// exceed 2^53 and would lose precision as JSON numbers in JavaScript clients.
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentRequest {
    pub request_id: String,
    pub agent_id: AccountId,
    pub recipient: AccountId,
    pub amount: NearToken,
    pub risk_score: u8,
    pub authority_level: AuthorityLevel,
    pub policy_version: u32,
    pub status: RequestStatus,
    pub created_at_ns: U64,
    pub expiry_ns: U64,
    pub resolved_at_ns: Option<U64>,
    pub failure_reason: Option<String>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultPolicy {
    pub version: u32,
    pub per_tx_cap: NearToken,
    pub daily_budget: NearToken,
    pub require_whitelist: bool,
    pub max_risk_for_autonomous: u8,
    pub policy_signer_pk: Option<PublicKey>,
    pub chain_id: String,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultEvent {
    pub event_type: String,
    pub request_id: Option<String>,
    pub policy_version: u32,
    pub actor: AccountId,
    pub timestamp_ns: U64,
    pub details: String,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum RequestOutcome {
    Executing { request_id: String },
    HeldForApproval { request_id: String, reason: String },
    Rejected { request_id: String, reason: String },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultStatusView {
    pub owner_id: AccountId,
    pub is_frozen: bool,
    pub policy: VaultPolicy,
    pub vault_balance: NearToken,
    pub storage_reserve: NearToken,
    pub reserved_balance: NearToken,
    pub available_balance: NearToken,
    pub daily_spent: NearToken,
    pub daily_remaining: NearToken,
    pub approved_agents_count: u32,
    pub total_requests_count: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ThrottleVault {
    pub owner_id: AccountId,
    /// Network the vault lives on ("testnet"); bound into every attestation so a
    /// signature for one network cannot be replayed on another.
    pub chain_id: String,
    pub policy_signer_pk: Option<PublicKey>,
    pub approved_agents: IterableSet<AccountId>,
    pub allowed_recipients: IterableSet<AccountId>,
    pub is_frozen: bool,
    pub policy_version: u32,
    pub per_tx_cap: NearToken,
    pub daily_budget: NearToken,
    pub daily_spent: NearToken,
    pub daily_reset_timestamp_ns: u64,
    pub require_whitelist: bool,
    pub max_risk_for_autonomous: u8,
    pub reserved_balance: NearToken,
    pub requests: LookupMap<String, PaymentRequest>,
    pub request_ids: Vector<String>,
    pub recent_events: Vector<VaultEvent>,
}

/// Canonical attestation message. The backend signer builds the identical string.
#[allow(clippy::too_many_arguments)]
pub fn attestation_message(
    chain_id: &str,
    vault_id: &AccountId,
    request_id: &str,
    recipient: &AccountId,
    amount: NearToken,
    risk_score: u8,
    authority_level: u8,
    policy_version: u32,
    expiry_ns: u64,
) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        ATTESTATION_DOMAIN,
        chain_id,
        vault_id,
        request_id,
        recipient,
        amount.as_yoctonear(),
        risk_score,
        authority_level,
        policy_version,
        expiry_ns
    )
}

fn is_valid_request_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_REQUEST_ID_LEN
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[near]
impl ThrottleVault {
    #[init]
    pub fn new(
        owner_id: AccountId,
        chain_id: String,
        policy_signer_pk: Option<PublicKey>,
        per_tx_cap: NearToken,
        daily_budget: NearToken,
        require_whitelist: bool,
    ) -> Self {
        require!(!env::state_exists(), "Already initialized");
        if let Some(ref pk) = policy_signer_pk {
            require!(pk.curve_type() == CurveType::ED25519, "Policy signer must be ed25519");
        }
        Self {
            owner_id,
            chain_id,
            policy_signer_pk,
            approved_agents: IterableSet::new(b"a"),
            allowed_recipients: IterableSet::new(b"r"),
            is_frozen: false,
            policy_version: 1,
            per_tx_cap,
            daily_budget,
            daily_spent: NearToken::from_yoctonear(0),
            daily_reset_timestamp_ns: env::block_timestamp(),
            require_whitelist,
            max_risk_for_autonomous: 69,
            reserved_balance: NearToken::from_yoctonear(0),
            requests: LookupMap::new(b"q"),
            request_ids: Vector::new(b"i"),
            recent_events: Vector::new(b"e"),
        }
    }

    #[payable]
    pub fn deposit(&mut self) -> NearToken {
        let deposit = env::attached_deposit();
        require!(deposit > NearToken::from_yoctonear(0), "Deposit must be > 0");
        self.emit_event(
            "DepositReceived",
            None,
            env::predecessor_account_id(),
            format!("Deposited {}", deposit),
        );
        deposit
    }

    #[allow(clippy::too_many_arguments)]
    pub fn request_payment(
        &mut self,
        recipient: AccountId,
        amount: NearToken,
        request_id: String,
        expiry_ns: U64,
        policy_version: u32,
        risk_score: u8,
        authority_level_u8: u8,
        signature_hex: String,
    ) -> RequestOutcome {
        let caller = env::predecessor_account_id();
        self.assert_active_and_authorized_agent(&caller);

        let now = env::block_timestamp();
        let expiry_ns = expiry_ns.0;
        require!(is_valid_request_id(&request_id), "Invalid request ID format");
        require!(now <= expiry_ns, "Attestation expired");
        require!(
            policy_version == self.policy_version,
            "Policy version mismatch; reload active policy"
        );
        require!(
            !self.requests.contains_key(&request_id),
            "Duplicate request ID"
        );
        require!(amount > NearToken::from_yoctonear(0), "Amount must be > 0");
        require!(risk_score <= 100, "Risk score out of range");

        // Every request must carry a valid attestation from the owner-designated signer.
        // There is no unsigned path: without it the agent could self-report its own risk.
        let signer_pk = self
            .policy_signer_pk
            .clone()
            .unwrap_or_else(|| env::panic_str("Policy signer not configured"));
        let message = attestation_message(
            &self.chain_id,
            &env::current_account_id(),
            &request_id,
            &recipient,
            amount,
            risk_score,
            authority_level_u8,
            policy_version,
            expiry_ns,
        );
        let sig_bytes: [u8; 64] = hex::decode(&signature_hex)
            .ok()
            .and_then(|b| b.try_into().ok())
            .unwrap_or_else(|| env::panic_str("Invalid signature encoding"));
        // PublicKey::as_bytes() is [curve_type, ..key]; strip the curve byte.
        let pk_bytes: [u8; 32] = signer_pk.as_bytes()[1..]
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Invalid ed25519 public key"));
        require!(
            env::ed25519_verify(&sig_bytes, message.as_bytes(), &pk_bytes),
            "Invalid attestation signature"
        );

        let authority = AuthorityLevel::from_u8(authority_level_u8)
            .unwrap_or_else(|| env::panic_str("Invalid authority level integer"));

        // Hard cap: never bypassable by any attestation.
        if amount > self.per_tx_cap {
            let reason = format!("Amount {} exceeds per_tx_cap {}", amount, self.per_tx_cap);
            return self.record_rejection(request_id, caller, recipient, amount, risk_score, authority, now, expiry_ns, reason);
        }

        // Level 6 / high risk: refused unconditionally, recorded on-chain as evidence.
        if authority == AuthorityLevel::FrozenBlocked || risk_score >= 90 {
            let reason = format!("Risk {} / authority level {} blocked execution", risk_score, authority_level_u8);
            return self.record_rejection(request_id, caller, recipient, amount, risk_score, authority, now, expiry_ns, reason);
        }

        self.refresh_daily_budget_if_needed(now);

        require!(
            amount <= self.available_balance(),
            "Insufficient vault balance for proposed transfer"
        );

        let is_whitelisted = self.allowed_recipients.contains(&recipient);
        let requires_approval = authority == AuthorityLevel::ApprovalRequired
            || risk_score > self.max_risk_for_autonomous
            || (self.require_whitelist && !is_whitelisted)
            || self.daily_spent.saturating_add(amount) > self.daily_budget;

        self.reserved_balance = self.reserved_balance.saturating_add(amount);

        if requires_approval {
            let reason = if self.require_whitelist && !is_whitelisted {
                "Non-whitelisted recipient requires human authorization".to_string()
            } else if risk_score > self.max_risk_for_autonomous {
                format!("Risk score {} exceeds autonomous threshold {}", risk_score, self.max_risk_for_autonomous)
            } else if authority == AuthorityLevel::ApprovalRequired {
                "Authority level 5 requires human authorization".to_string()
            } else {
                "Daily budget would be exceeded; requires human authorization".to_string()
            };
            let req = PaymentRequest {
                request_id: request_id.clone(),
                agent_id: caller.clone(),
                recipient,
                amount,
                risk_score,
                authority_level: AuthorityLevel::ApprovalRequired,
                policy_version,
                status: RequestStatus::PendingApproval,
                created_at_ns: U64(now),
                expiry_ns: U64(now.saturating_add(APPROVAL_TTL_NS)),
                resolved_at_ns: None,
                failure_reason: None,
            };
            self.store_new_request(req);
            self.emit_event("PaymentHeldForApproval", Some(request_id.clone()), caller, reason.clone());
            return RequestOutcome::HeldForApproval { request_id, reason };
        }

        // Autonomous execution path (levels 1-4).
        let req = PaymentRequest {
            request_id: request_id.clone(),
            agent_id: caller.clone(),
            recipient: recipient.clone(),
            amount,
            risk_score,
            authority_level: authority,
            policy_version,
            status: RequestStatus::Executing,
            created_at_ns: U64(now),
            expiry_ns: U64(expiry_ns),
            resolved_at_ns: None,
            failure_reason: None,
        };
        self.store_new_request(req);
        self.emit_event(
            "PaymentDispatching",
            Some(request_id.clone()),
            caller,
            format!("Dispatching {} to {}", amount, recipient),
        );
        self.dispatch_transfer(&request_id, recipient, amount);
        RequestOutcome::Executing { request_id }
    }

    #[private]
    pub fn on_transfer_complete(
        &mut self,
        request_id: String,
        recipient: AccountId,
        amount: NearToken,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        let mut req = self
            .requests
            .get(&request_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Request not found in callback"));

        self.reserved_balance = self.reserved_balance.saturating_sub(amount);
        let now = env::block_timestamp();

        match result {
            Ok(_) => {
                req.status = RequestStatus::Succeeded;
                req.resolved_at_ns = Some(U64(now));
                self.daily_spent = self.daily_spent.saturating_add(amount);
                self.requests.insert(request_id.clone(), req);
                self.emit_event("PaymentSucceeded", Some(request_id), recipient, format!("Transferred {}", amount));
                true
            }
            Err(err) => {
                req.status = RequestStatus::Failed;
                req.resolved_at_ns = Some(U64(now));
                req.failure_reason = Some(format!("{:?}", err));
                self.requests.insert(request_id.clone(), req);
                self.emit_event("PaymentFailed", Some(request_id), recipient, format!("Transfer failed: {:?}", err));
                false
            }
        }
    }

    pub fn approve_request(&mut self, request_id: String) -> RequestOutcome {
        self.assert_owner();
        require!(!self.is_frozen, "Vault is frozen: unfreeze before approving");
        let mut req = self
            .requests
            .get(&request_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Request not found"));

        require!(
            req.status == RequestStatus::PendingApproval,
            "Request is not pending approval"
        );
        require!(env::block_timestamp() <= req.expiry_ns.0, "Request has expired");

        req.status = RequestStatus::Executing;
        self.requests.insert(request_id.clone(), req.clone());

        self.emit_event(
            "PaymentApprovedByOwner",
            Some(request_id.clone()),
            self.owner_id.clone(),
            format!("Approved payment of {} to {}", req.amount, req.recipient),
        );
        self.dispatch_transfer(&request_id, req.recipient, req.amount);
        RequestOutcome::Executing { request_id }
    }

    pub fn reject_request(&mut self, request_id: String, reason: String) {
        self.assert_owner();
        let mut req = self
            .requests
            .get(&request_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Request not found"));

        require!(
            req.status == RequestStatus::PendingApproval,
            "Request is not pending approval"
        );

        self.reserved_balance = self.reserved_balance.saturating_sub(req.amount);
        req.status = RequestStatus::Rejected;
        req.resolved_at_ns = Some(U64(env::block_timestamp()));
        req.failure_reason = Some(reason.clone());
        self.requests.insert(request_id.clone(), req);

        self.emit_event("PaymentRejectedByOwner", Some(request_id), self.owner_id.clone(), reason);
    }

    pub fn freeze(&mut self) {
        self.assert_owner();
        self.is_frozen = true;
        self.emit_event("VaultFrozen", None, self.owner_id.clone(), "Vault emergency freeze activated".to_string());
    }

    pub fn unfreeze(&mut self) {
        self.assert_owner();
        self.is_frozen = false;
        self.emit_event("VaultUnfrozen", None, self.owner_id.clone(), "Vault emergency freeze released".to_string());
    }

    pub fn set_policy(
        &mut self,
        per_tx_cap: NearToken,
        daily_budget: NearToken,
        require_whitelist: bool,
        max_risk_for_autonomous: u8,
        policy_signer_pk: Option<PublicKey>,
    ) {
        self.assert_owner();
        if let Some(ref pk) = policy_signer_pk {
            require!(pk.curve_type() == CurveType::ED25519, "Policy signer must be ed25519");
        }
        self.per_tx_cap = per_tx_cap;
        self.daily_budget = daily_budget;
        self.require_whitelist = require_whitelist;
        self.max_risk_for_autonomous = max_risk_for_autonomous;
        self.policy_signer_pk = policy_signer_pk;
        self.policy_version += 1;

        self.emit_event(
            "PolicyUpdated",
            None,
            self.owner_id.clone(),
            format!("Policy updated to v{}: cap={}, budget={}", self.policy_version, self.per_tx_cap, self.daily_budget),
        );
    }

    pub fn set_agent(&mut self, agent_id: AccountId, approved: bool) {
        self.assert_owner();
        if approved {
            self.approved_agents.insert(agent_id.clone());
        } else {
            self.approved_agents.remove(&agent_id);
        }
        self.emit_event("AgentStatusUpdated", None, self.owner_id.clone(), format!("Agent {} approved={}", agent_id, approved));
    }

    pub fn set_recipient(&mut self, recipient: AccountId, allowed: bool) {
        self.assert_owner();
        if allowed {
            self.allowed_recipients.insert(recipient.clone());
        } else {
            self.allowed_recipients.remove(&recipient);
        }
        self.emit_event("RecipientWhitelistUpdated", None, self.owner_id.clone(), format!("Recipient {} allowed={}", recipient, allowed));
    }

    // View methods
    pub fn get_policy(&self) -> VaultPolicy {
        VaultPolicy {
            version: self.policy_version,
            per_tx_cap: self.per_tx_cap,
            daily_budget: self.daily_budget,
            require_whitelist: self.require_whitelist,
            max_risk_for_autonomous: self.max_risk_for_autonomous,
            policy_signer_pk: self.policy_signer_pk.clone(),
            chain_id: self.chain_id.clone(),
        }
    }

    pub fn get_vault_status(&self) -> VaultStatusView {
        let now = env::block_timestamp();
        let daily_spent = if now >= self.daily_reset_timestamp_ns.saturating_add(DAY_IN_NANOSECONDS) {
            NearToken::from_yoctonear(0)
        } else {
            self.daily_spent
        };

        VaultStatusView {
            owner_id: self.owner_id.clone(),
            is_frozen: self.is_frozen,
            policy: self.get_policy(),
            vault_balance: env::account_balance(),
            storage_reserve: Self::storage_reserve(),
            reserved_balance: self.reserved_balance,
            available_balance: self.available_balance(),
            daily_spent,
            daily_remaining: self.daily_budget.saturating_sub(daily_spent),
            approved_agents_count: self.approved_agents.len(),
            total_requests_count: self.request_ids.len() as u64,
        }
    }

    /// Returns the exact string a policy signer must sign for these arguments.
    /// Lets clients check their serialization against the deployed contract.
    #[allow(clippy::too_many_arguments)]
    pub fn get_attestation_message(
        &self,
        request_id: String,
        recipient: AccountId,
        amount: NearToken,
        risk_score: u8,
        authority_level_u8: u8,
        policy_version: u32,
        expiry_ns: U64,
    ) -> String {
        attestation_message(
            &self.chain_id,
            &env::current_account_id(),
            &request_id,
            &recipient,
            amount,
            risk_score,
            authority_level_u8,
            policy_version,
            expiry_ns.0,
        )
    }

    pub fn get_request(&self, request_id: String) -> Option<PaymentRequest> {
        self.requests.get(&request_id).cloned()
    }

    pub fn get_recent_requests(&self, limit: Option<u32>) -> Vec<PaymentRequest> {
        let total = self.request_ids.len();
        let start = total.saturating_sub(limit.unwrap_or(20));
        (start..total)
            .rev()
            .filter_map(|i| self.request_ids.get(i))
            .filter_map(|id| self.requests.get(id).cloned())
            .collect()
    }

    pub fn get_recent_events(&self, limit: Option<u32>) -> Vec<VaultEvent> {
        let total = self.recent_events.len();
        let start = total.saturating_sub(limit.unwrap_or(20));
        (start..total).rev().filter_map(|i| self.recent_events.get(i).cloned()).collect()
    }

    pub fn is_agent_approved(&self, agent_id: AccountId) -> bool {
        self.approved_agents.contains(&agent_id)
    }

    pub fn is_recipient_allowed(&self, recipient: AccountId) -> bool {
        self.allowed_recipients.contains(&recipient)
    }

    // Internal helpers
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Unauthorized: Only vault owner can perform this action"
        );
    }

    fn assert_active_and_authorized_agent(&self, caller: &AccountId) {
        require!(!self.is_frozen, "Vault is frozen: all agent execution suspended");
        require!(self.approved_agents.contains(caller), "Unauthorized agent");
    }

    fn storage_reserve() -> NearToken {
        env::storage_byte_cost().saturating_mul(env::storage_usage() as u128)
    }

    /// Balance that can still be committed: total minus storage staking minus reservations.
    fn available_balance(&self) -> NearToken {
        env::account_balance()
            .saturating_sub(Self::storage_reserve())
            .saturating_sub(self.reserved_balance)
    }

    fn dispatch_transfer(&self, request_id: &str, recipient: AccountId, amount: NearToken) {
        let _ = Promise::new(recipient.clone()).transfer(amount).then(
            Self::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .on_transfer_complete(request_id.to_string(), recipient, amount),
        );
    }

    fn store_new_request(&mut self, req: PaymentRequest) {
        self.request_ids.push(req.request_id.clone());
        self.requests.insert(req.request_id.clone(), req);
    }

    #[allow(clippy::too_many_arguments)]
    fn record_rejection(
        &mut self,
        request_id: String,
        caller: AccountId,
        recipient: AccountId,
        amount: NearToken,
        risk_score: u8,
        authority: AuthorityLevel,
        now: u64,
        expiry_ns: u64,
        reason: String,
    ) -> RequestOutcome {
        self.emit_event("PaymentBlocked", Some(request_id.clone()), caller.clone(), reason.clone());
        let req = PaymentRequest {
            request_id: request_id.clone(),
            agent_id: caller,
            recipient,
            amount,
            risk_score,
            authority_level: authority,
            policy_version: self.policy_version,
            status: RequestStatus::Rejected,
            created_at_ns: U64(now),
            expiry_ns: U64(expiry_ns),
            resolved_at_ns: Some(U64(now)),
            failure_reason: Some(reason.clone()),
        };
        self.store_new_request(req);
        RequestOutcome::Rejected { request_id, reason }
    }

    fn refresh_daily_budget_if_needed(&mut self, now: u64) {
        if now >= self.daily_reset_timestamp_ns.saturating_add(DAY_IN_NANOSECONDS) {
            self.daily_spent = NearToken::from_yoctonear(0);
            self.daily_reset_timestamp_ns = now;
        }
    }

    fn emit_event(&mut self, event_type: &str, request_id: Option<String>, actor: AccountId, details: String) {
        let event = VaultEvent {
            event_type: event_type.to_string(),
            request_id,
            policy_version: self.policy_version,
            actor,
            timestamp_ns: U64(env::block_timestamp()),
            details,
        };
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"throttle\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}",
            event_type,
            near_sdk::serde_json::to_string(&event).unwrap_or_default()
        ));
        self.recent_events.push(event);
    }
}

#[cfg(test)]
mod tests;
