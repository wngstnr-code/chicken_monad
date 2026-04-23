"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "../web3/WalletProvider";

function shortAddress(address: string) {
  if (!address) return "NO WALLET";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type PlayStatusTone = "ready" | "info" | "warning" | "error" | "busy";

type PlayStatusState = {
  message: string;
  tone: PlayStatusTone;
  sticky?: boolean;
};

export function PlayTopNav() {
  const {
    account,
    isConnecting,
    isMonadChain,
    connectWallet,
    disconnectWallet,
    switchToMonad,
    error,
    isBackendAuthenticated,
    isBackendAuthLoading,
    backendAuthError,
    authenticateBackend,
    hasBackendApiConfig,
  } = useWallet();
  const [depositLabel, setDepositLabel] = useState("DEPOSIT");
  const [isDepositBusy, setIsDepositBusy] = useState(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [transientStatus, setTransientStatus] = useState<PlayStatusState | null>(null);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const isConnected = Boolean(account);

  function openDepositModal() {
    window.dispatchEvent(new CustomEvent("chicken:open-deposit-modal"));
  }

  async function onWalletButtonClick() {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    setIsWalletMenuOpen((prev) => !prev);
  }

  function onLogoutClick() {
    disconnectWallet();
    setIsWalletMenuOpen(false);
  }

  async function onStatusActionClick() {
    if (isConnecting || isBackendAuthLoading) return;

    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!isMonadChain) {
      await switchToMonad();
      return;
    }

    if (hasBackendApiConfig && !isBackendAuthenticated) {
      await authenticateBackend();
    }
  }

  useEffect(() => {
    function onDepositUiState(event: Event) {
      const detail = (event as CustomEvent<{ label?: string; busy?: boolean }>).detail;
      if (detail?.label) setDepositLabel(detail.label);
      if (typeof detail?.busy === "boolean") setIsDepositBusy(detail.busy);
    }

    window.addEventListener("chicken:deposit-ui-state", onDepositUiState as EventListener);
    return () => {
      window.removeEventListener("chicken:deposit-ui-state", onDepositUiState as EventListener);
    };
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const menuRoot = walletMenuRef.current;
      if (!menuRoot) return;
      if (event.target instanceof Node && menuRoot.contains(event.target)) return;
      setIsWalletMenuOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsWalletMenuOpen(false);
    }

    document.addEventListener("click", onDocumentClick);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    function clearTransientStatus() {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
      setTransientStatus(null);
    }

    function onPlayStatus(event: Event) {
      const detail = (event as CustomEvent<{
        clear?: boolean;
        message?: string;
        tone?: PlayStatusTone;
        sticky?: boolean;
        durationMs?: number;
      }>).detail;

      if (detail?.clear) {
        clearTransientStatus();
        return;
      }

      const message = String(detail?.message || "").trim();
      if (!message) {
        clearTransientStatus();
        return;
      }

      const nextStatus: PlayStatusState = {
        message,
        tone: detail?.tone || "info",
        sticky: Boolean(detail?.sticky),
      };

      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }

      setTransientStatus(nextStatus);

      if (!nextStatus.sticky) {
        const durationMs =
          Number(detail?.durationMs) > 0 ? Number(detail?.durationMs) : 3800;
        statusTimeoutRef.current = window.setTimeout(() => {
          setTransientStatus(null);
          statusTimeoutRef.current = null;
        }, durationMs);
      }
    }

    window.addEventListener("chicken:play-status", onPlayStatus as EventListener);
    return () => {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
      window.removeEventListener("chicken:play-status", onPlayStatus as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setIsWalletMenuOpen(false);
    }
  }, [isConnected]);

  let statusTone: PlayStatusTone = "ready";
  let statusMessage = "READY TO PLAY";
  let statusActionLabel = "";

  if (transientStatus?.message) {
    statusTone = transientStatus.tone;
    statusMessage = transientStatus.message;
  } else if (isConnecting) {
    statusTone = "busy";
    statusMessage = "CONNECTING WALLET...";
  } else if (!isConnected && error) {
    statusTone = "error";
    statusMessage = error;
    statusActionLabel = "RETRY";
  } else if (!isConnected) {
    statusTone = "warning";
    statusMessage = "CONNECT WALLET TO PLAY";
    statusActionLabel = "CONNECT";
  } else if (error) {
    statusTone = "error";
    statusMessage = error;
    statusActionLabel = !isMonadChain ? "SWITCH" : "";
  } else if (!isMonadChain) {
    statusTone = "warning";
    statusMessage = "SWITCH TO MONAD TESTNET";
    statusActionLabel = "SWITCH";
  } else if (hasBackendApiConfig && isBackendAuthLoading) {
    statusTone = "busy";
    statusMessage = "SIGNING IN TO BACKEND...";
  } else if (hasBackendApiConfig && backendAuthError) {
    statusTone = "error";
    statusMessage = backendAuthError;
    statusActionLabel = "SIGN IN";
  } else if (hasBackendApiConfig && !isBackendAuthenticated) {
    statusTone = "warning";
    statusMessage = "SIGN IN BACKEND TO SYNC GAME DATA";
    statusActionLabel = "SIGN IN";
  }

  const isIdleReadyStatus =
    statusTone === "ready" &&
    statusMessage === "READY TO PLAY" &&
    !statusActionLabel &&
    !transientStatus?.message;

  return (
    <nav className="play-nav">
      <div className="play-nav-row">
        <div ref={walletMenuRef} className="play-wallet-menu">
          <button
            type="button"
            className={`play-wallet-trigger${isConnected ? " connected" : " connect"}`}
            onClick={() => {
              void onWalletButtonClick();
            }}
            disabled={isConnecting}
            title={isConnected ? account : "Connect wallet"}
            aria-expanded={isConnected ? isWalletMenuOpen : false}
          >
            {isConnecting
              ? "CONNECTING..."
              : isConnected
                ? shortAddress(account)
                : "CONNECT WALLET"}
          </button>

          {isConnected && isWalletMenuOpen && (
            <div className="play-wallet-popover" role="menu">
              <button
                type="button"
                className="play-wallet-logout"
                onClick={onLogoutClick}
              >
                LOG OUT
              </button>
            </div>
          )}
        </div>
        <a href="/">HOME</a>
      </div>
      <button
        type="button"
        className={`play-nav-deposit${isDepositBusy ? " busy" : ""}`}
        onClick={openDepositModal}
        disabled={isDepositBusy}
      >
        {depositLabel}
      </button>
      <div
        className={`play-status play-status-${statusTone}${isIdleReadyStatus ? " play-status-idle" : ""}`}
        aria-live="polite"
      >
        <span className="play-status-text">{statusMessage}</span>
        {statusActionLabel ? (
          <button
            type="button"
            className="play-status-action"
            onClick={() => {
              void onStatusActionClick();
            }}
            disabled={isConnecting || isBackendAuthLoading}
          >
            {statusActionLabel}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
