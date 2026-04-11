import { encodeFunctionData, parseUnits } from "viem";
import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { depositWallets, networks } from "../../db/schema";
import { ERC20_ABI, getChainConfig, getTokenAddress } from "../shared/chain-config";
import { type NetworkKey, getSponsoredBundlerClient } from "./sponsored-bundler";

export type WithdrawParams = {
  /** Platform user id – used to look up the smart wallet record */
  userId: string;
  /** Network db-id (e.g. the UUID stored in the networks table) */
  networkId: string;
  /** ERC-20 token symbol, e.g. "USDC" */
  token: string;
  /** Human-readable amount (e.g. 10.5 for 10.50 USDC) */
  amount: number;
  /** Recipient address */
  to: `0x${string}`;
};

export type WithdrawResult =
  | { ok: true; userOpHash: `0x${string}`; txHash: `0x${string}` }
  | { ok: false; reason: string };

/**
 * Withdraw USDC (or any ERC-20) from a user's Coinbase Smart Wallet using
 * a Pimlico bundler + paymaster so the user pays zero ETH for gas.
 *
 * Flow:
 *  1. Load the wallet record (private key + smart wallet address) from DB.
 *  2. Determine the network key so we can resolve the correct RPC and token address.
 *  3. Build a sponsored BundlerClient.
 *  4. Encode an ERC-20 `transfer(to, amount)` call.
 *  5. Send the UserOperation and wait for receipt.
 */
export async function withdrawFromSmartWallet(
  params: WithdrawParams,
): Promise<WithdrawResult> {
  const { userId, networkId, token, amount, to } = params;

  // ── 1. Load wallet from DB ────────────────────────────────────────────────
  const [walletRow] = await db
    .select({
      privateKey: depositWallets.privateKey,
      smartWallet: depositWallets.smartWallet,
      networkId: depositWallets.networkId,
    })
    .from(depositWallets)
    .where(
      and(
        eq(depositWallets.userId, userId),
        eq(depositWallets.networkId, networkId),
      ),
    )
    .limit(1);

  if (!walletRow) {
    return { ok: false, reason: "WALLET_NOT_FOUND" };
  }

  if (!walletRow.smartWallet) {
    return { ok: false, reason: "NO_SMART_WALLET_FOR_NETWORK" };
  }

  // ── 2. Resolve network key ────────────────────────────────────────────────
  const [networkRow] = await db
    .select({ networkKey: networks.networkKey })
    .from(networks)
    .where(eq(networks.id, networkId))
    .limit(1);

  if (!networkRow) {
    return { ok: false, reason: "NETWORK_NOT_FOUND" };
  }

  const networkKey = networkRow.networkKey;

  // Only Base and Base Sepolia smart wallets are supported (Coinbase Smart Account)
  if (networkKey !== "base" && networkKey !== "base_sepolia") {
    return {
      ok: false,
      reason: `UNSUPPORTED_NETWORK_FOR_SMART_WALLET: ${networkKey}`,
    };
  }

  // ── 3. Resolve token contract address ────────────────────────────────────
  const tokenAddress = getTokenAddress(networkKey, token.toUpperCase());
  if (!tokenAddress) {
    return {
      ok: false,
      reason: `TOKEN_NOT_FOUND_ON_NETWORK: ${token} on ${networkKey}`,
    };
  }

  // ── 4. Determine decimals (USDC = 6, most ERC-20 = 18) ───────────────────
  // Rather than doing an on-chain call we use the known value for USDC.
  // Extend this map if you add more tokens.
  const DECIMALS_MAP: Record<string, number> = { USDC: 6, USDT: 6 };
  const decimals = DECIMALS_MAP[token.toUpperCase()] ?? 18;
  const amountWei = parseUnits(String(amount), decimals);

  // ── 5. Build sponsored bundler client ────────────────────────────────────
  const { bundlerClient } = await getSponsoredBundlerClient(
    walletRow.privateKey as `0x${string}`,
    networkKey as NetworkKey,
  );

  // ── 6. Encode ERC-20 transfer calldata ───────────────────────────────────
  const callData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amountWei],
  });

  // ── 7. Send UserOperation via bundler (gas sponsored by paymaster) ────────
  try {
    const userOpHash = await bundlerClient.sendUserOperation({
      calls: [
        {
          to: tokenAddress,
          data: callData,
          value: BigInt(0),
        },
      ],
    });

    // Wait for the UserOp to be included in a block
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    return {
      ok: true,
      userOpHash,
      txHash: receipt.receipt.transactionHash,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `BUNDLER_ERROR: ${message}` };
  }
}
