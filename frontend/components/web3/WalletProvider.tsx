"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { MONAD_CHAIN, hasMonadChainConfig } from "../../lib/web3/monad";

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

type AddChainArguments = {
  method: "wallet_addEthereumChain";
  params: Array<{
    chainId: string;
    chainName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }>;
};

type Eip1193Provider = {
  request: (args: AddChainArguments) => Promise<unknown>;
};

type ChainSwitchError = {
  code?: number;
  message?: string;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function toHexChainId(chainId: number | undefined) {
  if (!chainId) return "";
  return `0x${chainId.toString(16)}`;
}

function readSwitchErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return Number((error as ChainSwitchError).code);
  }
  return null;
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as ChainSwitchError).message || fallback);
  }
  return fallback;
}

function getEip1193Provider() {
  if (typeof window === "undefined") return null;
  const runtimeWindow = window as Window & { ethereum?: Eip1193Provider };
  return runtimeWindow.ethereum || null;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [error, setError] = useState("");
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();

  const chainIdHex = toHexChainId(chainId);
  const account = address || "";
  const hasMonadConfig = hasMonadChainConfig();
  const isMonadChain =
    hasMonadConfig &&
    chainIdHex.toLowerCase() === (MONAD_CHAIN.chainIdHex || "").toLowerCase();
  const isConnecting = isConnectPending || isSwitchPending;

  async function connectWallet() {
    if (connectors.length === 0) {
      setError("Rabby wallet tidak terdeteksi. Install/aktifkan Rabby extension dulu.");
      return;
    }

    setError("");
    const selectedConnector =
      connectors.find((connector) => connector.id === "rabby") || connectors[0];

    try {
      await connectAsync({ connector: selectedConnector });
    } catch (connectError) {
      setError(readErrorMessage(connectError, "Gagal connect wallet."));
    }
  }

  function disconnectWallet() {
    disconnect();
    setError("");
  }

  async function addMonadChainToWallet() {
    const provider = getEip1193Provider();
    if (!provider) {
      setError("Wallet EVM tidak terdeteksi.");
      return;
    }

    await provider.request({
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
  }

  async function switchToMonad() {
    if (!isConnected) {
      setError("Connect wallet dulu sebelum switch chain.");
      return;
    }

    if (!hasMonadConfig) {
      setError("Config Monad belum lengkap. Isi dulu variabel di frontend/.env.local.");
      return;
    }

    setError("");

    try {
      await switchChainAsync({ chainId: MONAD_CHAIN.chainIdDecimal });
      return;
    } catch (switchError) {
      const switchCode = readSwitchErrorCode(switchError);
      const shouldTryAddChain =
        switchCode === 4902 ||
        readErrorMessage(switchError, "").toLowerCase().includes("unrecognized");

      if (!shouldTryAddChain) {
        setError(readErrorMessage(switchError, "Gagal switch ke chain Monad."));
        return;
      }
    }

    try {
      await addMonadChainToWallet();
      await switchChainAsync({ chainId: MONAD_CHAIN.chainIdDecimal });
    } catch (addChainError) {
      setError(readErrorMessage(addChainError, "Gagal menambahkan chain Monad."));
    }
  }

  useEffect(() => {
    if (!isConnected) {
      setError("");
    }
  }, [isConnected]);

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
      hasMonadChainConfig: hasMonadConfig,
      monadChainIdHex: MONAD_CHAIN.chainIdHex,
      monadChainName: MONAD_CHAIN.chainName,
    }),
    [account, chainIdHex, error, hasMonadConfig, isConnecting, isMonadChain]
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
