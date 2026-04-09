import { and, eq, inArray } from 'drizzle-orm'

import { db } from './index'
import { networks } from './schema'

const NETWORK_SEEDS = [
  { token: 'USDC', networkKey: 'base', networkName: 'Base', iconKey: 'NetworkBase' },
  { token: 'USDC', networkKey: 'ethereum', networkName: 'Ethereum', iconKey: 'NetworkEthereum' },
  { token: 'USDC', networkKey: 'bsc', networkName: 'BNB Smart Chain', iconKey: 'NetworkBinanceSmartChain' },
  { token: 'USDC', networkKey: 'polygon', networkName: 'Polygon', iconKey: 'NetworkPolygon' },
  { token: 'USDC', networkKey: 'arbitrum', networkName: 'Arbitrum One', iconKey: 'NetworkArbitrumOne' },
  { token: 'USDC', networkKey: 'optimism', networkName: 'Optimism', iconKey: 'NetworkOptimism' },
  { token: 'USDC', networkKey: 'avalanche', networkName: 'Avalanche', iconKey: 'NetworkAvalanche' },
  { token: 'USDC', networkKey: 'solana', networkName: 'Solana', iconKey: 'NetworkSolana' },
  { token: 'USDT', networkKey: 'ethereum', networkName: 'Ethereum', iconKey: 'NetworkEthereum' },
  { token: 'USDT', networkKey: 'bsc', networkName: 'BNB Smart Chain', iconKey: 'NetworkBinanceSmartChain' },
  { token: 'USDT', networkKey: 'polygon', networkName: 'Polygon', iconKey: 'NetworkPolygon' },
  { token: 'USDT', networkKey: 'arbitrum', networkName: 'Arbitrum One', iconKey: 'NetworkArbitrumOne' },
  { token: 'USDT', networkKey: 'optimism', networkName: 'Optimism', iconKey: 'NetworkOptimism' },
  { token: 'USDT', networkKey: 'tron', networkName: 'Tron', iconKey: 'NetworkTron' },
  { token: 'USDT', networkKey: 'solana', networkName: 'Solana', iconKey: 'NetworkSolana' },
] as const

async function seedNetworks() {
  await db
    .delete(networks)
    .where(and(inArray(networks.token, ['USDC', 'USDT']), eq(networks.isActive, true)))

  await db.insert(networks).values(
    NETWORK_SEEDS.map((item) => ({
      token: item.token,
      networkKey: item.networkKey,
      networkName: item.networkName,
      iconKey: item.iconKey,
      isActive: true,
    })),
  )
}

seedNetworks()
  .then(() => {
    console.log('Network seed completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Network seed failed', error)
    process.exit(1)
  })
