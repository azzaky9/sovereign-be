import { Pool } from 'pg'

async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  console.log('⚠️ Resetting database schema...')

  try {
    // Drop the entire public schema and recreate it
    await pool.query('DROP SCHEMA public CASCADE;')
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;')
    await pool.query('CREATE SCHEMA public;')
    await pool.query('GRANT ALL ON SCHEMA public TO postgres;')
    await pool.query('GRANT ALL ON SCHEMA public TO public;')

    console.log('✅ Database reset successfully! Schema is now empty.')
  } catch (error) {
    console.error('❌ Failed to reset database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void resetDatabase()
