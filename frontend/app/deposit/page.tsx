"use client";

import type { ChangeEvent } from "react";
import { USDC_DECIMALS } from "../../lib/web3/contracts";
import { useDepositFlow } from "../../features/deposit/useDepositFlow";

export default function DepositPage() {
  const flow = useDepositFlow();

  async function handleApproveClick() {
    try {
      await flow.onApprove();
    } catch {
      // Error sudah ditangani di flow implementation.
    }
  }

  async function handleDepositClick() {
    try {
      await flow.onDeposit();
    } catch {
      // Error sudah ditangani di flow implementation.
    }
  }

  async function handleWithdrawClick() {
    try {
      await flow.onWithdraw();
    } catch {
      // Error sudah ditangani di flow implementation.
    }
  }

  async function handleFaucetClick() {
    try {
      await flow.onClaimFaucet();
    } catch {
      // Error sudah ditangani di flow implementation.
    }
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="flow-eyebrow">CHICKEN VAULT</p>
        <h1 className="flow-title">Deposit USDC</h1>
        <p className="flow-copy">
          Deposit USDC ke vault untuk mulai bermain. Kamu hanya perlu approve sekali saja (infinite allowance) agar deposit selanjutnya lebih lancar.
        </p>

        <div className="flow-status">
          <p>
            <span>Wallet Status</span>
            <strong>{flow.isConnected ? (flow.isMonadChain ? "Connected (Monad)" : "Wrong Network") : "Not Connected"}</strong>
          </p>
          <p>
            <span>Wallet Balance</span>
            <strong>{flow.walletBalanceDisplay} USDC</strong>
          </p>
          <p>
            <span>Vault Available</span>
            <strong>{flow.availableBalanceDisplay} USDC</strong>
          </p>
          <p>
            <span>Vault Locked</span>
            <strong>{flow.lockedBalanceDisplay} USDC</strong>
          </p>
        </div>

        {flow.configMessage && <p className="flow-alert">{flow.configMessage}</p>}
        {flow.statusMessage && <p className="flow-success">{flow.statusMessage}</p>}
        {flow.errorMessage && <p className="flow-alert">{flow.errorMessage}</p>}

        <div>
          <label className="flow-label" htmlFor="deposit-amount-ui">
            Amount to Deposit (USDC)
          </label>
          <input
            id="deposit-amount-ui"
            className="flow-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={flow.amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => flow.setAmount(event.target.value)}
          />
        </div>

        <div className="flow-actions" style={{ flexDirection: "column", gap: "12px" }}>
          <button
            className="flow-btn"
            type="button"
            disabled={flow.disableDepositButton}
            onClick={handleDepositClick}
          >
            {flow.isDepositBusy ? "Processing..." : flow.isApproveBusy ? "Approving..." : flow.needsApproval ? "Approve & Deposit" : "Deposit to Vault"}
          </button>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
            <button
              className="flow-btn secondary"
              type="button"
              disabled={flow.disableFaucetButton}
              onClick={handleFaucetClick}
            >
              {flow.isFaucetBusy ? "Minting..." : "Mint Faucet"}
            </button>
            <button
              className="flow-btn secondary"
              type="button"
              disabled={flow.disableWithdrawButton}
              onClick={handleWithdrawClick}
            >
              {flow.isWithdrawBusy ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
          {flow.depositTxHash && (
            <p className="flow-tx">
              Latest Deposit:{" "}
              {flow.depositTxUrl ? (
                <a href={flow.depositTxUrl} target="_blank" rel="noreferrer">
                  {flow.depositTxHash.slice(0, 10)}...{flow.depositTxHash.slice(-8)}
                </a>
              ) : (
                <span className="mono">{flow.depositTxHash}</span>
              )}
            </p>
          )}
          {flow.withdrawTxHash && (
            <p className="flow-tx">
              Latest Withdraw:{" "}
              {flow.withdrawTxUrl ? (
                <a href={flow.withdrawTxUrl} target="_blank" rel="noreferrer">
                  {flow.withdrawTxHash.slice(0, 10)}...{flow.withdrawTxHash.slice(-8)}
                </a>
              ) : (
                <span className="mono">{flow.withdrawTxHash}</span>
              )}
            </p>
          )}
        </div>

        <div className="flow-actions" style={{ marginTop: "16px", justifyContent: "center", gap: "12px" }}>
          <a href="/" className="flow-btn secondary" style={{ background: "transparent" }}>
            Return to Home
          </a>
          <a href="/play" className="flow-btn secondary" style={{ background: "transparent" }}>
            Play Game
          </a>
        </div>
      </section>
    </main>
  );
}
