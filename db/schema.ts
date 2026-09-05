import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const stockItems = sqliteTable('stock_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  event: text('event').notNull(),
  color: text('color').notNull(),
  bib: integer('bib').notNull(),
  value: integer('value').notNull(),
});

export const allocations = sqliteTable(
  'allocations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    event: text('event').notNull(),
    color: text('color').notNull(),
    bibConfirm: integer('bib_confirm').notNull(),
    bibSign: integer('bib_sign').notNull(),
    rider: text('rider').notNull(),
    club: text('club').notNull(),
    initialLocation: text('initial_location').notNull(),
    currentLocation: text('current_location').notNull(),
    currentStatus: text('current_status').notNull(),
    stockCode: text('stock_code').notNull(),
    stockColor: text('stock_color').notNull(),
    matchStatus: text('match_status').notNull(),
  },
  (table) => [
    index('idx_allocations_location').on(table.currentLocation),
    index('idx_allocations_bib').on(table.bibConfirm),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    allocationId: integer('allocation_id').notNull(),
    action: text('action').notNull(),
    person: text('person').notNull(),
    fromLocation: text('from_location').notNull(),
    toLocation: text('to_location').notNull(),
    note: text('note').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_transactions_allocation_created').on(
      table.allocationId,
      table.createdAt,
    ),
  ],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
