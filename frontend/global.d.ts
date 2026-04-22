declare module "*.css";

type ChickenBridgeSettlementResolution = {
  sessionId: string;
  player: string;
  stakeAmount: string;
  payoutAmount: string;
  finalMultiplierBp: string;
  outcome: number;
  deadline: string;
};

type ChickenBridgeStartResult = {
  sessionId: string;
  onchainSessionId: string;
  stake: number;
  availableBalance: number;
  txHash: string;
};

type ChickenBridgeSettlementResult = {
  sessionId: string;
  onchainSessionId: string;
  availableBalance: number;
  txHash: string;
  resolution: ChickenBridgeSettlementResolution;
  signature: string;
  multiplier: number;
  payoutAmount: number;
  profit: number;
  reason?: string;
};

type ChickenBridgeApi = {
  backgroundMode: boolean;
  loadAvailableBalance: () => Promise<number>;
  openDeposit: (presetAmount?: number) => void;
  startBet: (stake: number) => Promise<ChickenBridgeStartResult>;
  sendMove: (direction: string) => void;
  cashOut: () => Promise<ChickenBridgeSettlementResult>;
  crash: (reason?: string) => Promise<ChickenBridgeSettlementResult | null>;
};

interface Window {
  __CHICKEN_MONAD_BRIDGE__?: ChickenBridgeApi;
}
