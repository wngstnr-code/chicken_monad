"use client";

import { useEffect, useRef, useState } from "react";
import { formatUnits, isAddress } from "viem";
import type { Address } from "viem";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useWallet } from "../components/web3/WalletProvider";
import {
  ERC20_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_FAUCET_ABI,
  USDC_FAUCET_ADDRESS,
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
  const [showHelp, setShowHelp] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement | null>(null);

  const isConnected = Boolean(account);
  const ownerAddress = isAddress(account) ? (account as Address) : undefined;
  const usdcAddress = isAddress(USDC_ADDRESS)
    ? (USDC_ADDRESS as Address)
    : undefined;

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
    walletUsdcData === undefined
      ? "-"
      : formatUnits(walletUsdcData, USDC_DECIMALS);

  const {
    data: hash,
    isPending: isClaiming,
    writeContract,
  } = useWriteContract();
  const { isLoading: isWaitingForClaim, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash });

  function onClaimFaucet() {
    if (!isAddress(USDC_FAUCET_ADDRESS)) return;
    writeContract({
      address: USDC_FAUCET_ADDRESS as Address,
      abi: USDC_FAUCET_ABI,
      functionName: "claim",
    });
  }

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
      if (
        profileWrapRef.current &&
        target &&
        !profileWrapRef.current.contains(target)
      ) {
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
          <div className="home-brand-name">Chicken Monad</div>
        </div>

        <div className="home-nav-actions">
          {!isConnected ? (
            <button
              className="flow-btn secondary home-nav-login"
              type="button"
              onClick={onClickNavbarLogin}
            >
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
                <section
                  className="flow-status home-profile-popover"
                  style={{ color: "white" }}
                >
                  <p className="home-preview-title">PROFILE</p>
                  <p>
                    Wallet:{" "}
                    <span className="mono">{shortAddress(account)}</span>
                  </p>
                  <p>
                    Address:{" "}
                    <span className="mono home-wallet-address">
                      {account || "-"}
                    </span>
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
                    <a
                      href="/deposit"
                      className="flow-btn secondary home-profile-deposit"
                    >
                      DEPOSIT
                    </a>
                    <button
                      className="flow-btn secondary home-profile-deposit"
                      type="button"
                      onClick={onClaimFaucet}
                      disabled={isClaiming || isWaitingForClaim}
                    >
                      {isClaiming || isWaitingForClaim
                        ? "CLAIMING..."
                        : "CLAIM FAUCET"}
                    </button>
                    <button
                      className="flow-btn btn-logout home-profile-deposit"
                      type="button"
                      onClick={onLogout}
                    >
                      LOG OUT
                    </button>
                  </div>
                  {isClaimSuccess && (
                    <p
                      className="flow-alert"
                      style={{
                        marginTop: 8,
                        borderColor: "#4caf50",
                        color: "#4caf50",
                      }}
                    >
                      Faucet claimed successfully!
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
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
          <h1 className="home-title" style={{ letterSpacing: "6px" }}>
            CHICKEN MONAD
          </h1>
          <p className="home-subcopy">Outrun the crash. Risk it all.</p>
          <div className="home-badge">POWERED BY MONAD</div>

          {stage === "intro" && (
            <div className="home-action-stack" style={{ marginTop: "24px" }}>
              <button
                className="flow-btn home-btn-main"
                type="button"
                onClick={onPlayNow}
              >
                PLAY NOW
              </button>
            </div>
          )}

          {stage === "connect" && (
            <>
              {error && <p className="flow-alert">{error}</p>}

              <div className="home-action-stack">
                <button
                  className="flow-btn home-btn-main"
                  type="button"
                  onClick={onConnectRabby}
                  disabled={isConnecting}
                >
                  {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
                </button>
                <button
                  className="flow-btn secondary home-btn-main"
                  type="button"
                  onClick={onBackToIntro}
                >
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
                <button
                  className="flow-btn btn-logout home-btn-main"
                  type="button"
                  onClick={onLogout}
                >
                  LOG OUT
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {showHelp && (
        <div className="home-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="home-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              className="home-modal-close"
              onClick={() => setShowHelp(false)}
            >
              X
            </button>
            <h2>HOW TO PLAY</h2>
            <div className="home-help-content">
              <div className="help-step">
                <span className="step-num">1</span>
                <div>
                  <p className="step-title">DEPOSIT</p>
                  <p>Move your USDC from wallet to the game vault.</p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-num">2</span>
                <div>
                  <p className="step-title">RUN & STACK</p>
                  <p>
                    Avoid the segment crash. Every step increases your
                    multiplier.
                  </p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-num">3</span>
                <div>
                  <p className="step-title">CASH OUT</p>
                  <p>
                    Reach a Checkpoint and claim your profit before time runs
                    out!
                  </p>
                </div>
              </div>
            </div>
            <button
              className="flow-btn secondary info-modal-action"
              type="button"
              onClick={() => setShowHelp(false)}
            >
              GOT IT!
            </button>
          </div>
        </div>
      )}

      <button
        className="home-help-btn fixed-help"
        type="button"
        onClick={() => setShowHelp(true)}
        title="How to Play"
      >
        ?
      </button>
    </main>
  );
}
