# Monad Game Contracts

Smart contract package ini menyiapkan flow backend-authoritative untuk game ayam di Monad testnet.
Semua kontrak deploy sebagai proxy UUPS (`ERC1967Proxy` + implementation terpisah):

- `GameUSDC`: mock USDC dengan 6 desimal
- `USDCFaucet`: faucet bootstrap dana testnet
- `GameVault`: custody layer dengan `available`, `locked`, dan `treasury`
- `GameSettlement`: session manager yang memverifikasi EIP-712 signature dari backend

## Contracts

### GameUSDC

- Name: `Mock USD Coin`
- Symbol: `USDC`
- Decimals: `6`
- Tidak ada initial supply
- Hanya address yang di-set sebagai minter yang bisa memanggil `mint`
- Upgradeable via UUPS, owner proxy berwenang melakukan upgrade

### USDCFaucet

- `claim()` mint `100 * 10^6` ke caller
- Tanpa cooldown
- Owner bisa `pause`, `unpause`, dan `setClaimAmount`
- Upgradeable via UUPS

### GameVault

- User melakukan `approve` ke vault lalu `deposit(amount)`
- Vault memisahkan saldo `availableBalance`, `lockedBalance`, dan `treasuryBalance`
- User hanya bisa `withdraw(amount)` dari `availableBalance`
- `fundTreasury(amount)` dipakai untuk bootstrap likuiditas payout
- Owner bisa `treasuryWithdraw(recipient, amount)` untuk menarik saldo treasury protokol
- Owner bisa `rescueToken(token, recipient, amount)` untuk menyelamatkan token nyasar; khusus `USDC`, hanya saldo berlebih yang tidak memback balance user/treasury yang bisa di-rescue
- Hanya `GameSettlement` yang boleh memanggil lock / settle stake
- Owner bisa `pause()` / `unpause()` untuk menghentikan deposit, treasury funding, dan operasi settlement di vault
- Upgradeable via UUPS

### GameSettlement

- `startSession(bytes32 onchainSessionId, uint256 stakeAmount)` mengunci stake dari vault
- Satu wallet hanya boleh punya satu session aktif
- `settleWithSignature(...)` memverifikasi payload EIP-712 dari backend
- `expireSession(bytes32 sessionId)` menutup sesi yang macet setelah timeout sebagai `CRASHED`
- Owner bisa `pause()` / `unpause()` untuk menghentikan start session dan settlement
- `sessionExpiryDelay` bisa dikonfigurasi owner
- Jika `CASHED_OUT`, payout masuk ke `availableBalance` internal user
- Jika `CRASHED`, stake masuk ke treasury
- Smart contract tidak menerima multiplier langsung dari client
- Upgradeable via UUPS

## Prerequisites

- Foundry terinstall
- RPC Monad testnet tersedia
- Private key deployer tersedia jika ingin broadcast deployment

## Environment

Tambahkan minimal env berikut di `sc/.env`:

```bash
MONAD_TESTNET_RPC_URL=https://your-monad-testnet-rpc
PRIVATE_KEY=your_private_key_without_0x
USDC_FAUCET_CLAIM_AMOUNT=100000000
BACKEND_SIGNER=0xyour_backend_signer_address
SESSION_EXPIRY_DELAY=86400
```

`USDC_FAUCET_CLAIM_AMOUNT` opsional. Default-nya `100000000` atau `100 USDC` dengan 6 desimal.
`BACKEND_SIGNER` opsional. Jika tidak diisi, deploy script memakai `INITIAL_OWNER`.
`SESSION_EXPIRY_DELAY` opsional. Default-nya `86400` detik atau `1 hari`.

## Commands

### Build

```bash
forge build
```

### Test

```bash
forge test --offline
```

### Format

```bash
forge fmt
```

## Deploy To Monad Testnet

Jika env sudah dimuat:

```bash
source .env
forge script script/DeployGameContracts.s.sol:DeployGameContracts --rpc-url "$MONAD_TESTNET_RPC_URL" --broadcast
```

Atau jika ingin tetap pakai argumen private key dari CLI:

```bash
forge script script/DeployGameContracts.s.sol:DeployGameContracts --rpc-url "$MONAD_TESTNET_RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
```

Script deploy akan:

- deploy implementation `GameUSDC`, `USDCFaucet`, `GameVault`, `GameSettlement`
- deploy proxy UUPS untuk masing-masing kontrak
- grant minter role dari token ke faucet
- set `GameSettlement` sebagai operator resmi di `GameVault`
- print alamat hasil deploy

Output penting untuk frontend:

```bash
NEXT_PUBLIC_USDC_ADDRESS=<deployed_game_usdc>
NEXT_PUBLIC_GAME_VAULT_ADDRESS=<deployed_game_vault>
NEXT_PUBLIC_GAME_SETTLEMENT_ADDRESS=<deployed_game_settlement>
```

Alamat yang dipakai frontend adalah alamat proxy, bukan implementation.

## Flow Backend-Authoritative

1. User `approve USDC` lalu `deposit(amount)` ke vault.
2. Backend membuat `onchain_session_id` untuk ronde game.
3. Frontend memanggil `GameSettlement.startSession(onchainSessionId, stakeAmount)`.
4. Backend memvalidasi hasil game offchain lalu menandatangani payload `Resolution` via EIP-712.
5. Frontend / keeper memanggil `settleWithSignature(...)`.
6. Jika cashout berhasil, payout masuk ke `availableBalance` internal user.
7. User bisa langsung memakai lagi seluruh `availableBalance` untuk ronde berikutnya, atau `withdraw(amount)` ke wallet kapan saja.
8. Jika sesi macet dan tidak pernah di-settle, siapa pun bisa memanggil `expireSession(...)` setelah timeout untuk menutup sesi sebagai crash.

## Frontend Wiring

- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_GAME_VAULT_ADDRESS`
- `NEXT_PUBLIC_GAME_SETTLEMENT_ADDRESS`

Frontend deposit dan game flow nantinya bisa memakai urutan:

1. `approve(USDC, GameVault, amount)`
2. `deposit(amount)`
3. `startSession(onchainSessionId, stakeAmount)`
4. `settleWithSignature(resolution, signature)`
5. `withdraw(amount)`
