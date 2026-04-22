import { randomBytes } from "node:crypto";
import { createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env.js";

const EIP712_DOMAIN = {
  name: "ChickenCrossingSettlement",
  version: "1",
  chainId: env.MONAD_CHAIN_ID,
  verifyingContract: env.GAME_SETTLEMENT_ADDRESS as Address,
} as const;

const RESOLUTION_TYPES = {
  Resolution: [
    { name: "sessionId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "stakeAmount", type: "uint256" },
    { name: "payoutAmount", type: "uint256" },
    { name: "finalMultiplierBp", type: "uint256" },
    { name: "outcome", type: "uint8" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export const SETTLEMENT_OUTCOME = {
  CASHED_OUT: 1,
  CRASHED: 2,
} as const;

export interface ResolutionPayload {
  sessionId: Hex;
  player: Address;
  stakeAmount: bigint;
  payoutAmount: bigint;
  finalMultiplierBp: bigint;
  outcome: number;
  deadline: bigint;
}

export interface SignedSettlementResult {
  signature: Hex;
  resolution: {
    sessionId: Hex;
    player: Address;
    stakeAmount: string;
    payoutAmount: string;
    finalMultiplierBp: string;
    outcome: number;
    deadline: string;
  };
  signerAddress: Address;
}

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

export function getSignerAddress(): Address {
  return getSignerAccount().address;
}

export function generateOnchainSessionId(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}

export function usdcToUint256(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

export function createResolutionPayload(params: {
  playerAddress: string;
  onchainSessionId: string;
  stakeAmount: number;
  payoutAmount: number;
  finalMultiplierBp: number;
  outcome: number;
  deadline?: number;
}): ResolutionPayload {
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + env.SETTLEMENT_SIGNATURE_TTL_SECONDS;

  return {
    sessionId: params.onchainSessionId as Hex,
    player: params.playerAddress as Address,
    stakeAmount: usdcToUint256(params.stakeAmount),
    payoutAmount: usdcToUint256(params.payoutAmount),
    finalMultiplierBp: BigInt(params.finalMultiplierBp),
    outcome: params.outcome,
    deadline: BigInt(deadline),
  };
}

export async function signSettlement(params: {
  playerAddress: string;
  onchainSessionId: string;
  stakeAmount: number;
  payoutAmount: number;
  finalMultiplierBp: number;
  outcome: number;
  deadline?: number;
}): Promise<SignedSettlementResult> {
  const account = getSignerAccount();
  const resolution = createResolutionPayload(params);

  const walletClient = createWalletClient({
    account,
    transport: http(env.MONAD_RPC_URL),
  });

  const signature = await walletClient.signTypedData({
    domain: EIP712_DOMAIN,
    types: RESOLUTION_TYPES,
    primaryType: "Resolution",
    message: resolution,
  });

  return {
    signature,
    resolution: {
      sessionId: resolution.sessionId,
      player: resolution.player,
      stakeAmount: resolution.stakeAmount.toString(),
      payoutAmount: resolution.payoutAmount.toString(),
      finalMultiplierBp: resolution.finalMultiplierBp.toString(),
      outcome: resolution.outcome,
      deadline: resolution.deadline.toString(),
    },
    signerAddress: account.address,
  };
}
