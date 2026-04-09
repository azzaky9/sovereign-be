import { getRedisConnection } from './src/services/shared/queue'

async function test() {
  console.log('Connecting...')
  const redis = getRedisConnection()
  
  redis.on('connect', () => console.log('Redis connected!'))
  redis.on('error', (err) => console.log('Redis error:', err))

  try {
    await redis.ping()
    console.log('Redis PING success!')
    process.exit(0)
  } catch (err) {
    console.log('Redis PING error:', err)
  }
}

test()
