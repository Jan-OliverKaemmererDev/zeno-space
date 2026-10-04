import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GoldenerSchnittHeaderComponent } from './goldener-schnitt-header.component';

describe('GoldenerSchnittHeaderComponent', () => {
  let component: GoldenerSchnittHeaderComponent;
  let fixture: ComponentFixture<GoldenerSchnittHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoldenerSchnittHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GoldenerSchnittHeaderComponent);
    component = fixture.componentInstance;
    component.currentPhiSnippet = '1,61803...';
    component.totalSeedsFormatted = '7';
    component.seedCount = 5;
    component.generatedPhiDecimals = '03398';
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
