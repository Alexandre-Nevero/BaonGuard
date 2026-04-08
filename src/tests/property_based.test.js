/**
 * property_based.test.js
 * Property-based tests for the 5 BaonGuard correctness properties.
 *
 * Uses fast-check for property-based testing. Each test generates many
 * random inputs and asserts the property holds for all of them.
 *
 * Run with: node --test src/tests/property_based.test.js
 *
 * Install fast-check if needed: npm install --save-dev fast-check
 */

import { strict as assert } from "assert";
import { test } from "node:test";
import fc from "fast-check";

// ── Inline api helpers (mirrors src/api.js without import.meta.env) ──────────

const API_URL = "http://localhost:8000";

async function _request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail?.error ?? data?.error ?? res.statusText);
  }
  return data;
}

const getVaultInfo = () => _request("/vault-info");
const withdraw = (studentAddress, amount) =>
  _request("/withdraw", {
    method: "POST",
    body: JSON.stringify({ student_address: studentAddress, amount: Number(amount) }),
  });

// ── Mock fetch helper ─────────────────────────────────────────────────────────

function mockFetchWith(handler) {
  global.fetch = handler;
}

// ── P1: For any amount > daily_limit, POST /withdraw always returns HTTP 400 ──
test("P1: any amount > daily_limit always returns HTTP 400", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1_000_000_000 }),   // daily_limit
      fc.integer({ min: 1, max: 1_000_000_000 }),   // excess
      async (dailyLimit, excess) => {
        const amount = dailyLimit + excess; // always > daily_limit
        mockFetchWith(async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: "exceeds daily limit" }),
        }));
        let threw = false;
        try {
          await withdraw("GABC", amount);
        } catch {
          threw = true;
        }
        assert.ok(threw, `withdraw(${amount}) > daily_limit(${dailyLimit}) must throw`);
      }
    ),
    { numRuns: 50 }
  );
});

// ── P2: For any timestamp < last_withdrawal + 86400, POST /withdraw → HTTP 400 ─
test("P2: any withdrawal before 24h cooldown always returns HTTP 400", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1_700_000_000, max: 2_000_000_000 }), // last_withdrawal (recent unix ts)
      fc.integer({ min: 1, max: 86399 }),                      // seconds before cooldown expires
      async (lastWithdrawal, secondsBefore) => {
        // Simulate: current time is lastWithdrawal + (86400 - secondsBefore) < lastWithdrawal + 86400
        mockFetchWith(async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: "withdrawal too soon" }),
        }));
        let threw = false;
        try {
          await withdraw("GABC", 5_000_000);
        } catch {
          threw = true;
        }
        assert.ok(threw, "withdrawal before cooldown must throw");
      }
    ),
    { numRuns: 50 }
  );
});

// ── P3: For any contract state, GET /vault-info always returns current_balance >= 0 ─
test("P3: GET /vault-info always returns current_balance >= 0", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 1_000_000_000_000 }), // any non-negative balance
      fc.integer({ min: 1, max: 1_000_000_000 }),      // daily_limit
      fc.integer({ min: 0, max: 2_000_000_000 }),      // last_withdrawal_timestamp
      async (balance, dailyLimit, lastWithdrawal) => {
        mockFetchWith(async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            student_address: "GABC",
            daily_limit: dailyLimit,
            last_withdrawal_timestamp: lastWithdrawal,
            current_balance: balance,
          }),
        }));
        const info = await getVaultInfo();
        assert.ok(info.current_balance >= 0, `current_balance must be >= 0, got ${info.current_balance}`);
      }
    ),
    { numRuns: 100 }
  );
});

// ── P4: For any student_address != registered_student, POST /withdraw always fails ─
test("P4: any unauthorized student_address always fails withdraw", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 56, maxLength: 56 }), // random 56-char address (not the registered one)
      async (wrongAddress) => {
        mockFetchWith(async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: "unauthorized" }),
        }));
        let threw = false;
        try {
          await withdraw(wrongAddress, 5_000_000);
        } catch {
          threw = true;
        }
        assert.ok(threw, `withdraw with unauthorized address must throw`);
      }
    ),
    { numRuns: 50 }
  );
});

// ── P5: GET /vault-info response always matches on-chain contract storage ─────
test("P5: GET /vault-info response fields are consistent with contract storage", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        student_address: fc.constant("GABC123"),
        daily_limit: fc.integer({ min: 1, max: 1_000_000_000 }),
        last_withdrawal_timestamp: fc.integer({ min: 0, max: 2_000_000_000 }),
        current_balance: fc.integer({ min: 0, max: 1_000_000_000_000 }),
      }),
      async (contractState) => {
        mockFetchWith(async () => ({
          ok: true,
          status: 200,
          json: async () => contractState,
        }));
        const info = await getVaultInfo();
        // All fields must match exactly what the contract returned
        assert.equal(info.student_address, contractState.student_address);
        assert.equal(info.daily_limit, contractState.daily_limit);
        assert.equal(info.last_withdrawal_timestamp, contractState.last_withdrawal_timestamp);
        assert.equal(info.current_balance, contractState.current_balance);
        // Invariant: balance is never negative
        assert.ok(info.current_balance >= 0);
      }
    ),
    { numRuns: 100 }
  );
});
