import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  throw new Error('REDIS_URL is required')
}

const subscriber = new Redis(redisUrl)
const port = Number(process.env.WS_PORT) || 3001

const server = Bun.serve<{ userId: string }>({
  port,
  fetch(req, currentServer) {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        return new Response('Missing userId', { status: 400 })
      }

      const upgraded = currentServer.upgrade(req, { data: { userId } })
      if (upgraded) {
        return undefined
      }

      return new Response('WebSocket upgrade failed', { status: 426 })
    }

    return new Response('WS server running', { status: 200 })
  },
  websocket: {
    open(ws) {
      const { userId } = ws.data
      ws.subscribe(`user:${userId}`)
      console.log(`Client connected: ${userId}`)
    },
    message(ws, msg) {
      try {
        const payload = JSON.parse(msg.toString())

        if (payload?.event === 'subscribe:deposit') {
          const txHash = payload?.data?.txHash
          if (txHash) {
            ws.subscribe(`deposit:${txHash}`)
          }
        }
      } catch {
        ws.send(
          JSON.stringify({
            event: 'error',
            message: 'Invalid JSON payload',
          }),
        )
      }
    },
    close(ws) {
      const { userId } = ws.data
      ws.unsubscribe(`user:${userId}`)
      console.log(`Client disconnected: ${userId}`)
    },
  },
})

void subscriber.psubscribe('ws:*')
subscriber.on('pmessage', (_pattern, channel, message) => {
  const topic = channel.replace('ws:', '')
  server.publish(topic, message)
})

subscriber.on('error', (error) => {
  console.error('Redis subscriber error:', error)
})

console.log(`WS server on ws://localhost:${port}`)
