import { Worker } from 'bullmq'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseUnits,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { confirmPayment } from '../services/exchange/exchange-service'
import {
  ERC20_ABI,
  ERC20_TRANSFER_EVENT,
  getChainConfig,
  getTokenAddress,
} from '../services/shared/chain-config'
import {
  PENDING_TX_QUEUE,
  getRedisConnection,
  type PendingTxJobData,
} from '../services/shared/queue'
import { publishWsEvent } from '../services/shared/ws-events'

// ── Config ───────────────────────────────────────────────────────────────────

const WATCH_TIMEOUT_MS = Number(process.env.WATCH_TIMEOUT_MS) || 10 * 60 * 1000 // 10 min
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5_000 // 5s

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY as `0x${string}` | undefined
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS as `0x${string}` | undefined
const FEE_VAULT_ADDRESS = process.env.FEE_VAULT_ADDRESS as `0x${string}` | undefined

// Fee split mirrors the existing quote logic (1% fee)
const FEE_RATE = 0.01

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(jobId: string | undefined, ...args: unknown[]) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] [pending-tx] [${jobId ?? 'worker'}]`, ...args)
}

function logError(jobId: string | undefined, ...args: unknown[]) {
  const ts = new Date().toISOString()
  console.error(`[${ts}] [pending-tx] [${jobId ?? 'worker'}]`, ...args)
}

async function emitTxStatus(
  job: { id?: string; data: PendingTxJobData },
  status: string,
  details?: Record<string, unknown>,
) {
  const { depositId, userId, network, token } = job.data
  const payload = {
    event: 'pending-tx:status',
    status,
    depositId,
    userId,
    network,
    token,
    jobId: job.id,
    timestamp: new Date().toISOString(),
    ...details,
  }

  await Promise.all([
    publishWsEvent(`exchange:${depositId}`, payload),
    publishWsEvent(`user:${userId}`, payload),
  ])
}

// ── Multicall3 batch disbursement ────────────────────────────────────────────


async function batchDisburse(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: `0x${string}`,
  signerAccount: ReturnType<typeof privateKeyToAccount>,
  totalAmount: bigint,
  chain: Chain,
  jobId: string | undefined,
): Promise<`0x${string}`> {
  if (!TREASURY_ADDRESS || !FEE_VAULT_ADDRESS) {
    throw new Error('TREASURY_ADDRESS and FEE_VAULT_ADDRESS are required for batch disbursement')
  }

  const feeAmount = (totalAmount * BigInt(Math.round(FEE_RATE * 10000))) / 10000n
  const netAmount = totalAmount - feeAmount

  log(jobId, `Disbursing: net=${netAmount} → ${TREASURY_ADDRESS}, fee=${feeAmount} → ${FEE_VAULT_ADDRESS}`)

   let nonce = await publicClient.getTransactionCount({
    address: signerAccount.address,
    blockTag: 'pending', // important: use 'pending' to include mempool txs
  })

  // Perform sequential transfers directly to prevent MEV multi-call theft
  const hashTreasury = await walletClient.writeContract({
    account: signerAccount,
    chain,
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [TREASURY_ADDRESS, netAmount],
    nonce: nonce++,
  })

  log(jobId, `Treasury transfer tx sent: ${hashTreasury}`)
  await publicClient.waitForTransactionReceipt({ hash: hashTreasury })

  let finalHash = hashTreasury
  if (feeAmount > 0n) {
    const hashFee = await walletClient.writeContract({
      account: signerAccount,
      chain,
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      nonce: nonce++,
      args: [FEE_VAULT_ADDRESS, feeAmount],
    })
    log(jobId, `Fee transfer tx sent: ${hashFee}`)
    await publicClient.waitForTransactionReceipt({ hash: hashFee })
    finalHash = hashFee
  }

  return finalHash
}

// ── Job processor ────────────────────────────────────────────────────────────

async function processWatchDeposit(job: { id?: string; data: PendingTxJobData }) {
  const { depositId, walletAddress, network, token, amount } = job.data
  const jobId = job.id

  log(jobId, `Starting watch — deposit=${depositId} wallet=${walletAddress} network=${network} token=${token} amount=${amount}`)
  await emitTxStatus(job, 'watch_started', {
    walletAddress,
    expectedAmount: amount,
  })

  // 1. Resolve chain config
  const chainConfig = getChainConfig(network)
  const tokenAddress = getTokenAddress(network, token)

  if (!tokenAddress) {
    throw new Error(`Token ${token} is not available on network ${network}`)
  }

  log(jobId, `Chain: ${network} (${chainConfig.chainId}), token contract: ${tokenAddress}`)

  // 2. Create viem public client
  const publicClient = createPublicClient({
    transport: http(chainConfig.rpcUrl),
  })

  // 3. Get token decimals and start block
  const [decimals, startBlock] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }) as Promise<number>,
    publicClient.getBlockNumber(),
  ])

  // Look back a few blocks to catch transfers that happened just before the job was created
  const lookBackBlocks = 10n
  const fromBlock = startBlock > lookBackBlocks ? startBlock - lookBackBlocks : 0n

  log(jobId, `Watching from block ${fromBlock} (current: ${startBlock}), token decimals: ${decimals}`)
  await emitTxStatus(job, 'watching', {
    fromBlock: fromBlock.toString(),
    currentBlock: startBlock.toString(),
    decimals,
  })

  const expectedAmount = parseUnits(amount, decimals)
  const deadline = Date.now() + WATCH_TIMEOUT_MS

  // 4. Poll loop
  let pollCount = 0

  while (Date.now() < deadline) {
    pollCount++
    const currentBlock = await publicClient.getBlockNumber()

    log(jobId, `Poll #${pollCount} — scanning blocks ${fromBlock}..${currentBlock}`)
    await emitTxStatus(job, 'scanning', {
      pollCount,
      fromBlock: fromBlock.toString(),
      toBlock: currentBlock.toString(),
    })

    try {
      const logs = await publicClient.getLogs({
        address: tokenAddress,
        event: ERC20_TRANSFER_EVENT,
        args: {
          to: walletAddress as `0x${string}`,
        },
        fromBlock,
        toBlock: currentBlock,
      })

      if (logs.length > 0) {
        // Find a transfer with sufficient amount
        for (const transferLog of logs) {
          const transferValue = transferLog.args.value ?? 0n
          const txHash = transferLog.transactionHash

          log(
            jobId,
            `Transfer detected: ${formatUnits(transferValue, decimals)} ${token} ` +
              `from ${transferLog.args.from} in tx ${txHash}`,
          )

          if (transferValue >= expectedAmount) {
            log(jobId, `Amount matched (expected >= ${formatUnits(expectedAmount, decimals)}). Confirming payment...`)
            await emitTxStatus(job, 'transfer_matched', {
              txHash,
              receivedAmount: formatUnits(transferValue, decimals),
              expectedAmount: formatUnits(expectedAmount, decimals),
            })
            await emitTxStatus(job, 'confirming_payment', {
              txHash,
            })

            // 5. Confirm payment in the database
            const confirmResult = await confirmPayment({
              exchangeId: depositId,
              txHash: txHash,
              token: token as 'USDC' | 'USDT',
              amount: Number(formatUnits(transferValue, decimals)),
            })

            log(jobId, `Payment confirmed:`, JSON.stringify(confirmResult))
            await emitTxStatus(job, 'payment_confirmed', {
              txHash,
              confirmResult,
            })

            // 6. Batch disbursement via Multicall3
            if (SIGNER_PRIVATE_KEY && TREASURY_ADDRESS && FEE_VAULT_ADDRESS) {
              try {
                const account = privateKeyToAccount(SIGNER_PRIVATE_KEY)
                log(jobId, `Disbursement signer=${account.address}, treasury=${TREASURY_ADDRESS}, feeVault=${FEE_VAULT_ADDRESS}`)
                await emitTxStatus(job, 'disbursement_started', {
                  signer: account.address,
                  treasuryAddress: TREASURY_ADDRESS,
                  feeVaultAddress: FEE_VAULT_ADDRESS,
                })
                const walletClientInstance = createWalletClient({
                  account,
                  chain: chainConfig.chain,
                  transport: http(chainConfig.rpcUrl),
                })

                const disburseTxHash = await batchDisburse(
                  publicClient,
                  walletClientInstance,
                  tokenAddress,
                  account,
                  transferValue,
                  chainConfig.chain,
                  jobId,
                )

                log(jobId, `Batch disbursement complete: ${disburseTxHash}`)
                await emitTxStatus(job, 'disbursement_succeeded', {
                  txHash,
                  disburseTxHash,
                  amount: formatUnits(transferValue, decimals),
                })

                const result = {
                  settled: true,
                  depositId,
                  txHash,
                  disburseTxHash,
                  amount: formatUnits(transferValue, decimals),
                }
                await emitTxStatus(job, 'settled', result)
                return result
              } catch (disburseError) {
                logError(jobId, `Batch disbursement failed (deposit already confirmed):`, disburseError)
                // Deposit is confirmed even if disbursement fails
                // Disbursement can be retried manually
                const result = {
                  settled: true,
                  depositId,
                  txHash,
                  disburseFailed: true,
                  disburseError: String(disburseError),
                  amount: formatUnits(transferValue, decimals),
                }
                await emitTxStatus(job, 'disbursement_failed', {
                  txHash,
                  disburseError: String(disburseError),
                })
                await emitTxStatus(job, 'settled', result)
                return result
              }
            } else {
              log(jobId, `Skipping batch disbursement — SIGNER_PRIVATE_KEY, TREASURY_ADDRESS, or FEE_VAULT_ADDRESS not set`)
              const result = {
                settled: true,
                depositId,
                txHash,
                amount: formatUnits(transferValue, decimals),
              }
              await emitTxStatus(job, 'disbursement_skipped', {
                txHash,
                reason: 'missing_disbursement_env',
              })
              await emitTxStatus(job, 'settled', result)
              return result
            }
          } else {
            log(
              jobId,
              `Amount too low: received ${formatUnits(transferValue, decimals)}, ` +
                `expected >= ${formatUnits(expectedAmount, decimals)}. Continuing watch...`,
            )
            await emitTxStatus(job, 'transfer_amount_too_low', {
              txHash,
              receivedAmount: formatUnits(transferValue, decimals),
              expectedAmount: formatUnits(expectedAmount, decimals),
            })
          }
        }
      }
    } catch (pollError) {
      logError(jobId, `Poll error (will retry):`, pollError)
      await emitTxStatus(job, 'scan_error', {
        error: String(pollError),
      })
    }

    // Wait before next poll
    const remainingMs = deadline - Date.now()
    const waitMs = Math.min(POLL_INTERVAL_MS, remainingMs)

    if (waitMs > 0) {
      await sleep(waitMs)
    }
  }

  // Timeout reached
  log(jobId, `Watch timed out after ${WATCH_TIMEOUT_MS / 1000}s — no matching transfer found`)
  await emitTxStatus(job, 'timeout', {
    timeoutSeconds: WATCH_TIMEOUT_MS / 1000,
    walletAddress,
  })
  throw new Error(`WATCH_TIMEOUT: No matching ${token} transfer to ${walletAddress} on ${network} within ${WATCH_TIMEOUT_MS / 1000}s`)
}

