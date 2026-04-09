import { getAddress, keccak256, toBytes, toHex } from 'viem'

import type { SupportedNetwork } from '../shared/types'

export type WalletResult = {
  address: `0x${string}`
  derivationIndex: number
  network: SupportedNetwork
}

const MAX_U32 = 2 ** 32

export function createWalletForUser(
  userId: string,
  network: SupportedNetwork,
): WalletResult {
  const seedHex = keccak256(toHex(`${userId}:${network}`))
  const seedBytes = toBytes(seedHex)

  const addressHex = `0x${Buffer.from(seedBytes.slice(0, 20)).toString('hex')}`
  const derivationIndexBytes = Buffer.from(seedBytes.slice(20, 24))
  const derivationIndex = derivationIndexBytes.readUInt32BE(0) % MAX_U32

  return {
    address: getAddress(addressHex),
    derivationIndex,
    network,
  }
}
