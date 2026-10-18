import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmeisenInfoBubbleComponent } from './ameisen-info-bubble.component';

describe('AmeisenInfoBubbleComponent', () => {
  let component: AmeisenInfoBubbleComponent;
  let fixture: ComponentFixture<AmeisenInfoBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmeisenInfoBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AmeisenInfoBubbleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close when close button is clicked', () => {
    const emitSpy = vi.spyOn(component.close, 'emit');
    const closeBtn = fixture.nativeElement.querySelector('.bubble-close-btn');
    closeBtn.click();
    expect(emitSpy).toHaveBeenCalled();
  });
});
