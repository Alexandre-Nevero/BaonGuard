import { useEffect, useState } from "react";
import { getVaultInfo } from "../api";

const STROOPS = 10_000_000;

function formatUsdc(stroops) {
  return (stroops / STROOPS).toFixed(2);
}

function formatCooldown(lastWithdrawalTimestamp) {
  if (lastWithdrawalTimestamp === 0) return "Available now";
  const nextAvailable = lastWithdrawalTimestamp + 86400;
  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = nextAvailable - nowSec;
  if (remaining <= 0) return "Available now";
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `${h}h ${m}m remaining`;
}

export default function VaultDashboard() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getVaultInfo()
      .then(setInfo)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading vault info…</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>Vault Dashboard</h2>
      <p><strong>Balance:</strong> {formatUsdc(info.current_balance)} USDC</p>
      <p><strong>Daily Limit:</strong> {formatUsdc(info.daily_limit)} USDC</p>
      <p><strong>Next Withdrawal:</strong> {formatCooldown(info.last_withdrawal_timestamp)}</p>
    </div>
  );
}
