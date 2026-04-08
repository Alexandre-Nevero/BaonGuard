import { useState } from "react";
import { withdraw } from "../api";

export default function WithdrawForm({ walletAddress }) {
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setTxHash(null);
    setError(null);
    setLoading(true);
    try {
      const amountStroops = Math.round(parseFloat(amount) * 10_000_000);
      const result = await withdraw(walletAddress, amountStroops);
      setTxHash(result.tx_hash);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Withdraw</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Amount (USDC)
          <input
            type="number"
            min="0"
            step="0.0000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Withdraw"}
        </button>
      </form>
      {txHash && <p>Transaction hash: <code>{txHash}</code></p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </div>
  );
}
