import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../config/supabase.js";
import { hasActiveGame } from "../services/gameState.js";
import { usdcToUint256 } from "../services/signatureService.js";

const router = Router();

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
    .not("settlement_signature", "is", null)
    .is("settlement_tx_hash", null)
    .order("ended_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ Error fetching pending settlements:", error);
    res.status(500).json({ error: "Failed to fetch pending settlements." });
    return;
  }

  const pendingSettlements = (data || []).map((session: Record<string, unknown>) => ({
    ...session,
    resolution: buildResolutionFromSession(walletAddress, session),
    signature: session.settlement_signature,
  }));

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
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);
  const offset = parseInt(String(req.query.offset ?? "0"));

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

  const { data: session } = await supabase
    .from("game_sessions")
    .select("session_id, wallet_address, settlement_signature")
    .eq("session_id", sessionId)
    .eq("wallet_address", walletAddress)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  await supabase
    .from("game_sessions")
    .update({ settlement_tx_hash: txHash })
    .eq("session_id", sessionId);

  res.json({ success: true });
}

router.post("/clear-settlement", requireAuth, clearSettlement);
router.post("/clear-claim", requireAuth, clearSettlement);

export default router;
