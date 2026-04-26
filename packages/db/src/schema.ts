import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * tickers — canonical list of stock symbols tracked by the platform.
 */
export const tickers = pgTable(
  "tickers",
  {
    id: serial("id").primaryKey(),
    symbol: varchar("symbol", { length: 10 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sector: varchar("sector", { length: 255 }),
    marketCap: bigint("market_cap", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    symbolUnique: uniqueIndex("tickers_symbol_unique").on(table.symbol),
  }),
);

/**
 * reports — generated risk score reports, one row per generation event.
 */
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  tickerId: integer("ticker_id")
    .notNull()
    .references(() => tickers.id, { onDelete: "cascade" }),
  riskScore: integer("risk_score").notNull(),
  rating: varchar("rating", { length: 20 }).notNull(),
  reportData: jsonb("report_data").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * price_history — daily close price + volume per ticker.
 */
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  tickerId: integer("ticker_id")
    .notNull()
    .references(() => tickers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  closePrice: numeric("close_price", { precision: 12, scale: 4 }).notNull(),
  volume: bigint("volume", { mode: "bigint" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * score_snapshots — component + composite scores for a strategy run.
 */
export const scoreSnapshots = pgTable("score_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tickerId: integer("ticker_id")
    .notNull()
    .references(() => tickers.id, { onDelete: "cascade" }),
  valuationScore: integer("valuation_score").notNull(),
  healthScore: integer("health_score").notNull(),
  growthScore: integer("growth_score").notNull(),
  compositeScore: integer("composite_score").notNull(),
  strategy: varchar("strategy", { length: 50 }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Ticker = typeof tickers.$inferSelect;
export type NewTicker = typeof tickers.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type PriceHistoryRow = typeof priceHistory.$inferSelect;
export type NewPriceHistoryRow = typeof priceHistory.$inferInsert;

export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;
export type NewScoreSnapshot = typeof scoreSnapshots.$inferInsert;

