import { type Abi, type Chain, defineChain, parseAbiItem } from 'viem'
import { base, mainnet, bsc, polygon, arbitrum, optimism, avalanche } from 'viem/chains'

// ── Types ────────────────────────────────────────────────────────────────────

export type ChainEntry = {
  chainId: number
  rpcUrl: string
  blockExplorer: string
  chain: Chain
  tokens: Record<string, `0x${string}`>
}

// ── ERC-20 Transfer event ABI ────────────────────────────────────────────────

export const ERC20_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const satisfies Abi

// ── Multicall3 ───────────────────────────────────────────────────────────────

/** Multicall3 is deployed at the same address on all EVM chains */
export const MULTICALL3_ADDRESS: `0x${string}` = '0xcA11bde05977b3631167028862bE2a173976CA11'

export const MULTICALL3_ABI = [
  {
    name: 'aggregate3',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const satisfies Abi

// ── Chain registry (testnets) ────────────────────────────────────────────────

// ── Testnet chain definitions ────────────────────────────────────────────────

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
})

const sepolia = defineChain({
  id: 11155111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ETH_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
})

const arbSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARB_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' },
  },
  testnet: true,
})

const opSepolia = defineChain({
  id: 11155420,
  name: 'OP Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.OP_SEPOLIA_RPC_URL ?? 'https://sepolia.optimism.io'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia-optimism.etherscan.io' },
  },
  testnet: true,
})

// ── Chain registry ───────────────────────────────────────────────────────────

const CHAIN_REGISTRY: Record<string, ChainEntry> = {
  // --- TESTNETS ---
  base_sepolia: {
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    chain: baseSepolia,
    tokens: {
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
  ethereum_sepolia: {
    chainId: 11155111,
    rpcUrl: process.env.ETH_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    chain: sepolia,
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },
  arbitrum_sepolia: {
    chainId: 421614,
    rpcUrl: process.env.ARB_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    chain: arbSepolia,
    tokens: {
      USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
  },
  optimism_sepolia: {
    chainId: 11155420,
    rpcUrl: process.env.OP_SEPOLIA_RPC_URL ?? 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    chain: opSepolia,
    tokens: {
      USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    },
  },

  // --- MAINNETS ---
  base: {
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    chain: base,
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
  ethereum: {
    chainId: 1,
    rpcUrl: process.env.ETH_RPC_URL ?? 'https://cloudflare-eth.com',
    blockExplorer: 'https://etherscan.io',
    chain: mainnet,
    tokens: {
      USDC: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  bsc: {
    chainId: 56,
    rpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    chain: bsc,
    tokens: {
      USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      USDT: '0x55d398326f99059ff775485246999027b3197955',
    },
  },
  polygon: {
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    chain: polygon,
    tokens: {
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AaCBaEACF5C',
    },
  },
  arbitrum: {
    chainId: 42161,
    rpcUrl: process.env.ARB_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    chain: arbitrum,
    tokens: {
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    },
  },
  optimism: {
    chainId: 10,
    rpcUrl: process.env.OP_RPC_URL ?? 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    chain: optimism,
    tokens: {
      USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    },
  },
  avalanche: {
    chainId: 43114,
    rpcUrl: process.env.AVAX_RPC_URL ?? 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
    chain: avalanche,
    tokens: {
      USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve chain config for a given network key.
 * Throws if the network is not supported.
 */
export function getChainConfig(networkKey: string): ChainEntry {
  const entry = CHAIN_REGISTRY[networkKey]
  if (!entry) {
    throw new Error(
      `UNSUPPORTED_NETWORK: "${networkKey}" is not in the chain registry. ` +
        `Supported: ${Object.keys(CHAIN_REGISTRY).join(', ')}`,
    )
  }
  return entry
}

/**
 * Get the ERC-20 contract address for a token on a given network.
 * Returns null if the token isn't available on that network.
 */
export function getTokenAddress(
  networkKey: string,
  token: string,
): `0x${string}` | null {
  const chain = CHAIN_REGISTRY[networkKey]
  if (!chain) return null
  return chain.tokens[token] ?? null
}
