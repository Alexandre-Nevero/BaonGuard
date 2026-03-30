#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, Symbol,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

const STUDENT: Symbol       = symbol_short!("STUDENT");
const DAILY_LIM: Symbol     = symbol_short!("DAILYLIM");
const LAST_WITH: Symbol     = symbol_short!("LASTWITH");
const TOKEN: Symbol         = symbol_short!("TOKEN");

// 24 hours expressed in seconds
const ONE_DAY_SECS: u64 = 86_400;

// ── Return type for get_vault_info ────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultInfo {
    pub student: Address,
    pub daily_limit: i128,
    pub last_withdrawal_timestamp: u64,
    pub current_balance: i128,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BaonGuard;

#[contractimpl]
impl BaonGuard {
    // ── initialize ────────────────────────────────────────────────────────────
    // Called once by the parent/deployer after depositing funds.
    // Stores the student's wallet address, the USDC token address,
    // and the per-day withdrawal ceiling (in stroops / USDC base units).
    pub fn initialize(
        env: Env,
        student: Address,
        token: Address,
        daily_limit: i128,
    ) {
        // Prevent re-initialization — once set the student address cannot change.
        if env.storage().instance().has(&STUDENT) {
            panic!("already initialized");
        }

        assert!(daily_limit > 0, "daily_limit must be positive");

        env.storage().instance().set(&STUDENT, &student);
        env.storage().instance().set(&TOKEN, &token);
        env.storage().instance().set(&DAILY_LIM, &daily_limit);

        // Sentinel: 0 means "never withdrawn", allowing the first withdrawal
        // immediately after initialization.
        env.storage().instance().set(&LAST_WITH, &0u64);
    }

    // ── withdraw ──────────────────────────────────────────────────────────────
    // The student calls this to pull funds out of the vault.
    //
    // Guards (all must pass):
    //   1. require_auth() — only the registered student wallet can call this.
    //   2. amount ≤ daily_limit — no single withdrawal exceeds the daily cap.
    //   3. ≥ 86 400 seconds must have elapsed since the last successful
    //      withdrawal (or the vault was just initialized).
    pub fn withdraw(env: Env, amount: i128) {
        // 1. Load student address and require their signature.
        let student: Address = env.storage().instance().get(&STUDENT).unwrap();
        student.require_auth();

        // 2. Enforce the daily ceiling.
        let daily_limit: i128 = env.storage().instance().get(&DAILY_LIM).unwrap();
        assert!(amount > 0, "amount must be positive");
        assert!(amount <= daily_limit, "exceeds daily limit");

        // 3. Enforce the 24-hour cooldown.
        let last_ts: u64 = env.storage().instance().get(&LAST_WITH).unwrap();
        let now: u64 = env.ledger().timestamp();

        // If last_ts == 0 the vault was never withdrawn from; allow immediately.
        if last_ts != 0 {
            assert!(
                now >= last_ts + ONE_DAY_SECS,
                "withdrawal too soon: 24 hours have not elapsed"
            );
        }

        // 4. Execute the token transfer from the contract's own balance to the student.
        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &student, &amount);

        // 5. Record the timestamp of this successful withdrawal.
        env.storage().instance().set(&LAST_WITH, &now);
    }

    // ── get_vault_info ────────────────────────────────────────────────────────
    // Read-only view function used by the frontend to render the dashboard.
    // Returns the student address, daily limit, last withdrawal timestamp,
    // and the contract's current USDC balance.
    pub fn get_vault_info(env: Env) -> VaultInfo {
        let student: Address = env.storage().instance().get(&STUDENT).unwrap();
        let daily_limit: i128 = env.storage().instance().get(&DAILY_LIM).unwrap();
        let last_withdrawal_timestamp: u64 = env.storage().instance().get(&LAST_WITH).unwrap();
        let token_addr: Address = env.storage().instance().get(&TOKEN).unwrap();

        let token_client = token::Client::new(&env, &token_addr);
        let current_balance = token_client.balance(&env.current_contract_address());

        VaultInfo {
            student,
            daily_limit,
            last_withdrawal_timestamp,
            current_balance,
        }
    }
}