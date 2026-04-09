import { type Abi, type Chain, defineChain, parseAbiItem } from 'viem'

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
  base: {
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    chain: baseSepolia,
    tokens: {
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
  ethereum: {
    chainId: 11155111,
    rpcUrl: process.env.ETH_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    chain: sepolia,
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },
  arbitrum: {
    chainId: 421614,
    rpcUrl: process.env.ARB_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    chain: arbSepolia,
    tokens: {
      USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
  },
  optimism: {
    chainId: 11155420,
    rpcUrl: process.env.OP_SEPOLIA_RPC_URL ?? 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    chain: opSepolia,
    tokens: {
      USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
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
