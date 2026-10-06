import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../../core/services/audio.service';
import { GlueckskarteComponent } from './glueckskarte.component';
import { GlueckskarteStorageService } from './services/glueckskarte-storage.service';

describe('GlueckskarteComponent (4-Card Fan Selection)', () => {
  let component: GlueckskarteComponent;
  let fixture: ComponentFixture<GlueckskarteComponent>;
  let storageService: GlueckskarteStorageService;
  let router: Router;
  let mockAudioService: {
    playChime: any;
    playBubbleHover: any;
    toggleSound: any;
    isMuted: any;
  };

  beforeEach(async () => {
    localStorage.clear();

    mockAudioService = {
      playChime: vi.fn(),
      playBubbleHover: vi.fn(),
      toggleSound: vi.fn(),
      isMuted: vi.fn().mockReturnValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [GlueckskarteComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
        GlueckskarteStorageService,
      ],
    }).compileComponents();

    storageService = TestBed.inject(GlueckskarteStorageService);
    storageService.resetState();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(GlueckskarteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State (Card not yet drawn today)', () => {
    it('should show 4 face-down fan cards and keep isFlipped false', () => {
      expect(component.isFlipped()).toBe(false);
      expect(component.canDrawToday()).toBe(true);

      const fanCards = fixture.debugElement.queryAll(By.css('.fan-card'));
      expect(fanCards.length).toBe(4);

      // Revealed lucky-card should not be displayed yet
      const revealedCard = fixture.debugElement.query(By.css('app-lucky-card'));
      expect(revealedCard).toBeNull();
    });

    it('should play bubble hover sound when hovering over a fan card', () => {
      component.onFanCardHover();
      expect(mockAudioService.playBubbleHover).toHaveBeenCalled();
    });

    it('should draw a quote and switch to revealed card view when a fan card is clicked', () => {
      const fanCards = fixture.debugElement.queryAll(By.css('.fan-card'));
      fanCards[2].triggerEventHandler('click', null);
      fixture.detectChanges();

      expect(component.isFlipped()).toBe(true);
      expect(component.currentQuote()).not.toBeNull();
      expect(component.canDrawToday()).toBe(false);
      expect(mockAudioService.playChime).toHaveBeenCalled();

      // Now the 4 fan cards should disappear, and the revealed lucky card should appear
      const fanCardsAfter = fixture.debugElement.queryAll(By.css('.fan-card'));
      expect(fanCardsAfter.length).toBe(0);

      const revealedCard = fixture.debugElement.query(By.css('app-lucky-card'));
      expect(revealedCard).not.toBeNull();
    });

    it('should allow selecting fan cards with keyboard numbers 1 to 4', () => {
      const event = new KeyboardEvent('keydown', { key: '3' });
      window.dispatchEvent(event);
      fixture.detectChanges();

      expect(component.isFlipped()).toBe(true);
      expect(component.currentQuote()).not.toBeNull();
    });
  });

  describe('Revisit on Same Day (Card already drawn)', () => {
    it('should NOT render the 4 fan cards, and directly display the revealed card', async () => {
      // Draw card first
      const preDrawn = storageService.drawCard();

      // Create a fresh component instance simulating a page revisit
      const revisitFixture = TestBed.createComponent(GlueckskarteComponent);
      const revisitComponent = revisitFixture.componentInstance;
      revisitFixture.detectChanges();

      expect(revisitComponent.isFlipped()).toBe(true);
      expect(revisitComponent.currentQuote()?.id).toBe(preDrawn.id);
      expect(revisitComponent.canDrawToday()).toBe(false);

      // The 4 fan cards must NOT exist in the DOM
      const fanCards = revisitFixture.debugElement.queryAll(By.css('.fan-card'));
      expect(fanCards.length).toBe(0);

      // The opened single card must be directly present
      const revealedCard = revisitFixture.debugElement.query(By.css('app-lucky-card'));
      expect(revealedCard).not.toBeNull();
    });
  });

  describe('Navigation & Shortcuts', () => {
    it('should navigate to home on Escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should navigate to home when clicking back button', () => {
      component.onNavigateHome();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(mockAudioService.playBubbleHover).toHaveBeenCalled();
    });
  });
});
