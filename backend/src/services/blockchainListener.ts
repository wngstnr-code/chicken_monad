import { createPublicClient, http, type Address, parseAbi } from "viem";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";

// Placeholder ABI — replace with actual SC ABI once deployed
const GAME_VAULT_ABI = parseAbi([
  "event DepositCompleted(address indexed player, uint256 amount)",
  "event RewardClaimed(address indexed player, uint256 amount, bytes32 sessionId)",
  "event WithdrawCompleted(address indexed player, uint256 amount)",
]);

let publicClient: ReturnType<typeof createPublicClient> | null = null;
function getPublicClient() {
  if (!publicClient) publicClient = createPublicClient({ transport: http(env.MONAD_RPC_URL) });
  return publicClient;
}

async function logTransaction(txHash: string, walletAddress: string, type: "DEPOSIT" | "WITHDRAW" | "CLAIM_REWARD", amount: number) {
  const { error } = await supabase.from("transactions").upsert(
    { tx_hash: txHash, wallet_address: walletAddress.toLowerCase(), type, amount },
    { onConflict: "tx_hash" }
  );
  if (error) console.error(`❌ Failed to log transaction ${txHash}:`, error);
}

let isListening = false;

export async function startBlockchainListener(): Promise<void> {
  if (isListening) return;
  const vaultAddress = env.GAME_VAULT_ADDRESS as Address;

  if (vaultAddress === "0x0000000000000000000000000000000000000000") {
    console.log("⚠️  Blockchain listener SKIPPED — GAME_VAULT_ADDRESS is placeholder");
    console.log("   Set a real contract address in .env to enable event listening.");
    return;
  }

  const client = getPublicClient();
  try {
    console.log(`🔗 Starting blockchain listener on ${env.MONAD_RPC_URL}`);
    console.log(`   Watching contract: ${vaultAddress}`);

    client.watchContractEvent({
      address: vaultAddress, abi: GAME_VAULT_ABI, eventName: "DepositCompleted",
      onLogs: async (logs) => {
        for (const log of logs) {
          const { player, amount } = log.args as { player: string; amount: bigint };
          console.log(`💰 Deposit: ${player} — ${Number(amount) / 1e6} USDC`);
          await supabase.from("players").upsert({ wallet_address: player.toLowerCase() }, { onConflict: "wallet_address" });
          if (log.transactionHash) await logTransaction(log.transactionHash, player, "DEPOSIT", Number(amount) / 1e6);
        }
      },
      onError: (error) => console.error("❌ DepositCompleted listener error:", error),
    });

    client.watchContractEvent({
      address: vaultAddress, abi: GAME_VAULT_ABI, eventName: "RewardClaimed",
      onLogs: async (logs) => {
        for (const log of logs) {
          const { player, amount } = log.args as { player: string; amount: bigint; sessionId: string };
          console.log(`🏆 Reward claimed: ${player} — ${Number(amount) / 1e6} USDC`);
          if (log.transactionHash) await logTransaction(log.transactionHash, player, "CLAIM_REWARD", Number(amount) / 1e6);
        }
      },
      onError: (error) => console.error("❌ RewardClaimed listener error:", error),
    });

    client.watchContractEvent({
      address: vaultAddress, abi: GAME_VAULT_ABI, eventName: "WithdrawCompleted",
      onLogs: async (logs) => {
        for (const log of logs) {
          const { player, amount } = log.args as { player: string; amount: bigint };
          console.log(`📤 Withdraw: ${player} — ${Number(amount) / 1e6} USDC`);
          if (log.transactionHash) await logTransaction(log.transactionHash, player, "WITHDRAW", Number(amount) / 1e6);
        }
      },
      onError: (error) => console.error("❌ WithdrawCompleted listener error:", error),
    });

    isListening = true;
    console.log("✅ Blockchain event listeners active");
  } catch (err) {
    console.error("❌ Failed to start blockchain listener:", err);
    console.log("   Backend will continue without blockchain events.");
  }
}
