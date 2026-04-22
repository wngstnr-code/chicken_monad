"use client";

import { useEffect, useRef, useState } from "react";
import { formatUnits, isAddress } from "viem";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { useWallet } from "../components/web3/WalletProvider";
import {
  ERC20_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "../lib/web3/contracts";

type HomeStage = "intro" | "connect" | "menu";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function shortAddress(address: string) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const {
    account,
    isMonadChain,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    clearWalletError,
  } = useWallet();
  const [stage, setStage] = useState<HomeStage>("intro");
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement | null>(null);

  const isConnected = Boolean(account);
  const ownerAddress = isAddress(account) ? (account as Address) : undefined;
  const usdcAddress = isAddress(USDC_ADDRESS) ? (USDC_ADDRESS as Address) : undefined;

  const { data: walletUsdcData } = useReadContract({
    address: usdcAddress || ZERO_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ownerAddress || ZERO_ADDRESS],
    query: {
      enabled: Boolean(isConnected && ownerAddress && usdcAddress),
    },
  });

  const walletUsdcDisplay =
    walletUsdcData === undefined ? "-" : formatUnits(walletUsdcData, USDC_DECIMALS);

  useEffect(() => {
    if (isConnected && (stage === "connect" || stage === "intro")) {
      setStage("menu");
    }
  }, [isConnected, stage]);

  useEffect(() => {
    if (!isConnected && stage === "menu") {
      setStage("intro");
    }
  }, [isConnected, stage]);

  useEffect(() => {
    if (!showProfilePopover) return;

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (profileWrapRef.current && target && !profileWrapRef.current.contains(target)) {
        setShowProfilePopover(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowProfilePopover(false);
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showProfilePopover]);

  function onPlayNow() {
    clearWalletError();
    setShowProfilePopover(false);
    setStage(isConnected ? "menu" : "connect");
  }

  function onBackToIntro() {
    clearWalletError();
    setShowProfilePopover(false);
    setStage("intro");
  }

  async function onConnectRabby() {
    await connectWallet();
  }

  function onLogout() {
    disconnectWallet();
    setShowProfilePopover(false);
    setStage("intro");
  }

  function onClickNavbarLogin() {
    clearWalletError();
    setShowProfilePopover(false);
    setStage(isConnected ? "menu" : "connect");
  }

  return (
    <main className="flow-page home-page">
      <header className="home-nav home-nav-global">
        <div className="home-brand">
          <div className="home-brand-badge">GM</div>
          <div>
            <p className="flow-eyebrow home-brand-eyebrow">Monad Runner</p>
            <p className="home-brand-name">Chicken Monad</p>
          </div>
        </div>

        {!isConnected ? (
          <button className="flow-btn secondary home-nav-login" type="button" onClick={onClickNavbarLogin}>
            LOGIN
          </button>
        ) : (
          <div className="home-profile-wrap" ref={profileWrapRef}>
            <button
              className="flow-btn secondary home-nav-login"
              type="button"
              onClick={() => setShowProfilePopover((current) => !current)}
            >
              {shortAddress(account)}
            </button>

            {showProfilePopover && (
              <section className="flow-status home-profile-popover">
                <p className="home-preview-title">PROFILE</p>
                <p>
                  Wallet: <span className="mono">{shortAddress(account)}</span>
                </p>
                <p>
                  Address: <span className="mono home-wallet-address">{account || "-"}</span>
                </p>
                <p>
                  USDC: <span className="mono">{walletUsdcDisplay}</span>
                </p>
                <p>
                  Chain:{" "}
                  <span className="mono">
                    {isMonadChain ? "MONAD READY" : "SWITCH TO MONAD"}
                  </span>
                </p>
                <div className="home-profile-actions">
                  <a href="/deposit" className="flow-btn secondary home-profile-deposit">
                    DEPOSIT
                  </a>
                  <button className="flow-btn secondary home-profile-deposit" type="button" onClick={onLogout}>
                    LOG OUT
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </header>

      <section className="home-hero">
        <div className="home-game-bg" aria-hidden="true">
          <iframe
            className="home-game-bg-frame"
            src="/play?bg=1"
            title="In-game background"
            tabIndex={-1}
          />
        </div>
        <div className="home-hero-overlay" aria-hidden="true" />

        <div className="home-shell">
          <p className="home-kicker">Web3 Arcade on Monad</p>
          <h1 className="home-title">Enter The Checkpoint Arena</h1>
          <p className="home-subcopy">
            Connect Rabby, deposit USDC, sprint through checkpoints, and cash out before you wipe.
            Satu flow, langsung siap untuk integrasi backend + smart contract.
          </p>

          {stage === "intro" && (
            <>
              <div className="home-preview-grid">
                <article className="home-preview-card">
                  <p>MODE</p>
                  <h3>Checkpoint Multiplier</h3>
                </article>
                <article className="home-preview-card">
                  <p>TOKEN</p>
                  <h3>USDC Deposit</h3>
                </article>
                <article className="home-preview-card">
                  <p>WALLET</p>
                  <h3>Rabby Only</h3>
                </article>
              </div>

              <div className="home-action-stack">
                <button className="flow-btn home-btn-main" type="button" onClick={onPlayNow}>
                  PLAY NOW
                </button>
              </div>
            </>
          )}

          {stage === "connect" && (
            <>
              <div className="flow-status home-flow-panel">
                <p>Step 1: Connect Rabby wallet dulu.</p>
                <p>Setelah connected, kamu otomatis masuk ke menu Play + Deposit.</p>
              </div>

              {error && <p className="flow-alert">{error}</p>}

              <div className="home-action-stack">
                <button
                  className="flow-btn home-btn-main"
                  type="button"
                  onClick={onConnectRabby}
                  disabled={isConnecting}
                >
                  {isConnecting ? "CONNECTING..." : "CONNECT RABBY"}
                </button>
                <button className="flow-btn secondary home-btn-main" type="button" onClick={onBackToIntro}>
                  BACK
                </button>
              </div>
            </>
          )}

          {stage === "menu" && (
            <>
              <div className="home-action-stack">
                <a href="/play" className="flow-btn home-btn-main">
                  PLAY NOW
                </a>
                <a href="/deposit" className="flow-btn secondary home-btn-main">
                  DEPOSIT USDC
                </a>
                <button className="flow-btn secondary home-btn-main" type="button" onClick={onLogout}>
                  LOG OUT
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
