import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ALL_QUOTES } from '../data/glueckskarte.data';
import { DAILY_LUCK_STORAGE_KEY, GlueckskarteStorageService } from './glueckskarte-storage.service';

describe('Glueckskarte Dataset & StorageService', () => {
  let service: GlueckskarteStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [GlueckskarteStorageService],
    });
    service = TestBed.inject(GlueckskarteStorageService);
    service.resetState();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Dataset Validation (ALL_QUOTES)', () => {
    it('should contain exactly 100 quotes', () => {
      expect(ALL_QUOTES.length).toBe(100);
    });

    it('should have strictly sequential and unique IDs from 1 to 100', () => {
      const ids = ALL_QUOTES.map((q) => q.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
      for (let i = 1; i <= 100; i++) {
        expect(uniqueIds.has(i)).toBe(true);
      }
    });

    it('should have valid texts, authors, and categories for all 100 quotes', () => {
      for (const quote of ALL_QUOTES) {
        expect(quote.text.trim().length).toBeGreaterThan(10);
        expect(quote.author.trim().length).toBeGreaterThan(1);
        expect([
          'buddhismus',
          'stoa',
          'alchimist',
          'birkenbihl',
          'einstein',
          'mindset',
        ]).toContain(quote.category);
      }
    });
  });

  describe('Daily Draw Logic & Restrictions', () => {
    it('should initially allow drawing a card', () => {
      expect(service.canDrawToday()).toBe(true);
      expect(service.todayQuote()).toBeNull();
    });

    it('should draw a card and prevent drawing a second card on the same day', () => {
      const drawn = service.drawCard();
      expect(drawn).toBeDefined();
      expect(drawn.id).toBeGreaterThanOrEqual(1);
      expect(drawn.id).toBeLessThanOrEqual(100);

      // Now it should be locked for today
      expect(service.canDrawToday()).toBe(false);
      expect(service.todayQuote()?.id).toBe(drawn.id);

      // Drawing again on the same day should return the identical quote
      const redraw = service.drawCard();
      expect(redraw.id).toBe(drawn.id);
    });

    it('should track progress correctly', () => {
      service.drawCard();
      const progress = service.progress();
      expect(progress.seenCount).toBe(1);
      expect(progress.totalCount).toBe(100);
      expect(progress.cycleCount).toBe(1);
      expect(progress.percentage).toBe(1);
    });

    it('should persist drawn state to localStorage', () => {
      service.drawCard();
      const raw = localStorage.getItem(DAILY_LUCK_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.todayQuoteId).toBeGreaterThanOrEqual(1);
      expect(parsed.seenQuoteIds.length).toBe(1);
    });
  });

  describe('100-Day Cycle & No-Duplicate Guarantee', () => {
    it('should draw all 100 distinct quotes across 100 days without any duplicates, then reset on day 101', () => {
      const drawnIds = new Set<number>();
      const baseDate = new Date('2026-01-01T12:00:00');

      // Simulate 100 days
      for (let day = 0; day < 100; day++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + day);

        const quote = service.drawCard(currentDate);
        expect(drawnIds.has(quote.id)).toBe(false); // Must not have been seen before in this cycle
        drawnIds.add(quote.id);
      }

      // After 100 days: all 100 unique quotes must have been drawn!
      expect(drawnIds.size).toBe(100);
      expect(service.progress().seenCount).toBe(100);
      expect(service.progress().cycleCount).toBe(1);

      // Day 101: A new cycle should begin!
      const day101Date = new Date(baseDate);
      day101Date.setDate(baseDate.getDate() + 100);

      const day101Quote = service.drawCard(day101Date);
      expect(day101Quote).toBeDefined();

      const stateAfter101 = service.state();
      expect(stateAfter101.cycleCount).toBe(2);
      expect(stateAfter101.seenQuoteIds.length).toBe(1);
      expect(stateAfter101.seenQuoteIds[0]).toBe(day101Quote.id);
    });
  });

  describe('Midnight countdown helper', () => {
    it('should calculate valid countdown numbers', () => {
      const mockNow = new Date('2026-10-06T20:30:15');
      const time = service.getTimeUntilMidnight(mockNow);

      expect(time.hours).toBe(3);
      expect(time.minutes).toBe(29);
      expect(time.seconds).toBe(45);
      expect(time.formatted).toBe('03:29:45');
    });
  });

  describe('Resilience Against Corrupted Storage', () => {
    it('should gracefully handle malformed JSON in localStorage', () => {
      localStorage.setItem(DAILY_LUCK_STORAGE_KEY, '{invalid_json}');
      // Re-instantiating or reading should not throw
      const fresh = TestBed.inject(GlueckskarteStorageService);
      expect(fresh.canDrawToday()).toBe(true);
      expect(fresh.state().seenQuoteIds).toEqual([]);
    });
  });
});
