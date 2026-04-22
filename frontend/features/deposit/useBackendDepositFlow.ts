"use client";

import { useMemo, useState } from "react";
import { useWallet } from "../../components/web3/WalletProvider";
import { BACKEND_API_URL, hasBackendApiConfig } from "../../lib/backend/config";
import type { DepositFlowViewModel } from "./types";

export function useBackendDepositFlow(): DepositFlowViewModel {
  const { account, isMonadChain } = useWallet();
  const [amount, setAmount] = useState("10");

  const isConnected = Boolean(account);
  const hasBackendConfig = hasBackendApiConfig();
  const configMessage = useMemo(() => {
    if (!hasBackendConfig) {
      return "Mode backend aktif tapi `NEXT_PUBLIC_BACKEND_API_URL` belum diisi.";
    }
    return "Mode backend siap. Tinggal sambungkan endpoint approve/deposit dari tim backend.";
  }, [hasBackendConfig]);

  return {
    source: "backend",
    amount,
    setAmount,
    statusMessage: "",
    errorMessage: "",
    isConnected,
    isMonadChain,
    canTransact: false,
    hasValidContracts: hasBackendConfig,
    usdcAddress: "",
    vaultAddress: "",
    walletBalanceDisplay: "-",
    allowanceDisplay: "-",
    isWalletBalanceFetching: false,
    isAllowanceFetching: false,
    needsApproval: false,
    approveTxHash: "",
    approveTxUrl: "",
    depositTxHash: "",
    depositTxUrl: "",
    isApproveBusy: false,
    isDepositBusy: false,
    disableApproveButton: true,
    disableDepositButton: true,
    onApprove: async () => {
      throw new Error(
        `Backend mode belum diimplementasi. Set endpoint di ${BACKEND_API_URL || "frontend/.env.local"}.`
      );
    },
    onDeposit: async () => {
      throw new Error(
        `Backend mode belum diimplementasi. Set endpoint di ${BACKEND_API_URL || "frontend/.env.local"}.`
      );
    },
    configMessage,
  };
}
