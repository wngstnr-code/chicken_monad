# Smart Contracts

Folder ini disiapkan untuk source contract, ABI, dan data deployment Monad.

Rencana umum:

1. `src/`: source Solidity.
2. `abi/`: ABI JSON untuk konsumsi frontend.
3. `deployments/`: address per network.
4. `scripts/`: deploy script.

Untuk tahap sekarang, frontend masih memakai config address dari env di `frontend/lib/web3/contracts.ts`.
