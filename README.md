# BaonGuard

> A Soroban timelock vault that releases a student's weekly allowance in daily installments — putting discipline on-chain so parents sleep easy and students stop going broke by Wednesday.

---

## Stellar Contract

Link: https://stellar.expert/explorer/testnet/contract/CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E

Contract Address: `CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E`

<img width="1920" height="1293" alt="BaonGuard contract on StellarExpert" src="https://github.com/user-attachments/assets/4d81b424-d5a5-4722-af00-3ef94ac62488" />

---

## Problem

A college student in Pasig City receives their full weekly *baon* (allowance) digitally, burns through it by Wednesday on milk tea and digital goods, and has nothing left for jeepney rides or canteen meals for the rest of the week.

## Solution

The parent deposits the week's USDC into a BaonGuard Soroban contract. The student can only withdraw **≤ ₱200 equivalent per 24 hours** — enforced by `env.ledger().timestamp()`. No bank, no middleman, no transfer fees. Just a contract that literally cannot hand over more than the daily limit before the clock says so.

---

## Architecture

```
Browser (React + Vite)
    │  HTTP/JSON
    ▼
FastAPI Backend (Python)
    │  HTTPS JSON-RPC
    ▼
Stellar Testnet RPC
    │
    ▼
Soroban Contract (Rust)
```

Three layers, clean separation:
- **React frontend** — wallet connection via Freighter, vault dashboard, withdraw/initialize forms
- **FastAPI backend** — proxies all Stellar RPC calls server-side (fixes CORS), validates inputs, returns structured errors
- **Soroban contract** — enforces daily limit, 24h cooldown, and `require_auth()` on-chain

---

## Stellar Features Used

| Feature | Role |
|---|---|
| **Soroban smart contracts** | Timelock controller + daily limit enforcement |
| **USDC (SEP-41 token)** | Allowance currency deposited by parent |
| **XLM** | Network gas fees |
| **`env.ledger().timestamp()`** | On-chain clock for the 24-hour cooldown |
| **Freighter wallet** | Browser-based transaction signing |

---

## Prerequisites

- **Node.js** ≥ 18 + npm
- **Python** 3.11+
- **Freighter** browser extension — [freighter.app](https://www.freighter.app)
- **Rust** ≥ 1.74 with `wasm32-unknown-unknown` target (only needed to rebuild the contract)

---

## Setup

### 1. Frontend

```bash
npm install
```

Create `.env` in the project root:
```
VITE_CONTRACT_ID=CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E
VITE_API_URL=http://localhost:8000
```

### 2. Backend

```bash
pip install -r backend/requirements.txt
```

Create `backend/.env`:
```
CONTRACT_ID=CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
ADMIN_SECRET_KEY=your_testnet_secret_key_here
```

Get a free Testnet keypair at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test).

---

## Running Locally

Start the backend (terminal 1):
```bash
uvicorn backend.main:app --reload
```

Start the frontend (terminal 2):
```bash
npm run dev
```

Open `http://localhost:5173` — connect your Freighter wallet and you're in.

Backend API docs available at `http://localhost:8000/docs`.

---

## Contract

The Soroban contract (`src/lib.rs`) is already deployed and must not be redeployed unless contract logic changes.

### Build

```bash
soroban contract build
```

### Test

```bash
cargo test
```

### CLI Invocations

Initialize the vault:
```bash
soroban contract invoke \
  --id CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E \
  --source-account YOUR_SECRET_KEY \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- initialize \
  --student GBSTUDENT_WALLET_ADDRESS \
  --token USDC_TOKEN_CONTRACT_ID \
  --daily_limit 2000000
```

Withdraw:
```bash
soroban contract invoke \
  --id CBKFO3VGYBLNNS3VDTDOUXV2SIZCVVJLCSZFU5GIJWTO2O7E5PQDPY2E \
  --source-account STUDENT_SECRET_KEY \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- withdraw \
  --amount 2000000
```

---

## License

MIT © 2025 BaonGuard Contributors
