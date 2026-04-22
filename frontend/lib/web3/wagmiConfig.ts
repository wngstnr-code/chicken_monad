import type { Chain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { MONAD_CHAIN } from "./monad";

const FALLBACK_CHAIN_ID = 10143;
const FALLBACK_RPC_URL = "https://testnet-rpc.monad.xyz";

function buildMonadWagmiChain(): Chain {
  const chainId = MONAD_CHAIN.chainIdDecimal > 0 ? MONAD_CHAIN.chainIdDecimal : FALLBACK_CHAIN_ID;
  const rpcUrl = MONAD_CHAIN.rpcUrls[0] || FALLBACK_RPC_URL;
  const explorerUrl = MONAD_CHAIN.blockExplorerUrls[0] || "";

  return {
    id: chainId,
    name: MONAD_CHAIN.chainName || "Monad",
    nativeCurrency: {
      name: MONAD_CHAIN.nativeCurrency.name,
      symbol: MONAD_CHAIN.nativeCurrency.symbol,
      decimals: MONAD_CHAIN.nativeCurrency.decimals,
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    blockExplorers: explorerUrl
      ? {
          default: {
            name: "Monad Explorer",
            url: explorerUrl,
          },
        }
      : undefined,
    testnet: true,
  };
}

export const monadWagmiChain = buildMonadWagmiChain();

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [monadWagmiChain],
  connectors: [injected({ target: "rabby" })],
  transports: {
    [monadWagmiChain.id]: http(monadWagmiChain.rpcUrls.default.http[0]),
  },
});
