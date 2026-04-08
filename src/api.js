const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Internal helper — throws Error with the backend's error message on non-OK responses.
 */
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

/**
 * GET /vault-info
 * Returns { student_address, daily_limit, last_withdrawal_timestamp, current_balance }
 */
export async function getVaultInfo() {
  return _request("/vault-info");
}

/**
 * POST /initialize
 * @param {string} studentAddress
 * @param {string} tokenAddress
 * @param {number} dailyLimit - in stroops (plain Number, not BigInt)
 * Returns { tx_hash }
 */
export async function initializeVault(studentAddress, tokenAddress, dailyLimit) {
  return _request("/initialize", {
    method: "POST",
    body: JSON.stringify({
      student_address: studentAddress,
      token_address: tokenAddress,
      daily_limit: Number(dailyLimit),
    }),
  });
}

/**
 * POST /withdraw
 * @param {string} studentAddress
 * @param {number} amount - in stroops (plain Number, not BigInt)
 * Returns { tx_hash }
 */
export async function withdraw(studentAddress, amount) {
  return _request("/withdraw", {
    method: "POST",
    body: JSON.stringify({
      student_address: studentAddress,
      amount: Number(amount),
    }),
  });
}
