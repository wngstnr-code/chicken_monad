type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type MonadChainConfig = {
  chainIdHex: string;
  chainIdDecimal: number;
  chainName: string;
  nativeCurrency: NativeCurrency;
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

function splitList(rawValue: string) {
  if (!rawValue) return [];
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseChainIdDecimal(chainIdHex: string) {
  if (!chainIdHex) return 0;
  const parsed = Number.parseInt(chainIdHex, 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

const chainIdHex = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "";
const chainName = process.env.NEXT_PUBLIC_MONAD_CHAIN_NAME || "Monad";
const nativeCurrencyName = process.env.NEXT_PUBLIC_MONAD_NATIVE_NAME || "MON";
const nativeCurrencySymbol = process.env.NEXT_PUBLIC_MONAD_NATIVE_SYMBOL || "MON";
const nativeCurrencyDecimals = Number(process.env.NEXT_PUBLIC_MONAD_NATIVE_DECIMALS || "18");
const rpcUrls = splitList(process.env.NEXT_PUBLIC_MONAD_RPC_URLS || "");
const blockExplorerUrls = splitList(process.env.NEXT_PUBLIC_MONAD_EXPLORER_URLS || "");

export const MONAD_CHAIN: MonadChainConfig = {
  chainIdHex,
  chainIdDecimal: parseChainIdDecimal(chainIdHex),
  chainName,
  nativeCurrency: {
    name: nativeCurrencyName,
    symbol: nativeCurrencySymbol,
    decimals: Number.isFinite(nativeCurrencyDecimals) ? nativeCurrencyDecimals : 18,
  },
  rpcUrls,
  blockExplorerUrls,
};

export function hasMonadChainConfig() {
  return Boolean(
    MONAD_CHAIN.chainIdHex &&
      MONAD_CHAIN.chainIdDecimal > 0 &&
      MONAD_CHAIN.chainName &&
      MONAD_CHAIN.rpcUrls.length > 0 &&
      MONAD_CHAIN.nativeCurrency.symbol
  );
}

export function explorerTxUrl(hash: string) {
  if (!hash) return "";
  const baseUrl = MONAD_CHAIN.blockExplorerUrls[0];
  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/+$/, "")}/tx/${hash}`;
}
