import { createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env.js";

/**
 * Signature service for cryptographic payout signing.
 *
 * When a player cashes out, the backend signs a structured payload
 * using EIP-712 typed data. The frontend then submits this signature
 * to the Smart Contract to claim the reward.
 *
 * The Smart Contract must whitelist the backend signer address.
 */

// ── EIP-712 Domain & Types ───────────────────────────────────

const EIP712_DOMAIN = {
  name: "ChickenMonad",
  version: "1",
  chainId: env.MONAD_CHAIN_ID,
  verifyingContract: env.GAME_VAULT_ADDRESS as Address,
} as const;

const PAYOUT_TYPES = {
  Payout: [
    { name: "player", type: "address" },
    { name: "sessionId", type: "bytes32" },
    { name: "multiplier", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

// ── Signer Setup ─────────────────────────────────────────────

let signerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getSignerAccount() {
  if (!signerAccount) {
    try {
      signerAccount = privateKeyToAccount(env.BACKEND_PRIVATE_KEY as Hex);
      console.log(`🔑 Backend signer initialized: ${signerAccount.address}`);
    } catch (err) {
      console.error("❌ Failed to initialize signer. Check BACKEND_PRIVATE_KEY in .env");
      throw err;
    }
  }
  return signerAccount;
}

/**
 * Get the backend signer's address.
 * This address must be whitelisted in the Smart Contract.
 */
export function getSignerAddress(): string {
  return getSignerAccount().address;
}

// ── Nonce Counter ────────────────────────────────────────────
// Simple incrementing nonce to prevent signature replay attacks
let payoutNonce = 0;

/**
 * Convert a UUID string to bytes32 hex.
 * Strips dashes and pads to 32 bytes.
 */
function uuidToBytes32(uuid: string): Hex {
  const stripped = uuid.replace(/-/g, "");
  return `0x${stripped.padEnd(64, "0")}` as Hex;
}

/**
 * Convert a USDC amount to uint256 (6 decimals).
 * e.g., 10.50 USDC → 10500000
 */
function usdcToUint256(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

/**
 * Convert multiplier basis points to uint256.
 * We store the full bp value so the SC can verify.
 */
function multiplierBpToUint256(multiplierBp: number): bigint {
  return BigInt(multiplierBp);
}

// ── Sign Payout ──────────────────────────────────────────────

export interface PayoutSignatureResult {
  signature: string;
  payload: {
    player: string;
    sessionId: string;
    multiplier: string;
    amount: string;
    nonce: string;
  };
  signerAddress: string;
}

/**
 * Sign a payout for a player who cashed out.
 *
 * @param playerAddress - Player's wallet address
 * @param sessionId - Game session UUID
 * @param multiplierBp - Final multiplier in basis points
 * @param payoutAmount - Payout in USDC (e.g., 12.50)
 * @returns Signed payload ready for Smart Contract submission
 */
export async function signPayout(
  playerAddress: string,
  sessionId: string,
  multiplierBp: number,
  payoutAmount: number
): Promise<PayoutSignatureResult> {
  const account = getSignerAccount();
  const nonce = ++payoutNonce;

  const sessionIdBytes = uuidToBytes32(sessionId);
  const multiplierUint = multiplierBpToUint256(multiplierBp);
  const amountUint = usdcToUint256(payoutAmount);
  const nonceUint = BigInt(nonce);

  const walletClient = createWalletClient({
    account,
    transport: http(env.MONAD_RPC_URL),
  });

  const signature = await walletClient.signTypedData({
    domain: EIP712_DOMAIN,
    types: PAYOUT_TYPES,
    primaryType: "Payout",
    message: {
      player: playerAddress as Address,
      sessionId: sessionIdBytes,
      multiplier: multiplierUint,
      amount: amountUint,
      nonce: nonceUint,
    },
  });

  return {
    signature,
    payload: {
      player: playerAddress,
      sessionId,
      multiplier: multiplierUint.toString(),
      amount: amountUint.toString(),
      nonce: nonceUint.toString(),
    },
    signerAddress: account.address,
  };
}
