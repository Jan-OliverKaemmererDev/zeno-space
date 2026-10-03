import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BubbleToolSpeechBubbleComponent } from './bubble-tool-speech-bubble.component';
import { By } from '@angular/platform-browser';

describe('BubbleToolSpeechBubbleComponent', () => {
  let component: BubbleToolSpeechBubbleComponent;
  let fixture: ComponentFixture<BubbleToolSpeechBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleToolSpeechBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleToolSpeechBubbleComponent);
    component = fixture.componentInstance;
    component.activeToolId = 'fan';
    component.isClosing = false;
    fixture.detectChanges();
  });

  it('should create the speech bubble component', () => {
    expect(component).toBeTruthy();
  });

  it('should render all available tools plus deactivate option', () => {
    const cards = fixture.debugElement.queryAll(By.css('.tool-card'));
    // 1 "Kein Werkzeug" option + 4 active tools
    expect(cards.length).toBe(component.tools.length + 1);
  });

  it('should mark the active tool with is-active class', () => {
    const activeCard = fixture.debugElement.query(By.css('.tool-card.is-active'));
    expect(activeCard).toBeTruthy();
    expect(activeCard.nativeElement.textContent).toContain('Ventilator');
  });

  it('should emit selectTool when a tool card is clicked', () => {
    const selectSpy = vi.fn();
    component.selectTool.subscribe(selectSpy);

    // Index 0: Kein Werkzeug, Index 1: Fan, Index 2: Magnet
    const magnetCard = fixture.debugElement.queryAll(By.css('.tool-card'))[2];
    magnetCard.nativeElement.click();

    expect(selectSpy).toHaveBeenCalledWith('magnet');
  });

  it('should emit null when Kein Werkzeug card is clicked', () => {
    const selectSpy = vi.fn();
    component.selectTool.subscribe(selectSpy);

    const noneCard = fixture.debugElement.queryAll(By.css('.tool-card'))[0];
    noneCard.nativeElement.click();

    expect(selectSpy).toHaveBeenCalledWith(null);
  });

  it('should emit close when close button is clicked', () => {
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    const closeBtn = fixture.debugElement.query(By.css('.bubble-close-btn'));
    closeBtn.nativeElement.click();

    expect(closeSpy).toHaveBeenCalled();
  });
});
