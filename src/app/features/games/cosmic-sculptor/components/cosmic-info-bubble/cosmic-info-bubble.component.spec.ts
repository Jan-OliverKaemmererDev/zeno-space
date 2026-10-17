import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CosmicInfoBubbleComponent } from './cosmic-info-bubble.component';

describe('CosmicInfoBubbleComponent', () => {
  let component: CosmicInfoBubbleComponent;
  let fixture: ComponentFixture<CosmicInfoBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CosmicInfoBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CosmicInfoBubbleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close event on close button click', () => {
    const emitSpy = vi.spyOn(component.close, 'emit');
    const dummyEvent = new MouseEvent('click');
    component.handleClose(dummyEvent);
    expect(emitSpy).toHaveBeenCalled();
  });
});
