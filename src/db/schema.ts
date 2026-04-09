import { bigint, boolean, integer, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const statusEnum = pgEnum('status', ['pending', 'processing', 'settled', 'failed'])
export const networkMode = pgEnum('network_mode', ['testnet', 'mainnet'])

export const networks = pgTable('networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 10 }).notNull(),
  contractAddress: varchar('contract_address', { length: 100 }).notNull(),
  decimal: integer('decimal').notNull(),
  rpcUrl: varchar('rpc_url', { length: 255 }),
  blockExplorer: varchar('block_explorer', { length: 255 }),
  chainId: varchar('chain_id'),
  mode: networkMode('mode').notNull(),
  networkKey: varchar('network_key', { length: 50 }).notNull(),
  networkName: varchar('network_name', { length: 100 }).notNull(),
  iconKey: varchar('icon_key', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const depositWallets = pgTable('deposit_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  network: varchar('network', { length: 50 }).notNull(),
  address: varchar('address', { length: 100 }).notNull().unique(),
  derivationIndex: numeric('derivation_index').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  walletId: uuid('wallet_id').references(() => depositWallets.id),
  txHash: varchar('tx_hash', { length: 100 }).notNull().unique(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  amountFee: numeric('amount_fee', { precision: 20, scale: 8 }).notNull(),
  network: varchar('network', { length: 50 }).notNull(),
  status: statusEnum('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  settledAt: timestamp('settled_at'),
})

export const disbursements = pgTable('disbursements', {
  id: uuid('id').primaryKey().defaultRandom(),
  depositId: uuid('deposit_id').references(() => deposits.id),
  toAddress: varchar('to_address', { length: 100 }).notNull(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  txHash: varchar('tx_hash', { length: 100 }),
  type: varchar('type', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const userBalances = pgTable('user_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 100 }).notNull().unique(),
  balanceIdr: numeric('balance_idr', { precision: 20, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const balanceLedgers = pgTable('balance_ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  depositId: uuid('deposit_id').references(() => deposits.id).unique(),
  amountIdr: numeric('amount_idr', { precision: 20, scale: 2 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export type TNetworks = typeof networks.$inferInsert