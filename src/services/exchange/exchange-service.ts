import { and, eq, sql } from 'drizzle-orm'

import type {
  ConfirmPaymentPayload,
  ParsedCreateExchangePayload,
} from '../shared/types'
import { pendingTxQueue } from '../shared/queue'
import { db } from '../../db'
import {
  balanceLedgers,
  deposits,
  depositWallets,
  disbursements,
  networks,
  userBalances,
} from '../../db/schema'
import { parseUnits } from 'viem'
import { calculateQuote } from '../rates/calculate-quote'
import { publishWsEvent } from '../shared/ws-events'
import { getOrCreateStaticWallet } from '../wallet/get-or-create-static-wallet'

function createPendingTxHash() {
  return `pending:${crypto.randomUUID()}`
}

function generateQrValue(
  walletAddress: string,
  networkKey: string,
) {
  if (networkKey === 'solana') {
    return `solana:${walletAddress}`
  }
  
  if (networkKey === 'tron') {
    return `tron:${walletAddress}`
  }
  
  // Return raw address for EVM chains to ensure maximum wallet compatibility
  // when scanning for a simple address copy
  return walletAddress
}

export async function createExchange(payload: ParsedCreateExchangePayload) {
  const [networkInfo] = await db
    .select()
    .from(networks)
    .where(and(eq(networks.token, payload.token), eq(networks.id, payload.network)))
    .limit(1)

  if (!networkInfo) {
    throw new Error(`Network ${payload.network} not found for token ${payload.token}`)
  }

  const wallet = await getOrCreateStaticWallet(payload.userId, networkInfo.id)
  const quote = await calculateQuote(payload.token, payload.amount)
  const creditDescription = `After your ${payload.token} deposit is confirmed, your balance will be credited ${quote.idrNet.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} IDR (after ${quote.feeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} IDR fee).`

  const [createdDeposit] = await db
    .insert(deposits)
    .values({
      userId: payload.userId,
      walletId: wallet.id,
      txHash: createPendingTxHash(),
      amount: payload.amount.toFixed(8),
      networkId: networkInfo.id,
      amountFee: quote.feeAmount.toFixed(8),
      status: 'pending',
    })
    .returning()


  // Enqueue blockchain watcher job
  await pendingTxQueue.add(
    'watch-deposit',
    {
      depositId: createdDeposit.id,
      userId: payload.userId,
      walletAddress: wallet.address,
      network: networkInfo.networkKey, // Send the key to the worker
      token: payload.token,
      amount: payload.amount.toFixed(8),
      createdAt: createdDeposit.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    {
      jobId: `watch-${createdDeposit.id}`,
    },
  )

  let qrCodeValue = wallet.address
  qrCodeValue = generateQrValue(
    wallet.address,
    networkInfo.networkKey,
  )

  return {
    exchangeId: createdDeposit.id,
    status: createdDeposit.status,
    userId: createdDeposit.userId,
    token: payload.token,
    network: payload.network,
    sendAmount: payload.amount,
    referenceId: payload.referenceId,
    walletAddress: wallet.address,
    qrValue: qrCodeValue,
    quote,
    estimatedCreditIdr: quote.idrNet,
    creditDescription,
    createdAt: createdDeposit.createdAt,
  }
}

export async function getExchangeStatus(exchangeId: string) {
  const [deposit] = await db
    .select({
      id: deposits.id,
      userId: deposits.userId,
      txHash: deposits.txHash,
      amount: deposits.amount,
      networkId: deposits.networkId,
      status: deposits.status,
      createdAt: deposits.createdAt,
      settledAt: deposits.settledAt,
      walletAddress: depositWallets.address,
    })
    .from(deposits)
    .leftJoin(depositWallets, eq(depositWallets.id, deposits.walletId))
    .where(eq(deposits.id, exchangeId))
    .limit(1)

  if (!deposit) {
    return null
  }

  const payoutRows = await db
    .select()
    .from(disbursements)
    .where(eq(disbursements.depositId, exchangeId))

  const [balance] = await db
    .select({
      balanceIdr: userBalances.balanceIdr,
      updatedAt: userBalances.updatedAt,
    })
    .from(userBalances)
    .where(eq(userBalances.userId, deposit.userId))
    .limit(1)

  return {
    exchangeId: deposit.id,
    userId: deposit.userId,
    txHash: deposit.txHash,
    amount: Number(deposit.amount),
    network: deposit.networkId, // Return the networkId
    walletAddress: deposit.walletAddress,
    status: deposit.status,
    settledAt: deposit.settledAt,
    createdAt: deposit.createdAt,
    balanceIdr: balance ? Number(balance.balanceIdr) : 0,
    balanceUpdatedAt: balance?.updatedAt ?? null,
    credits: payoutRows.map((item) => ({
      id: item.id,
      type: item.type,
      amount: Number(item.amount),
      toAddress: item.toAddress,
      txHash: item.txHash,
      createdAt: item.createdAt,
    })),
  }
}

export async function confirmPayment(payload: ConfirmPaymentPayload) {
  const [exchange] = await db
    .select({
      id: deposits.id,
      userId: deposits.userId,
      amount: deposits.amount,
      status: deposits.status,
      networkId: deposits.networkId,
    })
    .from(deposits)
    .where(eq(deposits.id, payload.exchangeId))
    .limit(1)

  if (!exchange) {
    return {
      ok: false,
      reason: 'EXCHANGE_NOT_FOUND' as const,
    }
  }

  if (exchange.status !== 'pending') {
    const [balance] = await db
      .select({ balanceIdr: userBalances.balanceIdr })
      .from(userBalances)
      .where(eq(userBalances.userId, exchange.userId))
      .limit(1)

    return {
      ok: true,
      idempotent: true,
      exchangeId: exchange.id,
      status: exchange.status,
      userBalanceIdr: balance ? Number(balance.balanceIdr) : 0,
    }
  }

  const settledAmount = payload.amount ?? Number(exchange.amount)
  const quote = await calculateQuote(payload.token ?? 'USDC', settledAmount)

  const idrCredit = quote.idrNet.toFixed(2)
  const idrFee = quote.feeAmount.toFixed(2)

  const { userBalanceIdr } = await db.transaction(async (tx) => {
    const [processingDeposit] = await tx
      .update(deposits)
      .set({
        status: 'processing',
        txHash: payload.txHash,
      })
      .where(and(eq(deposits.id, exchange.id), eq(deposits.status, 'pending')))
      .returning({ id: deposits.id })

    if (!processingDeposit) {
      const [currentBalance] = await tx
        .select({ balanceIdr: userBalances.balanceIdr })
        .from(userBalances)
        .where(eq(userBalances.userId, exchange.userId))
        .limit(1)

      return {
        userBalanceIdr: currentBalance ? Number(currentBalance.balanceIdr) : 0,
      }
    }

    await tx.insert(disbursements).values([
      {
        depositId: exchange.id,
        toAddress: exchange.userId,
        amount: idrCredit,
        txHash: payload.txHash,
        type: 'platform',
      },
      {
        depositId: exchange.id,
        toAddress: 'platform-fee-vault',
        amount: idrFee,
        txHash: payload.txHash,
        type: 'fee',
      },
    ])

    await tx
      .insert(userBalances)
      .values({
        userId: exchange.userId,
        balanceIdr: idrCredit,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userBalances.userId,
        set: {
          balanceIdr: sql`${userBalances.balanceIdr} + ${idrCredit}`,
          updatedAt: new Date(),
        },
      })

    await tx.insert(balanceLedgers).values({
      userId: exchange.userId,
      depositId: exchange.id,
      amountIdr: idrCredit,
      type: 'deposit_credit',
      description: `Credit from crypto deposit ${exchange.id}`,
    })

    await tx
      .update(deposits)
      .set({
        status: 'settled',
        settledAt: new Date(),
      })
      .where(and(eq(deposits.id, exchange.id), eq(deposits.status, 'processing')))

    const [updatedBalance] = await tx
      .select({ balanceIdr: userBalances.balanceIdr })
      .from(userBalances)
      .where(eq(userBalances.userId, exchange.userId))
      .limit(1)

    return {
      userBalanceIdr: updatedBalance ? Number(updatedBalance.balanceIdr) : 0,
    }
  })

  const result = {
    ok: true,
    exchangeId: exchange.id,
    status: 'settled' as const,
    txHash: payload.txHash,
    creditedIdr: quote.idrNet,
    feeIdr: quote.feeAmount,
    userBalanceIdr,
  }

  await Promise.all([
    publishWsEvent(`deposit:${payload.txHash}`, {
      event: 'deposit:settled',
      data: result,
    }),
    publishWsEvent(`user:${exchange.userId}`, {
      event: 'balance:updated',
      data: {
        userId: exchange.userId,
        balanceIdr: userBalanceIdr,
      },
    }),
  ])

  return result
}
