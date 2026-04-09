import { getLiveRate } from './get-live-rate'
import type { QuoteResult, SupportedToken } from '../shared/types'

const DEFAULT_MARKUP_RATE = 0.0025
const DEFAULT_FEE_RATE = 0.01

const round2 = (value: number) => Math.round(value * 100) / 100

export async function calculateQuote(
  token: SupportedToken,
  amount: number,
): Promise<QuoteResult> {
  const baseRate = await getLiveRate(token)
  const markupRate = baseRate * DEFAULT_MARKUP_RATE
  const finalRate = baseRate + markupRate

  const idrGross = amount * finalRate
  const feeAmount = idrGross * DEFAULT_FEE_RATE
  const idrNet = idrGross - feeAmount

  return {
    baseRate: round2(baseRate),
    markupRate: round2(markupRate),
    finalRate: round2(finalRate),
    idrGross: round2(idrGross),
    feeRate: DEFAULT_FEE_RATE,
    feeAmount: round2(feeAmount),
    idrNet: round2(idrNet),
  }
}
