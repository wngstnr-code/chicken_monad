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

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="flow-eyebrow">Step 2</p>
        <h1 className="flow-title">Deposit USDC</h1>
        <p className="flow-copy">
          Flow source: <span className="mono">{flow.source}</span>. UI ini sudah pakai adapter
          layer, jadi nanti backend/smart-contract final tinggal ganti implementation di feature
          layer tanpa ubah halaman.
        </p>

        <div className="flow-status">
          <p>
            Wallet: <strong>{flow.isConnected ? "Connected" : "Not connected"}</strong>
          </p>
          <p>
            On Monad: <strong>{flow.isMonadChain ? "Yes" : "No"}</strong>
          </p>
          <p>
            USDC Decimals: <span className="mono">{USDC_DECIMALS}</span>
          </p>
          <p>
            USDC Address:{" "}
            <span className="mono">{flow.usdcAddress || "(set in frontend/.env.local)"}</span>
          </p>
          <p>
            Vault Address:{" "}
            <span className="mono">{flow.vaultAddress || "(set in frontend/.env.local)"}</span>
          </p>
          <p>
            Wallet USDC: <span className="mono">{flow.walletBalanceDisplay}</span>
          </p>
          <p>
            Allowance: <span className="mono">{flow.allowanceDisplay}</span>
          </p>
        </div>

        {flow.configMessage && <p className="flow-alert">{flow.configMessage}</p>}
        {flow.statusMessage && <p className="flow-success">{flow.statusMessage}</p>}
        {flow.errorMessage && <p className="flow-alert">{flow.errorMessage}</p>}

        <label className="flow-label" htmlFor="deposit-amount-ui">
          Deposit amount (USDC)
        </label>
        <input
          id="deposit-amount-ui"
          className="flow-input"
          type="number"
          min="0"
          step="0.01"
          value={flow.amount}
          onChange={(event: ChangeEvent<HTMLInputElement>) => flow.setAmount(event.target.value)}
        />

        <div className="flow-actions">
          <button
            className="flow-btn"
            type="button"
            disabled={flow.disableApproveButton}
            onClick={handleApproveClick}
          >
            {flow.isApproveBusy ? "Approving..." : flow.needsApproval ? "Approve USDC" : "Approved"}
          </button>
          <button
            className="flow-btn secondary"
            type="button"
            disabled={flow.disableDepositButton}
            onClick={handleDepositClick}
          >
            {flow.isDepositBusy ? "Depositing..." : "Deposit To Vault"}
          </button>
        </div>

        {flow.approveTxHash && (
          <p className="flow-tx">
            Approve tx:{" "}
            {flow.approveTxUrl ? (
              <a href={flow.approveTxUrl} target="_blank" rel="noreferrer">
                {flow.approveTxHash}
              </a>
            ) : (
              <span className="mono">{flow.approveTxHash}</span>
            )}
          </p>
        )}

        {flow.depositTxHash && (
          <p className="flow-tx">
            Deposit tx:{" "}
            {flow.depositTxUrl ? (
              <a href={flow.depositTxUrl} target="_blank" rel="noreferrer">
                {flow.depositTxHash}
              </a>
            ) : (
              <span className="mono">{flow.depositTxHash}</span>
            )}
          </p>
        )}

        <div className="flow-actions">
          <a href="/connect" className="flow-btn secondary">
            Back To Connect
          </a>
          <a href="/play" className="flow-btn secondary">
            Continue To Play
          </a>
        </div>
      </section>
    </main>
  );
}
