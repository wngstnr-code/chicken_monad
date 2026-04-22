"use client";

import { useWallet } from "../../components/web3/WalletProvider";

function shortAddress(address: string) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectPage() {
  const {
    account,
    chainIdHex,
    isMonadChain,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    switchToMonad,
    hasMonadChainConfig,
    monadChainIdHex,
    monadChainName,
    clearWalletError,
    backendApiUrl,
    hasBackendApiConfig,
    isBackendAuthenticated,
    isBackendAuthLoading,
    backendAuthError,
    authenticateBackend,
    logoutBackend,
  } = useWallet();

  const isConnected = Boolean(account);

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="flow-eyebrow">Step 1</p>
        <h1 className="flow-title">Connect Wallet</h1>
        <p className="flow-copy">
          Gunakan halaman ini untuk connect wallet EVM, lalu switch ke chain Monad sebelum
          deposit USDC.
        </p>

        <div className="flow-status">
          <p>
            Status: <strong>{isConnected ? "Connected" : "Not connected"}</strong>
          </p>
          <p>
            Account: <span className="mono">{shortAddress(account)}</span>
          </p>
          <p>
            Chain: <span className="mono">{chainIdHex || "-"}</span>
          </p>
          <p>
            Monad: <strong>{isMonadChain ? "Yes" : "No"}</strong>
          </p>
          <p>
            Backend: <strong>{isBackendAuthenticated ? "Authenticated" : "Not authenticated"}</strong>
          </p>
          <p>
            Backend URL: <span className="mono">{backendApiUrl || "(set in frontend/.env.local)"}</span>
          </p>
          <p>
            Target Chain:{" "}
            <span className="mono">
              {monadChainName} {monadChainIdHex || "(set in frontend/.env.local)"}
            </span>
          </p>
        </div>

        {!hasMonadChainConfig && (
          <p className="flow-alert">
            Config Monad belum lengkap. Isi dulu `frontend/.env.local` berdasarkan
            `frontend/.env.example`.
          </p>
        )}

        {!hasBackendApiConfig && (
          <p className="flow-alert">
            Backend API belum dikonfigurasi. Isi `NEXT_PUBLIC_BACKEND_API_URL` di
            `frontend/.env.local`.
          </p>
        )}

        {error && (
          <p className="flow-alert">
            {error}{" "}
            <button className="inline-btn" type="button" onClick={clearWalletError}>
              clear
            </button>
          </p>
        )}

        {backendAuthError && <p className="flow-alert">{backendAuthError}</p>}

        <div className="flow-actions">
          <button
            className="flow-btn"
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Rabby"}
          </button>
          <button
            className="flow-btn secondary"
            type="button"
            onClick={switchToMonad}
            disabled={!isConnected}
          >
            Switch To Monad
          </button>
          <button
            className="flow-btn secondary"
            type="button"
            onClick={disconnectWallet}
            disabled={!isConnected}
          >
            Clear Session
          </button>
        </div>

        <div className="flow-actions">
          <button
            className="flow-btn secondary"
            type="button"
            onClick={() => void authenticateBackend()}
            disabled={!isConnected || !hasBackendApiConfig || isBackendAuthLoading}
          >
            {isBackendAuthLoading
              ? "Signing In..."
              : isBackendAuthenticated
                ? "Backend Ready"
                : "Sign In To Backend"}
          </button>
          <button
            className="flow-btn secondary"
            type="button"
            onClick={() => void logoutBackend()}
            disabled={!hasBackendApiConfig || !isBackendAuthenticated}
          >
            Logout Backend
          </button>
        </div>

        <div className="flow-actions">
          <a href="/deposit" className="flow-btn secondary">
            Continue: Deposit USDC
          </a>
          <a href="/play" className="flow-btn secondary">
            Open Game
          </a>
        </div>
      </section>
    </main>
  );
}
