"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useWallet } from "../../components/web3/WalletProvider";
import {
  GAME_VAULT_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  hasDepositContractConfig,
} from "../../lib/web3/contracts";

export default function DepositPage() {
  const { account, isMonadChain } = useWallet();
  const [amount, setAmount] = useState("10");

  const isConnected = Boolean(account);
  const canContinue = isConnected && isMonadChain && hasDepositContractConfig();

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="flow-eyebrow">Step 2</p>
        <h1 className="flow-title">Deposit USDC</h1>
        <p className="flow-copy">
          Halaman ini jadi pondasi untuk flow `approve USDC - deposit ke vault`. Eksekusi
          transaksi kita wiring di tahap berikutnya.
        </p>

        <div className="flow-status">
          <p>
            Wallet: <strong>{isConnected ? "Connected" : "Not connected"}</strong>
          </p>
          <p>
            On Monad: <strong>{isMonadChain ? "Yes" : "No"}</strong>
          </p>
          <p>
            USDC Decimals: <span className="mono">{USDC_DECIMALS}</span>
          </p>
          <p>
            USDC Address: <span className="mono">{USDC_ADDRESS || "(set in .env.local)"}</span>
          </p>
          <p>
            Vault Address:{" "}
            <span className="mono">{GAME_VAULT_ADDRESS || "(set in .env.local)"}</span>
          </p>
        </div>

        {!hasDepositContractConfig() && (
          <p className="flow-alert">
            Contract config belum lengkap. Isi `NEXT_PUBLIC_USDC_ADDRESS` dan
            `NEXT_PUBLIC_GAME_VAULT_ADDRESS`.
          </p>
        )}

        <label className="flow-label" htmlFor="deposit-amount-ui">
          Planned deposit amount (USDC)
        </label>
        <input
          id="deposit-amount-ui"
          className="flow-input"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
        />

        <div className="flow-actions">
          <button className="flow-btn" type="button" disabled={!canContinue}>
            Approve USDC (next step)
          </button>
          <button className="flow-btn secondary" type="button" disabled={!canContinue}>
            Deposit To Vault (next step)
          </button>
        </div>

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
