import { Redis } from 'ioredis'

let publisher: Redis | null = null

function getPublisher() {
  if (publisher) {
    return publisher
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return null
  }

  publisher = new Redis(redisUrl)
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
