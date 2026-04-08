import {
  isConnected,
  getPublicKey,
  signTransaction,
} from "@stellar/freighter-api";

let _publicKey = null;

/**
 * Connect to Freighter and return the user's public key.
 * Throws if Freighter is not installed or the user rejects.
 */
export async function connectWallet() {
  const connected = await isConnected();
  if (!connected) {
    throw new Error(
      "Freighter is not installed. Please install the Freighter browser extension to continue."
    );
  }
  _publicKey = await getPublicKey();
  return _publicKey;
}

/**
 * Sign a transaction XDR with Freighter.
 * @param {string} transactionXDR - Base64-encoded transaction envelope XDR
 * @param {string} networkPassphrase - Stellar network passphrase
 * @returns {Promise<string>} Signed transaction XDR
 */
export async function signTx(transactionXDR, networkPassphrase) {
  const signed = await signTransaction(transactionXDR, { networkPassphrase });
  return signed;
}

/**
 * Disconnect the wallet by clearing the stored public key.
 */
export function disconnectWallet() {
  _publicKey = null;
}

/**
 * Return the currently connected public key, or null if not connected.
 */
export function getStoredPublicKey() {
  return _publicKey;
}
