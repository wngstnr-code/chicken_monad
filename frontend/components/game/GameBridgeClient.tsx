"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { formatUnits, isAddress, parseUnits } from "viem";
import type { Address, Hash } from "viem";
import {
  getAccount,
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { useWallet } from "../web3/WalletProvider";
import { backendPost } from "../../lib/backend/api";
import { BACKEND_API_URL, hasBackendApiConfig } from "../../lib/backend/config";
import {
  GAME_SETTLEMENT_ABI,
  GAME_SETTLEMENT_ADDRESS,
  GAME_VAULT_ABI,
  GAME_VAULT_ADDRESS,
  USDC_DECIMALS,
  hasGameContractConfig,
} from "../../lib/web3/contracts";
import { wagmiConfig } from "../../lib/web3/wagmiConfig";

type GameBridgeClientProps = {
  backgroundMode?: boolean;
};

type StartedPayload = {
  sessionId: string;
  onchainSessionId: string;
  stake: number;
  stakeAmountUnits: string;
};

type SettlementPayload = {
  sessionId: string;
  onchainSessionId: string;
  settlementSignature?: string;
  signature?: string;
  resolution?: ChickenBridgeSettlementResolution;
  payload?: ChickenBridgeSettlementResolution;
  multiplier?: string;
  payoutAmount?: string;
  profit?: string;
  reason?: string;
};

type PendingResolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
};

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const RESPONSE_TIMEOUT_MS = 45_000;

function normalizeError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message || fallback);
  }
  return fallback;
}

function toNumberAmount(value: bigint) {
  return Number(formatUnits(value, USDC_DECIMALS));
}

function rejectPendingRequest<T>(pending: PendingResolver<T> | null, message: string) {
  if (!pending) return;
  window.clearTimeout(pending.timeoutId);
  pending.reject(new Error(message));
}

