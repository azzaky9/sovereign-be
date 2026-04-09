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

import Redis from 'ioredis'

export function getRedisConnection() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is required')
  }

  // BullMQ requires maxRetriesPerRequest: null
  // family: 4 forces IPv4 to avoid localhost resolving to ::1 hang issues on Windows/WSL
  return new Redis(url, {
    maxRetriesPerRequest: null,
    family: 4,
  })
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
