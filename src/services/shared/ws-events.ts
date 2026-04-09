import { Redis } from 'ioredis'

import { getRedisConnection } from './queue'

let publisher: Redis | null = null

function getPublisher() {
  if (publisher) {
    return publisher
  }

  publisher = getRedisConnection()
  publisher.on('error', (error) => {
    console.error('Redis publisher error:', error)
  })

  return publisher
}

export async function publishWsEvent(topic: string, payload: unknown) {
  const client = getPublisher()
  if (!client) {
    return
  }

  await client.publish(`ws:${topic}`, JSON.stringify(payload))
}
