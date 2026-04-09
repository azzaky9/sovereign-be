import { and, eq, inArray } from "drizzle-orm";

import { db } from "./index";
import { networks, TNetworks } from "./schema";

const NETWORK_SEEDS = [
  // =========================
  // USDC
  // =========================
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "base",
    networkName: "Base",
    iconKey: "NetworkBase",
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "ethereum",
    networkName: "Ethereum",
    iconKey: "NetworkEthereum",
    contractAddress: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "bsc",
    networkName: "BNB Smart Chain",
    iconKey: "NetworkBinanceSmartChain",
    contractAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    decimals: 18, // ⚠️ BSC version is bridged → 18
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "polygon",
    networkName: "Polygon",
    iconKey: "NetworkPolygon",
    contractAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "arbitrum",
    networkName: "Arbitrum One",
    iconKey: "NetworkArbitrumOne",
    contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "optimism",
    networkName: "Optimism",
    iconKey: "NetworkOptimism",
    contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "avalanche",
    networkName: "Avalanche",
    iconKey: "NetworkAvalanche",
    contractAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDC",
    networkKey: "solana",
    networkName: "Solana",
    iconKey: "NetworkSolana",
    contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },

  // =========================
  // USDT
  // =========================
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "ethereum",
    networkName: "Ethereum",
    iconKey: "NetworkEthereum",
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "bsc",
    networkName: "BNB Smart Chain",
    iconKey: "NetworkBinanceSmartChain",
    contractAddress: "0x55d398326f99059ff775485246999027b3197955",
    decimals: 18,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "polygon",
    networkName: "Polygon",
    iconKey: "NetworkPolygon",
    contractAddress: "0xc2132D05D31c914a87C6611C10748AaCBaEACF5C",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "arbitrum",
    networkName: "Arbitrum One",
    iconKey: "NetworkArbitrumOne",
    contractAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "optimism",
    networkName: "Optimism",
    iconKey: "NetworkOptimism",
    contractAddress: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "tron",
    networkName: "Tron",
    iconKey: "NetworkTron",
    contractAddress: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
    decimals: 6,
  },
  {
    mode: "mainnet",
    token: "USDT",
    networkKey: "solana",
    networkName: "Solana",
    iconKey: "NetworkSolana",
    contractAddress: "Es9vMFrzaCERZ7ZLhWcLr4H2UvepQP9en5ZaY1f3YkG",
    decimals: 6,
  },

  // =========================
  // TESTNET
  // =========================
  {
    mode: "testnet",
    token: "USDC",
    networkKey: "base",
    networkName: "Base",
    iconKey: "NetworkBase",
    contractAddress: "0x036CbD53842c5426634e7929541ec2318f3dCF7", // Base Sepolia USDC
    decimals: 6,
  },
] as const;

async function seedNetworks() {
  await db
    .delete(networks)
    .where(
      and(
        inArray(networks.token, ["USDC", "USDT"]),
        eq(networks.isActive, true),
      ),
    );

  await db.insert(networks).values(
    NETWORK_SEEDS.map((item) => ({
      token: item.token,
      networkKey: item.networkKey,
      networkName: item.networkName,
      iconKey: item.iconKey,
      isActive: true,
      mode: item.mode,
      contractAddress: item.contractAddress,
      decimal: item.decimals
    }) as TNetworks),
  );
}

seedNetworks()
  .then(() => {
    console.log("Network seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Network seed failed", error);
    process.exit(1);
  });
