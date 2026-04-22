export const USDC_DECIMALS = 6;

export const USDC_ADDRESS: string = process.env.NEXT_PUBLIC_USDC_ADDRESS || "";
export const GAME_VAULT_ADDRESS: string = process.env.NEXT_PUBLIC_GAME_VAULT_ADDRESS || "";

export function hasDepositContractConfig() {
  return Boolean(USDC_ADDRESS && GAME_VAULT_ADDRESS);
}
