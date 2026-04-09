import type { SupportedToken } from '../shared/types'

const TOKEN_BASE_RATE_IDR: Record<SupportedToken, number> = {
  USDC: 15295,
  USDT: 15282,
}

export async function getLiveRate(token: SupportedToken): Promise<number> {
  return TOKEN_BASE_RATE_IDR[token]
}
