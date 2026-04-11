import { and, eq } from 'drizzle-orm'

import type { SupportedNetwork } from '../shared/types'
import { db } from '../../db'
import { depositWallets } from '../../db/schema'
import { createWalletForUser } from './create-wallet'

export async function getOrCreateStaticWallet(
  userId: string,
  networkId: string,
) {
  const [existingWallet] = await db
    .select()
    .from(depositWallets)
    .where(and(eq(depositWallets.userId, userId), eq(depositWallets.networkId, networkId)))
    .limit(1)

  if (existingWallet) {
    return {
      id: existingWallet.id,
      address: existingWallet.address,
      privateKey: existingWallet.privateKey,
      networkId: existingWallet.networkId,
    }
  }

  const wallet = createWalletForUser(userId, networkId as SupportedNetwork)

  const [createdWallet] = await db
    .insert(depositWallets)
    .values({
      userId,
      networkId,
      address: wallet.address,
      privateKey: wallet.privateKey,
    })
    .returning()

  return {
    id: createdWallet.id,
    address: createdWallet.address,
    privateKey: createdWallet.privateKey,
    networkId: createdWallet.networkId,
  }
}
