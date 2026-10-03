import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PiSpiralHeaderComponent } from './pi-spiral-header.component';

describe('PiSpiralHeaderComponent', () => {
  let component: PiSpiralHeaderComponent;
  let fixture: ComponentFixture<PiSpiralHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PiSpiralHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PiSpiralHeaderComponent);
    component = fixture.componentInstance;
    component.currentPiSnippet = '3,14159...';
    component.totalDecimalsFormatted = '7';
    component.generatedPiDecimals = '15926';
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
