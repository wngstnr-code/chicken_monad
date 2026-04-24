import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env.js";

const GAME_SETTLEMENT_WRITE_ABI = parseAbi([
  "function settleWithSignature((bytes32 sessionId,address player,uint256 stakeAmount,uint256 payoutAmount,uint256 finalMultiplierBp,uint8 outcome,uint64 deadline) resolution, bytes signature)",
]);
const SETTLEMENT_GAS_LIMIT = 350_000n;

type SettlementResolutionInput = {
  sessionId: string;
  player: string;
  stakeAmount: string | number | bigint;
  payoutAmount: string | number | bigint;
  finalMultiplierBp: string | number | bigint;
  outcome: string | number;
  deadline: string | number | bigint;
};

const account = privateKeyToAccount(env.BACKEND_PRIVATE_KEY as Hex);
const settlementWalletClient = createWalletClient({
  account,
  transport: http(env.MONAD_RPC_URL),
});
const settlementPublicClient = createPublicClient({
  transport: http(env.MONAD_RPC_URL),
});

export function getSettlementRelayerAddress(): Address {
  return account.address;
}

function toHexString(value: string) {
  return String(value || "").trim().toLowerCase();
}

function toBigIntValue(value: string | number | bigint) {
  if (typeof value === "bigint") return value;
  return BigInt(String(value || "0"));
}

function normalizeResolution(
  resolution: SettlementResolutionInput,
): {
  sessionId: Hex;
  player: Address;
  stakeAmount: bigint;
  payoutAmount: bigint;
  finalMultiplierBp: bigint;
  outcome: number;
  deadline: bigint;
} {
  const sessionId = toHexString(resolution.sessionId);
  const player = toHexString(resolution.player);

  if (!isHex(sessionId, { strict: true }) || sessionId.length !== 66) {
    throw new Error("Invalid resolution.sessionId");
  }

  if (!isHex(player, { strict: true }) || player.length !== 42) {
    throw new Error("Invalid resolution.player");
  }

  return {
    sessionId: sessionId as Hex,
    player: player as Address,
    stakeAmount: toBigIntValue(resolution.stakeAmount),
    payoutAmount: toBigIntValue(resolution.payoutAmount),
    finalMultiplierBp: toBigIntValue(resolution.finalMultiplierBp),
    outcome: Number(resolution.outcome),
    deadline: toBigIntValue(resolution.deadline),
  };
}

export async function submitSettlementOnchain(params: {
  resolution: SettlementResolutionInput;
  signature: string;
}): Promise<string> {
  const signature = toHexString(params.signature);
  if (!isHex(signature, { strict: true })) {
    throw new Error("Invalid settlement signature");
  }

  const normalizedResolution = normalizeResolution(params.resolution);
  const txHash = await settlementWalletClient.writeContract({
    chain: null,
    address: env.GAME_SETTLEMENT_ADDRESS as Address,
    abi: GAME_SETTLEMENT_WRITE_ABI,
    functionName: "settleWithSignature",
    args: [normalizedResolution, signature as Hex],
    gas: SETTLEMENT_GAS_LIMIT,
  });

  const receipt = await settlementPublicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  if (receipt.status !== "success") {
    throw new Error("Settlement tx reverted");
  }

  return txHash;
}
