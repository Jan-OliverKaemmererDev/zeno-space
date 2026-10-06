import { computed, Injectable, signal } from '@angular/core';
import { ALL_QUOTES } from '../data/glueckskarte.data';
import { DailyLuckCardState, LuckQuote } from '../models/glueckskarte.model';

export const DAILY_LUCK_STORAGE_KEY = 'zeno_daily_luck_card_v1';

/**
 * Service managing local storage persistence, daily single-draw restrictions,
 * 100-quote repetition avoidance, and automatic cycle resets.
 */
@Injectable({
  providedIn: 'root',
})
export class GlueckskarteStorageService {
  /**
   * Reactive state signal containing the persisted daily card progress.
   */
  readonly state = signal<DailyLuckCardState>(this.loadInitialState());

  /**
   * Computed boolean indicating whether the user is eligible to draw today's card.
   */
  readonly canDrawToday = computed(() => {
    const todayStr = this.getTodayDateString();
    return this.state().lastDrawnDate !== todayStr;
  });

  /**
   * Computed reference to the quote drawn for today, or null if not yet drawn.
   */
  readonly todayQuote = computed<LuckQuote | null>(() => {
    const quoteId = this.state().todayQuoteId;
    if (!quoteId || this.canDrawToday()) {
      return null;
    }
    return ALL_QUOTES.find((q) => q.id === quoteId) ?? null;
  });

  /**
   * Computed progress metrics for the current 100-card cycle.
   */
  readonly progress = computed(() => {
    const current = this.state();
    return {
      seenCount: current.seenQuoteIds.length,
      totalCount: ALL_QUOTES.length,
      cycleCount: current.cycleCount,
      percentage: Math.round((current.seenQuoteIds.length / ALL_QUOTES.length) * 100),
    };
  });

  /**
   * Computed list of all quotes unlocked in the current cycle, mapped in draw order.
   */
  readonly unlockedQuotes = computed<LuckQuote[]>(() => {
    const seenIds = this.state().seenQuoteIds;
    return seenIds
      .map((id) => ALL_QUOTES.find((q) => q.id === id))
      .filter((q): q is LuckQuote => !!q);
  });

  /**
   * Most recently drawn quote (today's quote if drawn, or the last drawn quote).
   */
  readonly latestUnlockedQuote = computed<LuckQuote | null>(() => {
    const list = this.unlockedQuotes();
    if (list.length === 0) return null;
    return list[list.length - 1];
  });

  /**
   * Formats a Date object into a local 'YYYY-MM-DD' calendar date string.
   */
  getTodayDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Executes the daily card draw.
   * If already drawn today, returns today's existing quote.
   * Otherwise, draws a random quote from unrevealed pool, appends to seenQuoteIds,
   * resets the pool if all 100 are completed, and persists the new state.
   *
   * @returns The drawn or existing LuckQuote.
   */
  drawCard(overrideDate?: Date): LuckQuote {
    const todayStr = this.getTodayDateString(overrideDate);
    const currentState = this.state();

    // If already drawn on this calendar day, return existing card
    if (currentState.lastDrawnDate === todayStr && currentState.todayQuoteId > 0) {
      const existing = ALL_QUOTES.find((q) => q.id === currentState.todayQuoteId);
      if (existing) {
        return existing;
      }
    }

    let seen = [...currentState.seenQuoteIds];
    let cycle = currentState.cycleCount;

    // Cycle reset check: if all 100 quotes were seen, reset history for next cycle
    if (seen.length >= ALL_QUOTES.length) {
      seen = [];
      cycle += 1;
    }

    // Filter available unrevealed quotes
    let available = ALL_QUOTES.filter((q) => !seen.includes(q.id));
    if (available.length === 0) {
      // Safety fallback in case of corrupt state
      seen = [];
      cycle += 1;
      available = [...ALL_QUOTES];
    }

    // Pick random quote from available pool
    const randomIndex = Math.floor(Math.random() * available.length);
    const chosenQuote = available[randomIndex];

    const updatedState: DailyLuckCardState = {
      lastDrawnDate: todayStr,
      todayQuoteId: chosenQuote.id,
      seenQuoteIds: [...seen, chosenQuote.id],
      cycleCount: cycle,
    };

    this.saveState(updatedState);
    return chosenQuote;
  }

  /**
   * Calculates the remaining time until local midnight when the next card unlocks.
   */
  getTimeUntilMidnight(now: Date = new Date()): {
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  } {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const diffMs = Math.max(0, midnight.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return { hours, minutes, seconds, formatted };
  }

  /**
   * Resets local storage state. Mainly used for automated testing.
   */
  resetState(): void {
    try {
      localStorage.removeItem(DAILY_LUCK_STORAGE_KEY);
    } catch {
      // LocalStorage access might fail in restricted environments
    }
    this.state.set({
      lastDrawnDate: '',
      todayQuoteId: 0,
      seenQuoteIds: [],
      cycleCount: 1,
    });
  }

  /**
   * Reads and validates the persisted state from LocalStorage.
   */
  private loadInitialState(): DailyLuckCardState {
    const defaultState: DailyLuckCardState = {
      lastDrawnDate: '',
      todayQuoteId: 0,
      seenQuoteIds: [],
      cycleCount: 1,
    };

    try {
      const raw = localStorage.getItem(DAILY_LUCK_STORAGE_KEY);
      if (!raw) {
        return defaultState;
      }

      const parsed = JSON.parse(raw) as Partial<DailyLuckCardState>;
      if (
        typeof parsed.lastDrawnDate === 'string' &&
        typeof parsed.todayQuoteId === 'number' &&
        Array.isArray(parsed.seenQuoteIds) &&
        typeof parsed.cycleCount === 'number'
      ) {
        // Filter out invalid IDs
        const validSeenIds = parsed.seenQuoteIds.filter(
          (id): id is number => typeof id === 'number' && id >= 1 && id <= ALL_QUOTES.length
        );

        return {
          lastDrawnDate: parsed.lastDrawnDate,
          todayQuoteId: parsed.todayQuoteId,
          seenQuoteIds: validSeenIds,
          cycleCount: Math.max(1, parsed.cycleCount),
        };
      }
    } catch {
      // JSON parse error or storage error
    }

    return defaultState;
  }

  /**
   * Saves updated state to LocalStorage and updates reactive signal.
   */
  private saveState(newState: DailyLuckCardState): void {
    try {
      localStorage.setItem(DAILY_LUCK_STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Storage quota or security error
    }
    this.state.set(newState);
  }
}
