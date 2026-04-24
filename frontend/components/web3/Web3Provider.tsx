"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import {
  appKitMetadata,
  appKitNetworks,
  monadWagmiChain,
  projectId,
} from "../../lib/web3/wagmiConfig";

const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
  ssr: true,
});

const appKitWindow = globalThis as typeof globalThis & {
  __CHICKEN_MONAD_APPKIT_INITIALIZED__?: boolean;
};

if (!appKitWindow.__CHICKEN_MONAD_APPKIT_INITIALIZED__) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: appKitNetworks,
    defaultNetwork: monadWagmiChain,
    projectId,
    metadata: appKitMetadata,
  });
  appKitWindow.__CHICKEN_MONAD_APPKIT_INITIALIZED__ = true;
}

type Web3ProviderProps = {
  children: ReactNode;
};

export function Web3Provider({ children }: Web3ProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
