import { and, eq } from 'drizzle-orm'

import type { SupportedNetwork } from '../shared/types'
import { db } from '../../db'
import { depositWallets } from '../../db/schema'
import { createWalletForUser } from './create-wallet'

export async function getOrCreateStaticWallet(
  userId: string,
  network: SupportedNetwork,
) {
  const [existingWallet] = await db
    .select()
    .from(depositWallets)
    .where(and(eq(depositWallets.userId, userId), eq(depositWallets.network, network)))
    .limit(1)

  if (existingWallet) {
    return {
      id: existingWallet.id,
      address: existingWallet.address,
      derivationIndex: Number(existingWallet.derivationIndex),
      network: existingWallet.network,
    }
  }

  const wallet = createWalletForUser(userId, network)

  const [createdWallet] = await db
    .insert(depositWallets)
    .values({
      userId,
      network,
      address: wallet.address,
      derivationIndex: wallet.derivationIndex.toString(),
    })
    .returning()

  return {
    id: createdWallet.id,
    address: createdWallet.address,
    derivationIndex: Number(createdWallet.derivationIndex),
    network: createdWallet.network,
  }
}
