import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import type { SupportedNetwork } from '../shared/types'

export type WalletResult = {
  address: `0x${string}`
  privateKey: `0x${string}`
  network: SupportedNetwork
}

export function createWalletForUser(
  userId: string,
  network: SupportedNetwork,
): WalletResult {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  return {
    address: account.address,
    privateKey,
    network,
  }
}
