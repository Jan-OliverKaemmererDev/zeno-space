import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MandelbrotHeaderComponent } from './mandelbrot-header.component';

describe('MandelbrotHeaderComponent', () => {
  let component: MandelbrotHeaderComponent;
  let fixture: ComponentFixture<MandelbrotHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MandelbrotHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MandelbrotHeaderComponent);
    component = fixture.componentInstance;
    component.zoomFormatted = '1,0×';
    component.iterations = 100;
    component.currentWaypointName = 'Wikipedia Scepter-Spirale';
    component.coordSnippet = 'c = -0,7436 + 0,1318i';
    component.showBubble = false;
    component.closingBubble = false;
    fixture.detectChanges();
  });

  it('should create the header component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleBubble when stat pill is clicked', () => {
    const toggleSpy = vi.fn();
    component.toggleBubble.subscribe(toggleSpy);

    const event = new MouseEvent('click');
    component.onStatPillClick(event);

    expect(toggleSpy).toHaveBeenCalledWith(event);
  });

  it('should emit closeBubble when onBubbleClose is called', () => {
    const closeSpy = vi.fn();
    component.closeBubble.subscribe(closeSpy);

    component.onBubbleClose();
    expect(closeSpy).toHaveBeenCalled();
  });
});
