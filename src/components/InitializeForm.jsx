import { useState } from "react";
import { initializeVault } from "../api";

export default function InitializeForm() {
  const [studentAddress, setStudentAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [dailyLimitUsdc, setDailyLimitUsdc] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setTxHash(null);
    setError(null);
    setLoading(true);
    try {
      const dailyLimitStroops = Math.round(parseFloat(dailyLimitUsdc) * 10_000_000);
      const result = await initializeVault(studentAddress, tokenAddress, dailyLimitStroops);
      setTxHash(result.tx_hash);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Initialize Vault</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Student Address
          <input
            type="text"
            value={studentAddress}
            onChange={(e) => setStudentAddress(e.target.value)}
            placeholder="G..."
            required
          />
        </label>
        <label>
          Token Address (USDC)
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="C..."
            required
          />
        </label>
        <label>
          Daily Limit (USDC)
          <input
            type="number"
            min="0"
            step="0.0000001"
            value={dailyLimitUsdc}
            onChange={(e) => setDailyLimitUsdc(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Initializing…" : "Initialize"}
        </button>
      </form>
      {txHash && <p>Vault initialized. Transaction hash: <code>{txHash}</code></p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </div>
  );
}
