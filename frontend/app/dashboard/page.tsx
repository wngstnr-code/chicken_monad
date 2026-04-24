"use client";

import { useState } from "react";
import { useWallet } from "../../components/web3/WalletProvider";

function shortAddress(address: string) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function DashboardPage() {
  const [showHelp, setShowHelp] = useState(false);
  const { account, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const isConnected = Boolean(account);

  function onConnect() {
    void connectWallet();
  }

  function onLogout() {
    disconnectWallet();
  }

  return (
    <main className="flow-page dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-bg" aria-hidden="true">
          <iframe
            className="dashboard-bg-frame"
            src="/play?bg=1"
            title="In-game background"
            tabIndex={-1}
          />
        </div>
        <div className="dashboard-overlay" aria-hidden="true" />

        <header className="home-nav home-nav-global">
          <a className="home-brand" href="/">
            <span className="home-brand-badge">GM</span>
            <span className="home-brand-copy">
              <p className="home-brand-eyebrow">Monad Arcade Risk Game</p>
              <span className="home-brand-name">Chicken Monad</span>
            </span>
          </a>

          <div className="home-nav-cluster">
            <div className="home-nav-actions">
              {isConnected ? (
                <button type="button" className="flow-btn secondary home-nav-login">
                  {shortAddress(account)}
                </button>
              ) : (
                <button
                  type="button"
                  className="flow-btn primary home-nav-login"
                  onClick={onConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? "CONNECTING..." : "LOGIN"}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-center">
          <div className="dashboard-actions">
            {isConnected ? (
              <>
                <a
                  href="/play"
                  className="flow-btn home-btn-main dashboard-btn dashboard-btn-play"
                >
                  PLAY NOW
                </a>
                <button
                  type="button"
                  className="flow-btn home-btn-main dashboard-btn dashboard-btn-how"
                  onClick={() => setShowHelp(true)}
                >
                  HOW TO PLAY
                </button>
                <a
                  href="/deposit"
                  className="flow-btn home-btn-main dashboard-btn dashboard-btn-deposit"
                >
                  MANAGE MONEY
                </a>
                <button
                  type="button"
                  className="flow-btn home-btn-main dashboard-btn dashboard-btn-logout"
                  onClick={onLogout}
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flow-btn home-btn-main dashboard-btn dashboard-btn-play"
                onClick={onConnect}
                disabled={isConnecting}
              >
                {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
              </button>
            )}
          </div>
        </div>
      </section>

      {showHelp ? (
        <div className="home-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="home-modal-box" onClick={(event) => event.stopPropagation()}>
            <button
              className="home-modal-close"
              type="button"
              onClick={() => setShowHelp(false)}
            >
              X
            </button>
            <h2>HOW TO PLAY</h2>
            <div className="home-help-content">
              <div className="help-step">
                <span className="step-num">1</span>
                <div>
                  <p className="step-title">MANAGE MONEY</p>
                  <p>Claim faucet if needed, then deposit USDC into your vault.</p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-num">2</span>
                <div>
                  <p className="step-title">RUN & STACK</p>
                  <p>Move lane by lane to increase multiplier while avoiding traffic.</p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-num">3</span>
                <div>
                  <p className="step-title">CHECKPOINT CASH OUT</p>
                  <p>Cash out at checkpoints before crash or decay eats the payout.</p>
                </div>
              </div>
            </div>
            <button
              className="flow-btn secondary info-modal-action"
              type="button"
              onClick={() => setShowHelp(false)}
            >
              GOT IT
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
