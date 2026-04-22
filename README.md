# Chicken Monad

Repo ini sekarang dipisah berdasarkan domain kerja supaya lebih rapih saat scale untuk hackathon Monad:

- `frontend/`: Next.js app (UI, game, wallet flow).
- `backend/`: placeholder service API/off-chain logic.
- `smart-contracts/`: placeholder source contract, ABI, deployment data.

## Kenapa sebelumnya JSX?

Awalnya dipakai JSX karena tahap awal fokusnya cepat pindah dari HTML ke App Router tanpa nambah kompleksitas typing. Sekarang frontend sudah dimigrasi ke TSX/TS agar flow Web3 lebih aman dan maintainable.

## Menjalankan Frontend

1. Install dependencies:

```bash
npm install
```

2. Run dev:

```bash
npm run dev
```

3. Build:

```bash
npm run build
```

## Konfigurasi Frontend Env

Copy file:

```bash
frontend/.env.example -> frontend/.env.local
```

Isi minimal:

- `NEXT_PUBLIC_MONAD_CHAIN_ID`
- `NEXT_PUBLIC_MONAD_RPC_URLS`
- `NEXT_PUBLIC_MONAD_EXPLORER_URLS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_GAME_VAULT_ADDRESS`

## Struktur Frontend Penting

- `frontend/app/connect/page.tsx`: connect wallet + switch chain
- `frontend/app/deposit/page.tsx`: kerangka deposit USDC
- `frontend/app/play/page.tsx`: halaman game
- `frontend/components/game/GameCanvas.tsx`: komponen game
- `frontend/components/web3/WalletProvider.tsx`: global wallet state
- `frontend/lib/web3/*`: config chain dan contract
