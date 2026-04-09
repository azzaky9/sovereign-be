import { statusEnum } from '../../db/schema'

export const SUPPORTED_TOKENS = ['USDC', 'USDT'] as const

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number]
export type SupportedNetwork = string
export type ExchangeStatus = (typeof statusEnum.enumValues)[number]

export type NetworkCatalogItem = {
  id: string
  token: SupportedToken
  networkKey: string
  networkName: string
  iconKey: string
  isActive: boolean
  mode: string
}

export type QuoteResult = {
  baseRate: number
  markupRate: number
  finalRate: number
  idrGross: number
  feeRate: number
  feeAmount: number
  idrNet: number
}

export type ParsedCreateExchangePayload = {
  userId: string
  token: SupportedToken
  network: SupportedNetwork
  amount: number
  referenceId?: string
}

export type ConfirmPaymentPayload = {
  exchangeId: string
  txHash: string
  token?: SupportedToken
  amount?: number
}
