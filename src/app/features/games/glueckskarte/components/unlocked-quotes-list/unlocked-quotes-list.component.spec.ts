import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../../../../core/services/audio.service';
import { ALL_QUOTES } from '../../data/glueckskarte.data';
import { UnlockedQuotesListComponent } from './unlocked-quotes-list.component';

describe('UnlockedQuotesListComponent', () => {
  let component: UnlockedQuotesListComponent;
  let fixture: ComponentFixture<UnlockedQuotesListComponent>;
  let mockAudioService: { playBubbleHover: any };

  beforeEach(async () => {
    mockAudioService = {
      playBubbleHover: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UnlockedQuotesListComponent],
      providers: [{ provide: AudioService, useValue: mockAudioService }],
    }).compileComponents();

    fixture = TestBed.createComponent(UnlockedQuotesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display empty state when quotes array is empty', () => {
    component.quotes = [];
    fixture.detectChanges();

    const empty = fixture.debugElement.query(By.css('.empty-state'));
    expect(empty).not.toBeNull();
  });

  it('should render items when quotes are provided', () => {
    fixture.componentRef.setInput('quotes', [ALL_QUOTES[0], ALL_QUOTES[1], ALL_QUOTES[2]]);
    fixture.componentRef.setInput('activeQuoteId', ALL_QUOTES[1].id);
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.unlocked-item'));
    expect(items.length).toBe(3);

    // The second item should have .is-active class
    expect(items[1].nativeElement.classList.contains('is-active')).toBe(true);
    expect(items[0].nativeElement.classList.contains('is-active')).toBe(false);
  });

  it('should emit selectQuote event when clicking an item', () => {
    fixture.componentRef.setInput('quotes', [ALL_QUOTES[0], ALL_QUOTES[1]]);
    fixture.componentRef.setInput('activeQuoteId', ALL_QUOTES[0].id);
    fixture.detectChanges();

    const selectSpy = vi.fn();
    component.selectQuote.subscribe(selectSpy);

    const items = fixture.debugElement.queryAll(By.css('.unlocked-item'));
    items[1].triggerEventHandler('click', null);

    expect(selectSpy).toHaveBeenCalledWith(ALL_QUOTES[1]);
    expect(mockAudioService.playBubbleHover).toHaveBeenCalled();
  });

  it('should trigger hover audio on onItemHover', () => {
    component.onItemHover();
    expect(mockAudioService.playBubbleHover).toHaveBeenCalled();
  });
});
