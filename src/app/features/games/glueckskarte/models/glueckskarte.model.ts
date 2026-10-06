/**
 * Supported categories for wisdom quotes.
 */
export type CardCategory =
  | 'buddhismus'
  | 'stoa'
  | 'alchimist'
  | 'birkenbihl'
  | 'einstein'
  | 'mindset';

/**
 * Metadata and display configuration for a quote category.
 */
export interface CategoryMeta {
  id: CardCategory;
  label: string;
  iconName: string;
  badgeColor: string;
}

/**
 * Representation of a single curated wisdom quote.
 */
export interface LuckQuote {
  /** Unique sequential identifier from 1 to 100 */
  id: number;
  /** The inspiring quote or wisdom text */
  text: string;
  /** Author or spiritual teacher */
  author: string;
  /** Optional source book or work */
  source?: string;
  /** The category this quote belongs to */
  category: CardCategory;
  /** Thought-provoking daily reflection question or prompt */
  reflectionPrompt?: string;
}

/**
 * State stored in LocalStorage for the daily fortune card draw.
 */
export interface DailyLuckCardState {
  /** ISO date string of the last draw in local time (e.g. '2026-10-06') */
  lastDrawnDate: string;
  /** ID of the quote drawn for today (1..100) */
  todayQuoteId: number;
  /** List of all quote IDs already drawn in the current 100-day cycle */
  seenQuoteIds: number[];
  /** Current completion cycle number (starts at 1) */
  cycleCount: number;
}
