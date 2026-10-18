import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AmeisenHeaderComponent } from './ameisen-header.component';

describe('AmeisenHeaderComponent', () => {
  let component: AmeisenHeaderComponent;
  let fixture: ComponentFixture<AmeisenHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmeisenHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AmeisenHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleBubble when stat pill is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleBubble, 'emit');
    const dummyEvent = new MouseEvent('click');
    component.onStatPillClick(dummyEvent);
    expect(emitSpy).toHaveBeenCalledWith(dummyEvent);
  });

  it('should emit closeBubble when onBubbleClose is called', () => {
    const emitSpy = vi.spyOn(component.closeBubble, 'emit');
    component.onBubbleClose();
    expect(emitSpy).toHaveBeenCalled();
  });
});
