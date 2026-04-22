import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../config/supabase.js";
import { hasActiveGame } from "../services/gameState.js";

const router = Router();

/**
 * GET /api/game/active
 * Check if the player has an active game session.
 * Used by frontend to prevent opening multiple tabs.
 */
router.get("/active", requireAuth, async (req, res) => {
  const walletAddress = req.walletAddress!;

  // Check in-memory first (fastest)
  if (hasActiveGame(walletAddress)) {
    res.json({ hasActiveGame: true });
    return;
  }

  // Also check database for stale sessions
  const { data } = await supabase
    .from("game_sessions")
    .select("session_id, stake_amount, created_at")
    .eq("wallet_address", walletAddress)
    .eq("status", "ACTIVE")
    .maybeSingle();

  res.json({
    hasActiveGame: !!data,
    session: data || null,
  });
});

/**
 * GET /api/game/pending-claim
 * Check if the player has a pending claim signature.
 * Used for session recovery (e.g., browser closed before MetaMask confirm).
 */
router.get("/pending-claim", requireAuth, async (req, res) => {
  const walletAddress = req.walletAddress!;

  const { data, error } = await supabase
    .from("game_sessions")
    .select("session_id, stake_amount, final_multiplier, payout_amount, claim_signature, ended_at")
    .eq("wallet_address", walletAddress)
    .eq("status", "CASHED_OUT")
    .not("claim_signature", "is", null)
    .order("ended_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ Error fetching pending claims:", error);
    res.status(500).json({ error: "Failed to fetch pending claims." });
    return;
  }

  res.json({
    pendingClaims: data || [],
    hasPending: (data?.length ?? 0) > 0,
  });
});

/**
 * GET /api/game/history
 * Get player's game session history.
 */
router.get("/history", requireAuth, async (req, res) => {
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

/**
 * POST /api/game/clear-claim
 * Mark a claim as processed (after SC transaction confirmed).
 * Frontend calls this after MetaMask tx succeeds.
 */
router.post("/clear-claim", requireAuth, async (req, res) => {
  const walletAddress = req.walletAddress!;
  const { sessionId, txHash } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId." });
    return;
  }

  // Verify session belongs to player
  const { data: session } = await supabase
    .from("game_sessions")
    .select("session_id, wallet_address, claim_signature")
    .eq("session_id", sessionId)
    .eq("wallet_address", walletAddress)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  // Clear the claim signature (mark as claimed)
  await supabase
    .from("game_sessions")
    .update({ claim_signature: null })
    .eq("session_id", sessionId);

  // If tx hash provided, log the transaction
  if (txHash) {
    await supabase.from("transactions").upsert(
      {
        tx_hash: txHash,
        wallet_address: walletAddress,
        type: "CLAIM_REWARD",
        amount: 0, // Will be updated by blockchain listener
      },
      { onConflict: "tx_hash" }
    );
  }

  res.json({ success: true });
});

export default router;