// ── Worker setup ─────────────────────────────────────────────────────────────

const connection = getRedisConnection()

const worker = new Worker<PendingTxJobData>(
  PENDING_TX_QUEUE,
  async (job) => {
    return processWatchDeposit(job)
  },
  {
    connection,
    concurrency: 5,
    // The job itself runs for up to WATCH_TIMEOUT_MS, give extra buffer
    lockDuration: WATCH_TIMEOUT_MS + 60_000,
    lockRenewTime: WATCH_TIMEOUT_MS / 2,
  },
)

worker.on('completed', (job, result) => {
  log(job?.id, `Job completed:`, JSON.stringify(result))
})

worker.on('failed', (job, error) => {
  logError(job?.id, `Job failed:`, error.message)
})

worker.on('error', (error) => {
  logError(undefined, `Worker error:`, error)
})

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  log(undefined, `Received ${signal}, shutting down...`)
  await worker.close()
  log(undefined, `Worker closed. Exiting.`)
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

log(undefined, `Worker started — queue="${PENDING_TX_QUEUE}", timeout=${WATCH_TIMEOUT_MS / 1000}s, poll=${POLL_INTERVAL_MS / 1000}s`)
log(undefined, `Batch disbursement: ${SIGNER_PRIVATE_KEY ? 'ENABLED' : 'DISABLED (no SIGNER_PRIVATE_KEY)'}`)
