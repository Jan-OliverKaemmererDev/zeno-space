import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CosmicHeaderComponent } from './cosmic-header.component';

describe('CosmicHeaderComponent', () => {
  let component: CosmicHeaderComponent;
  let fixture: ComponentFixture<CosmicHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CosmicHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CosmicHeaderComponent);
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
});
