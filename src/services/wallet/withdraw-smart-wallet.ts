import { and, eq, sql } from "drizzle-orm";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { db } from "../../db";
import { balanceLedgers, depositWallets, networks, userBalances } from "../../db/schema";
import { calculateQuote } from "../rates/calculate-quote";
import { ERC20_ABI, getChainConfig, getTokenAddress } from "../shared/chain-config";
import { type SupportedToken } from "../shared/types";
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
  | { ok: true; txHash: `0x${string}`; userOpHash?: `0x${string}` }
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

  const useSmartWallet = !!walletRow.smartWallet;

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
  const chainConfig = getChainConfig(networkKey);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Sponsored smart-wallet flow is only available on Base/Base Sepolia.
  // Other networks will fall back to a regular EOA transfer.
  const isSponsoredSmartWalletNetwork =
    networkKey === "base" || networkKey === "base_sepolia";

  // ── 3. Resolve token contract address ────────────────────────────────────
  const tokenAddress = getTokenAddress(networkKey, token.toUpperCase());
  if (!tokenAddress) {
    return {
      ok: false,
      reason: `TOKEN_NOT_FOUND_ON_NETWORK: ${token} on ${networkKey}`,
    };
  }

  // ── 4. Resolve token decimals on-chain to avoid network/token mismatches ─
  // (e.g. USDT has different decimals depending on chain/contract variant).
  let decimals: number;
  try {
    decimals = Number(
      await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `TOKEN_DECIMALS_READ_ERROR: ${message}` };
  }

  const amountWei = parseUnits(String(amount), decimals);

  // ── 4b. Calculate and pre-check fiat debit before broadcasting tx ────────
  const quote = await calculateQuote(token.toUpperCase() as SupportedToken, amount);
  const idrDebit = quote.idrNet.toFixed(2);

  const [currentBalance] = await db
    .select({ balanceIdr: userBalances.balanceIdr })
    .from(userBalances)
    .where(eq(userBalances.userId, userId))
    .limit(1);

  if (!currentBalance || Number(currentBalance.balanceIdr) < Number(idrDebit)) {
    return { ok: false, reason: "INSUFFICIENT_BALANCE_IDR_FOR_WITHDRAW" };
  }

  // ── 5a. Smart-wallet path (gas sponsored via bundler/paymaster) ───────────
  if (useSmartWallet && isSponsoredSmartWalletNetwork) {
    const { bundlerClient } = await getSponsoredBundlerClient(
      walletRow.privateKey as `0x${string}`,
      networkKey as NetworkKey,
    );

    const callData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amountWei],
    });

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

      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      const [updatedBalance] = await db
        .update(userBalances)
        .set({
          balanceIdr: sql`${userBalances.balanceIdr} - ${idrDebit}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userBalances.userId, userId),
            sql`${userBalances.balanceIdr} >= ${idrDebit}`,
          ),
        )
        .returning({ balanceIdr: userBalances.balanceIdr });

      if (!updatedBalance) {
        return { ok: false, reason: "BALANCE_DEBIT_CONFLICT_AFTER_TRANSFER" };
      }

      await db.insert(balanceLedgers).values({
        userId,
        amountIdr: `-${idrDebit}`,
        type: "withdraw_debit",
        description: `Wallet withdrawal debit (${token.toUpperCase()}) tx=${receipt.receipt.transactionHash}`,
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

  // ── 5b. EOA fallback – no smart wallet, withdraw directly from the deposit
  //        wallet (EOA). The caller must ensure the EOA has enough native token
  //        to cover gas, or that gas sponsorship is handled externally.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const account = privateKeyToAccount(walletRow.privateKey as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const txHash = await walletClient.writeContract({
      account,
      chain: chainConfig.chain,
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amountWei],
    });

    // Wait for the transaction to be mined
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const [updatedBalance] = await db
      .update(userBalances)
      .set({
        balanceIdr: sql`${userBalances.balanceIdr} - ${idrDebit}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userBalances.userId, userId),
          sql`${userBalances.balanceIdr} >= ${idrDebit}`,
        ),
      )
      .returning({ balanceIdr: userBalances.balanceIdr });

    if (!updatedBalance) {
      return { ok: false, reason: "BALANCE_DEBIT_CONFLICT_AFTER_TRANSFER" };
    }

    await db.insert(balanceLedgers).values({
      userId,
      amountIdr: `-${idrDebit}`,
      type: "withdraw_debit",
      description: `Wallet withdrawal debit (${token.toUpperCase()}) tx=${txHash}`,
    });

    return { ok: true, txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `EOA_TRANSFER_ERROR: ${message}` };
  }
}
