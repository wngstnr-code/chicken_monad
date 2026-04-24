import { Router, type Request, type Response } from "express";
import { createPublicClient, http, isHex, parseAbi, type Address, type Hex } from "viem";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { hasActiveGame } from "../services/gameState.js";
import {
  SETTLEMENT_OUTCOME,
  signSettlement,
  usdcToUint256,
} from "../services/signatureService.js";

const router = Router();
const settlementPublicClient = createPublicClient({
  transport: http(env.MONAD_RPC_URL),
});
const GAME_SETTLEMENT_READ_ABI = parseAbi([
  "function getSession(bytes32 sessionId) view returns (address player, uint256 stakeAmount, uint64 startedAt, bool active, bool settled)",
]);

function parsePaginationParam(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function buildResolutionFromSession(walletAddress: string, session: Record<string, unknown>) {
  const stakeAmount = Number(session.stake_amount ?? 0);
  const payoutAmount = Number(session.payout_amount ?? 0);
  const finalMultiplier = Number(session.final_multiplier ?? 0);
  const finalMultiplierBp = Math.round(finalMultiplier * 10_000);
  const status = String(session.status ?? "");

  return {
    sessionId: String(session.onchain_session_id),
    player: walletAddress,
    stakeAmount: usdcToUint256(stakeAmount).toString(),
    payoutAmount: usdcToUint256(payoutAmount).toString(),
    finalMultiplierBp: status === "CRASHED" ? "0" : finalMultiplierBp.toString(),
    outcome: status === "CRASHED" ? 2 : 1,
    deadline: String(session.settlement_deadline ?? "0"),
  };
}

async function clearUnsettlablePendingSession(sessionId: string) {
  const { error } = await supabase
    .from("game_sessions")
    .update({
      settlement_signature: null,
      settlement_deadline: null,
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error(`❌ Failed to clear stale pending settlement ${sessionId}:`, error);
  }
}

async function ensureSettlementSignature(
  walletAddress: string,
  session: Record<string, unknown>,
) {
  const existingSignature = String(session.settlement_signature ?? "").trim();
  const existingDeadline = Number(session.settlement_deadline ?? 0);

  if (existingSignature && existingDeadline > 0) {
    return {
      signature: existingSignature,
      deadline: existingDeadline,
    };
  }

  const status = String(session.status ?? "");
  if (status !== "CRASHED" && status !== "CASHED_OUT") {
    return null;
  }

  try {
    const settlement = await signSettlement({
      playerAddress: walletAddress,
      onchainSessionId: String(session.onchain_session_id ?? ""),
      stakeAmount: Number(session.stake_amount ?? 0),
      payoutAmount: Number(session.payout_amount ?? 0),
      finalMultiplierBp:
        status === "CRASHED"
          ? 0
          : Math.round(Number(session.final_multiplier ?? 0) * 10_000),
      outcome:
        status === "CRASHED"
          ? SETTLEMENT_OUTCOME.CRASHED
          : SETTLEMENT_OUTCOME.CASHED_OUT,
    });

    const nextSignature = settlement.signature;
    const nextDeadline = Number(settlement.resolution.deadline);

    const { error } = await supabase
      .from("game_sessions")
      .update({
        settlement_signature: nextSignature,
        settlement_deadline: nextDeadline,
      })
      .eq("session_id", String(session.session_id));

    if (error) {
      console.error(
        `❌ Failed to persist generated settlement signature ${String(session.session_id)}:`,
        error,
      );
    }

    return {
      signature: nextSignature,
      deadline: nextDeadline,
    };
  } catch (signError) {
    console.error(
      `❌ Failed to generate settlement signature for ${String(session.session_id)}:`,
      signError,
    );
    return null;
  }
}

async function isCurrentOnchainPendingSettlement(session: Record<string, unknown>) {
  const onchainSessionId = String(session.onchain_session_id ?? "");
  if (!isHex(onchainSessionId, { strict: true })) {
    return false;
  }

  try {
    const onchainSession = await settlementPublicClient.readContract({
      address: env.GAME_SETTLEMENT_ADDRESS as Address,
      abi: GAME_SETTLEMENT_READ_ABI,
      functionName: "getSession",
      args: [onchainSessionId as Hex],
    });

    const player = onchainSession[0];
    const active = onchainSession[3];
    const settled = onchainSession[4];

    if (!player || /^0x0{40}$/i.test(player)) {
      return false;
    }

    return Boolean(active && !settled);
  } catch (inspectError) {
    console.error(`❌ Failed to inspect pending settlement ${onchainSessionId}:`, inspectError);
    return true;
  }
}

router.get("/active", requireAuth, async (req: Request, res: Response) => {
  const walletAddress = req.walletAddress!;

  if (hasActiveGame(walletAddress)) {
    res.json({ hasActiveGame: true });
    return;
  }

  const { data } = await supabase
    .from("game_sessions")
    .select("session_id, onchain_session_id, stake_amount, created_at")
    .eq("wallet_address", walletAddress)
    .eq("status", "ACTIVE")
    .maybeSingle();

  res.json({
    hasActiveGame: !!data,
    session: data || null,
  });
});

async function getPendingSettlements(req: Request, res: Response) {
  const walletAddress = req.walletAddress!;

  const { data, error } = await supabase
    .from("game_sessions")
    .select(
      "session_id, onchain_session_id, stake_amount, status, final_multiplier, payout_amount, settlement_signature, settlement_deadline, settlement_tx_hash, ended_at"
    )
    .eq("wallet_address", walletAddress)
    .in("status", ["CASHED_OUT", "CRASHED"])
    .is("settlement_tx_hash", null)
    .order("ended_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ Supabase Error (pending-settlements):", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    res.status(500).json({ error: "Failed to fetch pending settlements.", details: error.message });
    return;
  }

  const pendingSettlements: Array<Record<string, unknown>> = [];

  for (const session of data || []) {
    const isStillPendingOnchain = await isCurrentOnchainPendingSettlement(session);
    if (!isStillPendingOnchain) {
      console.warn(
        `🧹 Ignoring stale pending settlement ${String(session.session_id)} (${String(
          session.onchain_session_id ?? "",
        )})`,
      );
      await clearUnsettlablePendingSession(String(session.session_id));
      continue;
    }

    const ensuredSettlement = await ensureSettlementSignature(walletAddress, session);
    if (!ensuredSettlement?.signature || !ensuredSettlement.deadline) {
      console.warn(
        `⚠️ Pending session ${String(session.session_id)} has no usable settlement signature yet.`,
      );
      continue;
    }

    const normalizedSession = {
      ...session,
      settlement_signature: ensuredSettlement.signature,
      settlement_deadline: ensuredSettlement.deadline,
    };

    pendingSettlements.push({
      ...normalizedSession,
      resolution: buildResolutionFromSession(walletAddress, normalizedSession),
      signature: ensuredSettlement.signature,
    });
  }

  res.json({
    pendingSettlements,
    pendingClaims: pendingSettlements,
    hasPending: pendingSettlements.length > 0,
  });
}

router.get("/pending-settlement", requireAuth, getPendingSettlements);
router.get("/pending-claim", requireAuth, getPendingSettlements);

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const walletAddress = req.walletAddress!;
  const limit = parsePaginationParam(req.query.limit, 20, 1, 100);
  const offset = parsePaginationParam(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

  const { data, error, count } = await supabase
    .from("game_sessions")
    .select("*", { count: "exact" })
    .eq("wallet_address", walletAddress)
    .neq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("❌ Error fetching game history:", error);
    res.status(500).json({ error: "Failed to fetch game history." });
    return;
  }

  res.json({
    sessions: data || [],
    total: count || 0,
    limit,
    offset,
  });
});

