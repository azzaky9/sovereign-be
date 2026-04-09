import { Queue } from 'bullmq'

// ── Types ────────────────────────────────────────────────────────────────────

export type PendingTxJobData = {
  depositId: string
  userId: string
  walletAddress: string
  network: string
  token: string
  amount: string
  createdAt: string
}

// ── Redis connection ─────────────────────────────────────────────────────────

export function getRedisConnection() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is required')
  }

  const parsed = new URL(url)

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username !== 'default' ? parsed.username : undefined,
  }
}

// ── Queue definitions ────────────────────────────────────────────────────────

export const PENDING_TX_QUEUE = 'pending-tx'

export const pendingTxQueue = new Queue<PendingTxJobData>(PENDING_TX_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: 200,
  },
})
