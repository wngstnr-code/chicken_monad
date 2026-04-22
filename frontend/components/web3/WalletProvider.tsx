"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MONAD_CHAIN, hasMonadChainConfig } from "../../lib/web3/monad";

type RequestArguments = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

type WalletProviderApi = {
  request: <T = unknown>(args: RequestArguments) => Promise<T>;
  on?: {
    (event: "accountsChanged", listener: (accounts: string[]) => void): void;
    (event: "chainChanged", listener: (chainId: string) => void): void;
  };
  removeListener?: {
    (event: "accountsChanged", listener: (accounts: string[]) => void): void;
    (event: "chainChanged", listener: (chainId: string) => void): void;
  };
};

type WalletContextValue = {
  account: string;
  chainIdHex: string;
  isMonadChain: boolean;
  isConnecting: boolean;
  error: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToMonad: () => Promise<void>;
  clearWalletError: () => void;
  hasMonadChainConfig: boolean;
  monadChainIdHex: string;
  monadChainName: string;
};

type WalletProviderProps = {
  children: ReactNode;
};

type WalletError = {
  code?: number;
  message?: string;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function getEthereumProvider(): WalletProviderApi | null {
  if (typeof window === "undefined") return null;

  const runtimeWindow = window as Window & { ethereum?: WalletProviderApi };
  return runtimeWindow.ethereum || null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toLowerHex(value: string) {
  if (!value) return "";
  return value.toLowerCase();
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as WalletError).message || fallback);
  }
  return fallback;
}

function readErrorCode(error: unknown): number | null {
  if (error && typeof error === "object" && "code" in error) {
    return Number((error as WalletError).code);
  }
  return null;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [account, setAccount] = useState("");
  const [chainIdHex, setChainIdHex] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const isMonadChain =
    Boolean(MONAD_CHAIN.chainIdHex) &&
    toLowerHex(chainIdHex) === toLowerHex(MONAD_CHAIN.chainIdHex);

  async function refreshWalletState() {
    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const [accountsRaw, chainIdRaw] = await Promise.all([
      ethereum.request({ method: "eth_accounts" }),
      ethereum.request({ method: "eth_chainId" }),
    ]);

    const accounts = toStringArray(accountsRaw);
    const firstAccount = accounts.length > 0 ? accounts[0] : "";
    setAccount(firstAccount);
    setChainIdHex(typeof chainIdRaw === "string" ? chainIdRaw : "");
  }

  async function connectWallet() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setError("Wallet EVM tidak terdeteksi. Install MetaMask atau Rabby.");
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      const accountsRaw = await ethereum.request({ method: "eth_requestAccounts" });
      const chainIdRaw = await ethereum.request({ method: "eth_chainId" });
      const accounts = toStringArray(accountsRaw);
      const firstAccount = accounts.length > 0 ? accounts[0] : "";
      setAccount(firstAccount);
      setChainIdHex(typeof chainIdRaw === "string" ? chainIdRaw : "");
    } catch (connectError) {
      setError(readErrorMessage(connectError, "Gagal connect wallet."));
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectWallet() {
    // Wallet browser extension tidak punya API standar untuk force-disconnect.
    // Kita clear local session state agar UX app tetap konsisten.
    setAccount("");
    setChainIdHex("");
    setError("");
  }

  async function switchToMonad() {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setError("Wallet EVM tidak terdeteksi.");
      return;
    }

    if (!hasMonadChainConfig()) {
      setError("Config Monad belum lengkap. Isi dulu variabel di .env.local.");
      return;
    }

    setError("");

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_CHAIN.chainIdHex }],
      });
      setChainIdHex(MONAD_CHAIN.chainIdHex);
      return;
    } catch (switchError) {
      const code = readErrorCode(switchError);

      if (code !== 4902) {
        setError(readErrorMessage(switchError, "Gagal switch ke chain Monad."));
        return;
      }
    }

    try {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: MONAD_CHAIN.chainIdHex,
            chainName: MONAD_CHAIN.chainName,
            nativeCurrency: MONAD_CHAIN.nativeCurrency,
            rpcUrls: MONAD_CHAIN.rpcUrls,
            blockExplorerUrls: MONAD_CHAIN.blockExplorerUrls,
          },
        ],
      });
      setChainIdHex(MONAD_CHAIN.chainIdHex);
    } catch (addError) {
      setError(readErrorMessage(addError, "Gagal menambahkan chain Monad."));
    }
  }

  useEffect(() => {
    refreshWalletState().catch(() => {
      setError("Tidak bisa membaca state wallet.");
    });
  }, []);

  useEffect(() => {
    const ethereum = getEthereumProvider();
    if (!ethereum?.on) return;

    function handleAccountsChanged(accounts: string[]) {
      const firstAccount = accounts.length > 0 ? accounts[0] : "";
      setAccount(firstAccount);
      if (!firstAccount) setError("");
    }

    function handleChainChanged(nextChainId: string) {
      setChainIdHex(nextChainId);
    }

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!ethereum.removeListener) return;
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      account,
      chainIdHex,
      isMonadChain,
      isConnecting,
      error,
      connectWallet,
      disconnectWallet,
      switchToMonad,
      clearWalletError: () => setError(""),
      hasMonadChainConfig: hasMonadChainConfig(),
      monadChainIdHex: MONAD_CHAIN.chainIdHex,
      monadChainName: MONAD_CHAIN.chainName,
    }),
    [account, chainIdHex, error, isConnecting, isMonadChain]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet harus dipakai di dalam WalletProvider.");
  }
  return value;
}