async function clearSettlement(req: Request, res: Response) {
  const walletAddress = req.walletAddress!;
  const { sessionId, txHash } = req.body as { sessionId?: string; txHash?: string };

  if (!sessionId || !txHash) {
    res.status(400).json({ error: "Missing sessionId or txHash." });
    return;
  }

  const normalizedTxHash = String(txHash).trim();
  if (!isHex(normalizedTxHash, { strict: true }) || normalizedTxHash.length !== 66) {
    res.status(400).json({ error: "Invalid txHash format." });
    return;
  }

  const { data: session } = await supabase
    .from("game_sessions")
    .select("session_id, wallet_address, status, settlement_signature, settlement_tx_hash")
    .eq("session_id", sessionId)
    .eq("wallet_address", walletAddress)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  const status = String(session.status ?? "");
  if (status !== "CASHED_OUT" && status !== "CRASHED") {
    res.status(409).json({ error: "Session belum siap untuk clear settlement." });
    return;
  }

  if (!session.settlement_signature) {
    res.status(409).json({ error: "Settlement signature belum tersedia." });
    return;
  }

  if (session.settlement_tx_hash) {
    res.json({ success: true });
    return;
  }

  await supabase
    .from("game_sessions")
    .update({ settlement_tx_hash: normalizedTxHash })
    .eq("session_id", sessionId);

  res.json({ success: true });
}

router.post("/clear-settlement", requireAuth, clearSettlement);
router.post("/clear-claim", requireAuth, clearSettlement);

export default router;
