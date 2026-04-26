/**
 * Ticker-related shared types and Zod schemas. These cross every package
 * boundary (provider responses, cache payloads, DB reads, web SSR), so each
 * one has a runtime Zod validator alongside the inferred TS type.
 */
import { z } from "zod";

export const TickerSymbolSchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9.\-]+$/u, "Ticker symbols are uppercase A-Z, 0-9, '.' or '-'");

export type TickerSymbol = z.infer<typeof TickerSymbolSchema>;

export const TickerInfoSchema = z.object({
  symbol: TickerSymbolSchema,
  name: z.string().min(1),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  exchange: z.string().nullable(),
  currency: z.string().min(1),
  currentPrice: z.number().finite(),
  priceChange: z.number().finite(),
  priceChangePercent: z.number().finite(),
  week52High: z.number().finite(),
  week52Low: z.number().finite(),
  marketCap: z.number().finite().nullable(),
  volume: z.number().int().nonnegative().nullable(),
  averageVolume: z.number().int().nonnegative().nullable(),
});

export type TickerInfo = z.infer<typeof TickerInfoSchema>;

export const PricePointSchema = z.object({
  date: z.string().min(1),
  close: z.number().finite(),
  open: z.number().finite().nullable(),
  high: z.number().finite().nullable(),
  low: z.number().finite().nullable(),
  volume: z.number().int().nonnegative().nullable(),
});

export type PricePoint = z.infer<typeof PricePointSchema>;

export const PriceHistorySchema = z.object({
  symbol: TickerSymbolSchema,
  periodMonths: z.number().int().positive(),
  points: z.array(PricePointSchema),
  fetchedAt: z.string().min(1),
});

export type PriceHistory = z.infer<typeof PriceHistorySchema>;

