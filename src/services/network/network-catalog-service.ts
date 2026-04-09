import { and, eq } from 'drizzle-orm'

import type { NetworkCatalogItem, SupportedToken } from '../shared/types'
import { db } from '../../db'
import { networks } from '../../db/schema'

export async function listActiveNetworksByToken(
  token: SupportedToken,
): Promise<NetworkCatalogItem[]> {
  const rows = await db
    .select({
      id: networks.id,
      token: networks.token,
      networkKey: networks.networkKey,
      networkName: networks.networkName,
      iconKey: networks.iconKey,
      isActive: networks.isActive,
      mode: networks.mode,
    })
    .from(networks)
    .where(and(eq(networks.token, token), eq(networks.isActive, true)))

  return rows as NetworkCatalogItem[]
}

export async function isNetworkActiveForToken(token: SupportedToken, networkId: string) {
  const [row] = await db
    .select({ id: networks.id })
    .from(networks)
    .where(
      and(
        eq(networks.token, token),
        eq(networks.id, networkId),
        eq(networks.isActive, true),
      ),
    )
    .limit(1)

  return Boolean(row)
}
