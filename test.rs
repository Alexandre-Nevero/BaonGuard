#[cfg(test)]
mod tests {
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token, Address, Env,
    };

    use crate::{BaonGuard, BaonGuardClient};

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Advance the ledger timestamp by `secs` seconds.
    fn advance_time(env: &Env, secs: u64) {
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + secs,
            ..env.ledger().get()
        });
    }

    /// Deploy a mock USDC token contract, mint `amount` to `recipient`, and
    /// return the token address.
    fn create_token(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'_>) {
        let token_addr = env.register_stellar_asset_contract(admin.clone());
        let sac = token::StellarAssetClient::new(env, &token_addr);
        (token_addr, sac)
    }

    /// Standard setup shared across tests.
    /// Returns (env, contract_client, student_address, token_address).
    fn setup() -> (Env, BaonGuardClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let parent = Address::generate(&env);
        let student = Address::generate(&env);

        let (token_addr, sac) = create_token(&env, &parent);

        // Fund the parent with 10_000 stroops of mock USDC.
        sac.mint(&parent, &10_000);

        // Deploy the BaonGuard contract.
        let contract_id = env.register_contract(None, BaonGuard);
        let client = BaonGuardClient::new(&env, &contract_id);

        // Parent deposits 5_000 stroops into the contract by transferring directly.
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&parent, &contract_id, &5_000);

        // Initialize the vault: student can withdraw up to 500 stroops per day.
        client.initialize(&student, &token_addr, &500);

        // SAFETY: transmute lifetime to 'static for test ergonomics (single-thread only).
        let client: BaonGuardClient<'static> = unsafe { std::mem::transmute(client) };

        (env, client, student, token_addr)
    }

    // ── Test 1 ─ Happy path ───────────────────────────────────────────────────
    // initialize → advance 24 h → withdraw succeeds → balance decreases.
    #[test]
    fn test_happy_path_withdraw_succeeds_after_24h() {
        let (env, client, _student, token_addr) = setup();

        // Advance the clock by exactly 24 hours.
        advance_time(&env, 86_400);

        // Withdraw 300 stroops (≤ 500 daily limit).
        client.withdraw(&300);

        // The contract balance should now be 5_000 - 300 = 4_700.
        let token_client = token::Client::new(&env, &token_addr);
        let balance = token_client.balance(&client.address);
        assert_eq!(balance, 4_700, "contract balance should be 4700 after withdrawal");
    }

    // ── Test 2 ─ Exceeds daily limit ──────────────────────────────────────────
    // Attempting to withdraw more than the daily_limit must panic.
    #[test]
    #[should_panic(expected = "exceeds daily limit")]
    fn test_withdraw_exceeds_daily_limit_panics() {
        let (env, client, _student, _token) = setup();

        advance_time(&env, 86_400);

        // 501 > 500 daily limit → must panic.
        client.withdraw(&501);
    }

    // ── Test 3 ─ Withdraw before 24 hours ────────────────────────────────────
    // A second withdrawal before 24 h have elapsed must panic.
    #[test]
    #[should_panic(expected = "withdrawal too soon")]
    fn test_withdraw_before_24h_panics() {
        let (env, client, _student, _token) = setup();

        // First withdrawal is always allowed immediately after initialization
        // (last_ts == 0 sentinel).
        client.withdraw(&100);

        // Advance only 23 hours → cooldown not satisfied.
        advance_time(&env, 82_800);

        // This second withdrawal must panic.
        client.withdraw(&100);
    }

    // ── Test 4 ─ State verification ───────────────────────────────────────────
    // After a successful withdrawal, storage reflects the new timestamp and
    // the vault info balance decreases accordingly.
    #[test]
    fn test_state_correctly_updated_after_withdrawal() {
        let (env, client, _student, _token) = setup();

        advance_time(&env, 86_400);
        let ts_before_withdraw = env.ledger().timestamp();

        client.withdraw(&200);

        let info = client.get_vault_info();

        // Timestamp in storage must equal the ledger time at withdrawal.
        assert_eq!(
            info.last_withdrawal_timestamp, ts_before_withdraw,
            "last_withdrawal_timestamp should equal ledger time at withdrawal"
        );

        // Balance must reflect the deduction.
        assert_eq!(
            info.current_balance, 4_800,
            "vault balance should be 4800 after withdrawing 200"
        );
    }

    // ── Test 5 ─ Authorization ────────────────────────────────────────────────
    // A wallet that is NOT the registered student must be rejected.
    #[test]
    #[should_panic]
    fn test_non_student_withdraw_panics() {
        let (env, client, _student, _token) = setup();

        advance_time(&env, 86_400);

        // Generate a random intruder address.
        let intruder = Address::generate(&env);

        // Override mock auths so only the intruder signs — student does not sign.
        // With mock_all_auths disabled for the student, require_auth() will panic.
        env.set_auths(&[]);  // clear all auth mocks

        // Attempt withdrawal without the student's authorization → panic.
        // Internally the contract calls student.require_auth(), which will fail
        // because only `intruder` is present in the auth context.
        let _ = intruder; // intruder is the conceptual actor; no auth granted
        client.withdraw(&100);
    }
}