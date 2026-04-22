# 🐔 Chicken Monad — Backend

Off-chain game validator server untuk Chicken Monad (Crossy Chicken on Monad Blockchain).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Backend Server                  │
├─────────────────────────────────────────────────┤
│  Express.js (REST API)  │  Socket.io (WebSocket) │
├─────────────────────────┼───────────────────────┤
│  /auth    → SIWE Login  │  game:start           │
│  /api/game → History    │  game:move            │
│  /api/leaderboard       │  game:crash           │
│  /api/player → Stats    │  game:cashout         │
├─────────────────────────┴───────────────────────┤
│  Game Validator │ Timer Authority │ Anti-Cheat   │
│  Signature Svc  │ Blockchain Listener            │
├─────────────────────────────────────────────────┤
│               Supabase (PostgreSQL)              │
│  players │ game_sessions │ transactions │ views  │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Setup Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials, Monad RPC, etc.
```

### 2. Setup Database

Copy the contents of `database/schema.sql` and paste it into the **Supabase SQL Editor**, then click **Run**.

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

Server runs at `http://localhost:3001` with hot-reload.

### 5. Production Build

```bash
npm run build
npm start
```

## API Reference

### Authentication

| Method | Endpoint       | Auth | Description                               |
| ------ | -------------- | ---- | ----------------------------------------- |
| GET    | `/auth/nonce`  | ❌   | Get SIWE nonce                            |
| POST   | `/auth/verify` | ❌   | Verify SIWE signature, set session cookie |
| POST   | `/auth/logout` | 🔒   | Clear session                             |
| GET    | `/auth/me`     | 🔒   | Check current session                     |

### Game

| Method | Endpoint                  | Auth | Description               |
| ------ | ------------------------- | ---- | ------------------------- |
| GET    | `/api/game/active`        | 🔒   | Check for active session  |
| GET    | `/api/game/pending-settlement` | 🔒   | Get pending onchain settlements |
| GET    | `/api/game/history`            | 🔒   | Game history                    |
| POST   | `/api/game/clear-settlement`   | 🔒   | Mark settlement tx as processed |

### Leaderboard

| Method | Endpoint                  | Auth | Description         |
| ------ | ------------------------- | ---- | ------------------- |
| GET    | `/api/leaderboard`        | ❌   | Top 100 by distance |
| GET    | `/api/leaderboard/profit` | ❌   | Top 100 by profit   |

### Player

| Method | Endpoint                   | Auth | Description           |
| ------ | -------------------------- | ---- | --------------------- |
| GET    | `/api/player/stats`        | 🔒   | Player statistics     |
| GET    | `/api/player/transactions` | 🔒   | Blockchain tx history |

### WebSocket Events

| Direction | Event                 | Description                                  |
| --------- | --------------------- | -------------------------------------------- | ---------- | ------ | ---------- |
| C→S       | `game:start`          | Start new game `{ stake: number }`           |
| C→S       | `game:move`           | Player movement `{ direction: "forward"      | "backward" | "left" | "right" }` |
| C→S       | `game:crash`          | Client reports collision                     |
| C→S       | `game:cashout`        | Request cash out at checkpoint               |
| S→C       | `game:started`        | Game started `{ sessionId, onchainSessionId, stake, stakeAmountUnits, mapSeed }` |
| S→C       | `game:state`          | State update after move                      |
| S→C       | `game:crashed`        | Game over (crash)                            |
| S→C       | `game:cashout_result` | Settlement signature + resolution payload    |
| S→C       | `game:reconnected`    | Sync state after reconnect                   |
| S→C       | `game:cp_expired`     | Checkpoint stay time expired                 |
| S→C       | `game:error`          | Error message                                |

## Game Math

- **Multiplier starts at**: `0.00x`
- **Per forward step**: `+0.025x`
- **Checkpoint every**: `40 steps` (bonus `×1.2`)
- **Segment timer**: `60 seconds` between CPs
- **Overtime decay**: `-0.1x per second`
- **CP stay limit**: `60 seconds`

## Environment Variables

| Variable                    | Required | Description                                            |
| --------------------------- | -------- | ------------------------------------------------------ |
| `PORT`                      | No       | Server port (default: 3001)                            |
| `FRONTEND_URL`              | No       | Frontend URL for CORS (default: http://localhost:3000) |
| `SESSION_SECRET`            | Yes      | Random string for session tokens                       |
| `SUPABASE_URL`              | Yes      | Supabase project URL                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key                              |
| `MONAD_RPC_URL`             | No       | Monad RPC endpoint                                     |
| `MONAD_CHAIN_ID`            | No       | Monad chain ID (default: 10143)                        |
| `GAME_VAULT_ADDRESS`        | No       | `GameVault` proxy address                              |
| `GAME_SETTLEMENT_ADDRESS`   | No       | `GameSettlement` proxy address                         |
| `BACKEND_PRIVATE_KEY`       | No       | Private key for signing settlement payloads            |
| `SETTLEMENT_SIGNATURE_TTL_SECONDS` | No | Settlement signature expiry in seconds (default: 86400) |
