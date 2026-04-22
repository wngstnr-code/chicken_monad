"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import type { Address, Hash } from "viem";
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useWallet } from "../../components/web3/WalletProvider";
import {
  ERC20_ABI,
  GAME_VAULT_ABI,
  GAME_VAULT_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  hasDepositContractConfig,
} from "../../lib/web3/contracts";
import { explorerTxUrl } from "../../lib/web3/monad";
import type { DepositFlowViewModel } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function normalizeError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message || fallback);
  }
  return fallback;
}

function formatUsdcAmount(value: bigint | undefined) {
  if (value === undefined) return "-";
  return formatUnits(value, USDC_DECIMALS);
}

export function useOnchainDepositFlow(): DepositFlowViewModel {
  const { account, isMonadChain } = useWallet();
  const [amount, setAmount] = useState("10");
  const [statusMessage, setStatusMessage] = useState("");
  const [uiError, setUiError] = useState("");
  const [handledApproveHash, setHandledApproveHash] = useState("");
  const [handledDepositHash, setHandledDepositHash] = useState("");

  const isConnected = Boolean(account);
  const ownerAddress = isAddress(account) ? (account as Address) : undefined;
  const usdcAddress = isAddress(USDC_ADDRESS) ? (USDC_ADDRESS as Address) : undefined;
  const vaultAddress = isAddress(GAME_VAULT_ADDRESS)
    ? (GAME_VAULT_ADDRESS as Address)
    : undefined;
  const hasValidContracts = hasDepositContractConfig();
  const canTransact = Boolean(
    isConnected && isMonadChain && ownerAddress && usdcAddress && vaultAddress
  );

  const parsedAmount = useMemo(() => {
    try {
      const value = parseUnits(amount || "0", USDC_DECIMALS);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount]);

  const {
    data: walletBalanceData,
    refetch: refetchWalletBalance,
    isFetching: isWalletBalanceFetching,
  } = useReadContract({
    address: usdcAddress || ZERO_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ownerAddress || ZERO_ADDRESS],
    query: {
      enabled: canTransact,
    },
  });

  const {
    data: allowanceData,
    refetch: refetchAllowance,
    isFetching: isAllowanceFetching,
  } = useReadContract({
    address: usdcAddress || ZERO_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress || ZERO_ADDRESS, vaultAddress || ZERO_ADDRESS],
    query: {
      enabled: canTransact,
    },
  });

  const {
    writeContractAsync: approveAsync,
    data: approveTxHash,
    isPending: isApproveSubmitting,
    error: approveWriteError,
  } = useWriteContract();

  const {
    writeContractAsync: depositAsync,
    data: depositTxHash,
    isPending: isDepositSubmitting,
    error: depositWriteError,
  } = useWriteContract();

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveConfirmed,
    error: approveConfirmError,
  } = useWaitForTransactionReceipt({
    hash: approveTxHash as Hash | undefined,
  });

  const {
    isLoading: isDepositConfirming,
    isSuccess: isDepositConfirmed,
    error: depositConfirmError,
  } = useWaitForTransactionReceipt({
    hash: depositTxHash as Hash | undefined,
  });

  const allowance = allowanceData ?? 0n;
  const walletBalance = walletBalanceData ?? 0n;
  const needsApproval = Boolean(parsedAmount && allowance < parsedAmount);

  useEffect(() => {
    if (!isApproveConfirmed || !approveTxHash || approveTxHash === handledApproveHash) return;

    setHandledApproveHash(approveTxHash);
    setUiError("");
    setStatusMessage("Approve confirmed. Kamu bisa lanjut deposit.");
    void refetchAllowance();
  }, [approveTxHash, handledApproveHash, isApproveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (!isDepositConfirmed || !depositTxHash || depositTxHash === handledDepositHash) return;

    setHandledDepositHash(depositTxHash);
    setUiError("");
    setStatusMessage("Deposit confirmed on-chain.");
    void refetchAllowance();
    void refetchWalletBalance();
  }, [
    depositTxHash,
    handledDepositHash,
    isDepositConfirmed,
    refetchAllowance,
    refetchWalletBalance,
  ]);

  const errorMessage = useMemo(() => {
    if (uiError) return uiError;
    return (
      normalizeError(approveWriteError, "") ||
      normalizeError(approveConfirmError, "") ||
      normalizeError(depositWriteError, "") ||
      normalizeError(depositConfirmError, "")
    );
  }, [approveConfirmError, approveWriteError, depositConfirmError, depositWriteError, uiError]);

  async function onApprove() {
    if (!canTransact || !usdcAddress || !vaultAddress) {
      setUiError("Pastikan wallet connect, sudah di Monad, dan config contract valid.");
      return;
    }
    if (!parsedAmount) {
      setUiError("Masukkan amount USDC yang valid.");
      return;
    }

    setUiError("");
    setStatusMessage("");

    try {
      await approveAsync({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddress, parsedAmount],
      });
    } catch (approveError) {
      setUiError(normalizeError(approveError, "Approve gagal."));
    }
  }

  async function onDeposit() {
    if (!canTransact || !vaultAddress) {
      setUiError("Pastikan wallet connect, sudah di Monad, dan config contract valid.");
      return;
    }
    if (!parsedAmount) {
      setUiError("Masukkan amount USDC yang valid.");
      return;
    }
    if (needsApproval) {
      setUiError("Allowance belum cukup. Jalankan approve dulu.");
      return;
    }

    setUiError("");
    setStatusMessage("");

    try {
      await depositAsync({
        address: vaultAddress,
        abi: GAME_VAULT_ABI,
        functionName: "deposit",
        args: [parsedAmount],
      });
    } catch (depositError) {
      setUiError(normalizeError(depositError, "Deposit gagal."));
    }
  }

  const approveTxUrl = approveTxHash ? explorerTxUrl(approveTxHash) : "";
  const depositTxUrl = depositTxHash ? explorerTxUrl(depositTxHash) : "";

  const isApproveBusy = isApproveSubmitting || isApproveConfirming;
  const isDepositBusy = isDepositSubmitting || isDepositConfirming;
  const disableApproveButton =
    !canTransact || !parsedAmount || !needsApproval || isApproveBusy || isDepositBusy;
  const disableDepositButton =
    !canTransact || !parsedAmount || needsApproval || isApproveBusy || isDepositBusy;

  return {
    source: "onchain",
    amount,
    setAmount,
    statusMessage,
    errorMessage,
    isConnected,
    isMonadChain,
    canTransact,
    hasValidContracts,
    usdcAddress: USDC_ADDRESS,
    vaultAddress: GAME_VAULT_ADDRESS,
    walletBalanceDisplay: isWalletBalanceFetching ? "loading..." : formatUsdcAmount(walletBalance),
    allowanceDisplay: isAllowanceFetching ? "loading..." : formatUsdcAmount(allowance),
    isWalletBalanceFetching,
    isAllowanceFetching,
    needsApproval,
    approveTxHash: approveTxHash || "",
    approveTxUrl,
    depositTxHash: depositTxHash || "",
    depositTxUrl,
    isApproveBusy,
    isDepositBusy,
    disableApproveButton,
    disableDepositButton,
    onApprove,
    onDeposit,
    configMessage: !hasValidContracts
      ? "Contract config belum valid. Isi address yang benar di `frontend/.env.local`."
      : "",
  };
}