export function GameBridgeClient({ backgroundMode = false }: GameBridgeClientProps) {
  const {
    account,
    isMonadChain,
    hasBackendApiConfig: hasBackendConfig,
    ensureBackendSession,
    refreshBackendSession,
  } = useWallet();
  const socketRef = useRef<Socket | null>(null);
  const activeSessionIdRef = useRef<string>("");
  const pendingStartRef = useRef<PendingResolver<StartedPayload> | null>(null);
  const pendingCashoutRef = useRef<PendingResolver<SettlementPayload> | null>(null);
  const pendingCrashRef = useRef<PendingResolver<SettlementPayload> | null>(null);

  useEffect(() => {
    if (backgroundMode) {
      window.__CHICKEN_MONAD_BRIDGE__ = {
        backgroundMode: true,
        loadAvailableBalance: async () => 0,
        openDeposit: () => {
          window.location.href = "/deposit";
        },
        startBet: async () => {
          throw new Error("Background mode tidak mendukung start bet.");
        },
        sendMove: () => {},
        cashOut: async () => {
          throw new Error("Background mode tidak mendukung cash out.");
        },
        crash: async () => null,
      };

      return () => {
        delete window.__CHICKEN_MONAD_BRIDGE__;
      };
    }

    function ensureSocket() {
      if (socketRef.current) {
        return socketRef.current;
      }

      if (!hasBackendApiConfig() || !BACKEND_API_URL) {
        throw new Error("NEXT_PUBLIC_BACKEND_API_URL belum diisi.");
      }

      const socket = io(BACKEND_API_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("game:started", (payload: StartedPayload) => {
        const pending = pendingStartRef.current;
        if (!pending) return;

        pendingStartRef.current = null;
        window.clearTimeout(pending.timeoutId);
        pending.resolve(payload);
      });

      socket.on("game:cashout_result", (payload: SettlementPayload) => {
        const pending = pendingCashoutRef.current;
        if (!pending) return;

        pendingCashoutRef.current = null;
        window.clearTimeout(pending.timeoutId);
        pending.resolve(payload);
      });

      socket.on("game:crashed", (payload: SettlementPayload) => {
        const pending = pendingCrashRef.current;
        if (!pending) return;

        pendingCrashRef.current = null;
        window.clearTimeout(pending.timeoutId);
        pending.resolve(payload);
      });

      socket.on("game:error", (payload: { message?: string }) => {
        const message = payload?.message || "Backend game error.";
        rejectPendingRequest(pendingStartRef.current, message);
        rejectPendingRequest(pendingCashoutRef.current, message);
        rejectPendingRequest(pendingCrashRef.current, message);
        pendingStartRef.current = null;
        pendingCashoutRef.current = null;
        pendingCrashRef.current = null;
        window.dispatchEvent(new CustomEvent("chicken:game-error", { detail: { message } }));
      });

      socket.on("game:cp_expired", (payload: { message?: string }) => {
        window.dispatchEvent(
          new CustomEvent("chicken:cp-expired", { detail: { message: payload?.message || "" } })
        );
      });

      socketRef.current = socket;
      return socket;
    }

    async function waitForSocketReady(socket: Socket) {
      if (socket.connected) return;

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          socket.off("connect", onConnect);
          socket.off("connect_error", onError);
          reject(new Error("Socket connection timeout."));
        }, RESPONSE_TIMEOUT_MS);

        function onConnect() {
          window.clearTimeout(timeoutId);
          socket.off("connect_error", onError);
          resolve();
        }

        function onError(error: Error) {
          window.clearTimeout(timeoutId);
          socket.off("connect", onConnect);
          reject(error);
        }

        socket.once("connect", onConnect);
        socket.once("connect_error", onError);
      });
    }

    function createPendingRequest<T>(ref: React.MutableRefObject<PendingResolver<T> | null>) {
      return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          ref.current = null;
          reject(new Error("Backend response timeout."));
        }, RESPONSE_TIMEOUT_MS);

        ref.current = { resolve, reject, timeoutId };
      });
    }

    async function requireReadyWallet() {
      if (!account || !isAddress(account)) {
        throw new Error("Connect wallet dulu sebelum main.");
      }
      if (!isMonadChain) {
        throw new Error("Switch wallet ke Monad dulu sebelum main.");
      }
      if (!hasGameContractConfig()) {
        throw new Error("Config contract frontend belum lengkap.");
      }
      if (!hasBackendConfig) {
        throw new Error("Config backend frontend belum lengkap.");
      }

      const authOkay = await ensureBackendSession();
      if (!authOkay) {
        throw new Error("Backend session belum aktif. Sign in ke backend dulu.");
      }

      return account as Address;
    }

    async function readAvailableBalance(address: Address) {
      const value = await readContract(wagmiConfig, {
        address: GAME_VAULT_ADDRESS as Address,
        abi: GAME_VAULT_ABI,
        functionName: "availableBalanceOf",
        args: [address],
      });

      return toNumberAmount(value);
    }

    async function writeAndConfirm(request: Parameters<typeof writeContract>[1]) {
      const txHash = await writeContract(wagmiConfig, request);
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash as Hash });
      return txHash as string;
    }

    window.__CHICKEN_MONAD_BRIDGE__ = {
      backgroundMode: false,
      loadAvailableBalance: async () => {
        if (!account || !isAddress(account) || !hasGameContractConfig()) {
          return 0;
        }

        await refreshBackendSession();
        return readAvailableBalance(account as Address);
      },
      openDeposit: (presetAmount?: number) => {
        const target = Number.isFinite(presetAmount)
          ? `/deposit?amount=${encodeURIComponent(String(presetAmount))}`
          : "/deposit";
        window.location.href = target;
      },
      startBet: async (stake: number) => {
        const playerAddress = await requireReadyWallet();
        const socket = ensureSocket();
        await waitForSocketReady(socket);

        const pendingStart = createPendingRequest(pendingStartRef);
        socket.emit("game:start", { stake });

        let payload: StartedPayload;
        try {
          payload = await pendingStart;
        } catch (error) {
          throw new Error(normalizeError(error, "Gagal memulai game di backend."));
        }

        try {
          const txHash = await writeAndConfirm({
            address: GAME_SETTLEMENT_ADDRESS as Address,
            abi: GAME_SETTLEMENT_ABI,
            functionName: "startSession",
            args: [payload.onchainSessionId as `0x${string}`, BigInt(payload.stakeAmountUnits)],
          });

          activeSessionIdRef.current = payload.sessionId;
          return {
            sessionId: payload.sessionId,
            onchainSessionId: payload.onchainSessionId,
            stake,
            availableBalance: await readAvailableBalance(playerAddress),
            txHash,
          };
        } catch (error) {
          socket.emit("game:abort_start", { sessionId: payload.sessionId });
          throw new Error(normalizeError(error, "Transaksi startSession gagal."));
        }
      },
      sendMove: (direction: string) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return;
        socket.emit("game:move", { direction });
      },
      cashOut: async () => {
        const playerAddress = await requireReadyWallet();
        const socket = ensureSocket();
        await waitForSocketReady(socket);

        const pendingCashout = createPendingRequest(pendingCashoutRef);
        socket.emit("game:cashout");

        const payload = await pendingCashout;
        const resolution = payload.resolution || payload.payload;
        const signature = payload.settlementSignature || payload.signature;
        if (!resolution || !signature) {
          throw new Error("Payload settlement dari backend tidak lengkap.");
        }

        const txHash = await writeAndConfirm({
          address: GAME_SETTLEMENT_ADDRESS as Address,
          abi: GAME_SETTLEMENT_ABI,
          functionName: "settleWithSignature",
          args: [resolution, signature as `0x${string}`],
        });

        await backendPost<{ success: boolean }>("/api/game/clear-settlement", {
          sessionId: payload.sessionId,
          txHash,
        });

        activeSessionIdRef.current = "";
        return {
          sessionId: payload.sessionId,
          onchainSessionId: payload.onchainSessionId,
          availableBalance: await readAvailableBalance(playerAddress),
          txHash,
          resolution,
          signature,
          multiplier: Number(payload.multiplier || "0"),
          payoutAmount: Number(payload.payoutAmount || "0"),
          profit: Number(payload.profit || "0"),
          reason: payload.reason,
        };
      },
      crash: async (reason?: string) => {
        const playerAddress = await requireReadyWallet();
        const socket = ensureSocket();
        await waitForSocketReady(socket);

        const pendingCrash = createPendingRequest(pendingCrashRef);
        socket.emit("game:crash", { reason });

        const payload = await pendingCrash;
        const resolution = payload.resolution || payload.payload;
        const signature = payload.settlementSignature || payload.signature;

        activeSessionIdRef.current = "";

        if (!resolution || !signature) {
          return null;
        }

        const txHash = await writeAndConfirm({
          address: GAME_SETTLEMENT_ADDRESS as Address,
          abi: GAME_SETTLEMENT_ABI,
          functionName: "settleWithSignature",
          args: [resolution, signature as `0x${string}`],
        });

        await backendPost<{ success: boolean }>("/api/game/clear-settlement", {
          sessionId: payload.sessionId,
          txHash,
        });

        return {
          sessionId: payload.sessionId,
          onchainSessionId: payload.onchainSessionId,
          availableBalance: await readAvailableBalance(playerAddress),
          txHash,
          resolution,
          signature,
          multiplier: Number(payload.multiplier || "0"),
          payoutAmount: Number(payload.payoutAmount || "0"),
          profit: Number(payload.profit || "0"),
          reason: payload.reason,
        };
      },
    };

    return () => {
      pendingStartRef.current = null;
      pendingCashoutRef.current = null;
      pendingCrashRef.current = null;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      delete window.__CHICKEN_MONAD_BRIDGE__;
    };
  }, [
    account,
    backgroundMode,
    ensureBackendSession,
    hasBackendConfig,
    isMonadChain,
    refreshBackendSession,
  ]);

  return null;
}
