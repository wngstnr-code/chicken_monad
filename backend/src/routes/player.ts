import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../config/supabase.js";

const router = Router();

/**
 * GET /api/player/stats
 * Get authenticated player's statistics.
 */
router.get("/stats", requireAuth, async (req, res) => {
  const walletAddress = req.walletAddress!;

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (error || !data) {
    res.json({
      wallet_address: walletAddress,
      total_games: 0,
      total_wins: 0,
      total_losses: 0,
      total_profit: 0,
      created_at: null,
    });
    return;
  }

  res.json(data);
});

/**
 * GET /api/player/transactions
 * Get authenticated player's blockchain transaction history.
 */
router.get("/transactions", requireAuth, async (req, res) => {
  const walletAddress = req.walletAddress!;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);
  const offset = parseInt(String(req.query.offset ?? "0"));

  const { data, error, count } = await supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("❌ Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions." });
    return;
  }

  res.json({
    transactions: data || [],
    total: count || 0,
    limit,
    offset,
  });
});

export default router;
