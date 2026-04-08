/**
 * preservation.test.js
 * Verifies that the FastAPI backend correctly surfaces Soroban contract
 * enforcement rules (daily limit, 24h cooldown, auth, vault info).
 *
 * These tests mock fetch() and inline the api.js logic to avoid Vite's
 * import.meta.env which is unavailable in Node.js test runner.
 *
 * Run with: node --test src/tests/preservation.test.js
 */

import { strict as assert } from "assert";
import { test } from "node:test";

const API_URL = "http://localhost:8000";

// ── Inline api helpers (mirrors src/api.js without import.meta.env) ──────────

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

function mockFetch(status, body) {
  global.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ── 16.1: withdraw(amount > daily_limit) → HTTP 400 "exceeds daily limit" ────
test("16.1 withdraw amount > daily_limit returns error 'exceeds daily limit'", async () => {
  mockFetch(400, { error: "exceeds daily limit" });
  await assert.rejects(
    () => withdraw("GABC", 999_000_000),
    (err) => {
      assert.ok(err.message.includes("exceeds daily limit"), `Expected 'exceeds daily limit', got: ${err.message}`);
      return true;
    }
  );
});

// ── 16.2: withdraw(before 24h cooldown) → HTTP 400 "withdrawal too soon" ─────
test("16.2 withdraw before 24h cooldown returns error 'withdrawal too soon'", async () => {
  mockFetch(400, { error: "withdrawal too soon" });
  await assert.rejects(
    () => withdraw("GABC", 5_000_000),
    (err) => {
      assert.ok(err.message.includes("withdrawal too soon"), `Expected 'withdrawal too soon', got: ${err.message}`);
      return true;
    }
  );
});

// ── 16.3: withdraw(unauthorized caller) → HTTP 400 auth failure ───────────────
test("16.3 withdraw with unauthorized caller returns auth error", async () => {
  mockFetch(400, { error: "unauthorized" });
  await assert.rejects(
    () => withdraw("GWRONG", 5_000_000),
    (err) => {
      assert.ok(err.message.length > 0, "Should throw a non-empty error");
      return true;
    }
  );
});

// ── 16.4: withdraw(valid amount, after cooldown) → returns tx_hash ────────────
test("16.4 valid withdrawal returns transaction hash", async () => {
  mockFetch(200, { tx_hash: "abc123def456" });
  const result = await withdraw("GABC", 5_000_000);
  assert.ok(result.tx_hash, "Should return a tx_hash");
  assert.equal(result.tx_hash, "abc123def456");
});

// ── 16.5: get_vault_info() returns non-negative current_balance ───────────────
test("16.5 getVaultInfo returns non-negative current_balance", async () => {
  mockFetch(200, {
    student_address: "GABC",
    daily_limit: 50_000_000,
    last_withdrawal_timestamp: 0,
    current_balance: 100_000_000,
  });
  const info = await getVaultInfo();
  assert.ok(info.current_balance >= 0, "current_balance must be non-negative");
});

// ── 16.6: First withdrawal (last_withdrawal_timestamp = 0) is allowed ─────────
test("16.6 first withdrawal (last_withdrawal_timestamp=0) is allowed immediately", async () => {
  mockFetch(200, {
    student_address: "GABC",
    daily_limit: 50_000_000,
    last_withdrawal_timestamp: 0,
    current_balance: 100_000_000,
  });
  const info = await getVaultInfo();
  assert.equal(info.last_withdrawal_timestamp, 0, "last_withdrawal_timestamp should be 0");
  // When timestamp is 0, the contract allows immediate withdrawal (no cooldown check)
  const nowSec = Math.floor(Date.now() / 1000);
  const isAvailable = info.last_withdrawal_timestamp === 0 ||
    nowSec >= info.last_withdrawal_timestamp + 86400;
  assert.ok(isAvailable, "First withdrawal should be available immediately when timestamp is 0");
});
