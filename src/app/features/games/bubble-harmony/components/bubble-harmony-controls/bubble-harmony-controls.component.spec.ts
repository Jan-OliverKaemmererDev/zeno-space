import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BubbleHarmonyControlsComponent } from './bubble-harmony-controls.component';
import { By } from '@angular/platform-browser';

describe('BubbleHarmonyControlsComponent', () => {
  let component: BubbleHarmonyControlsComponent;
  let fixture: ComponentFixture<BubbleHarmonyControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleHarmonyControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleHarmonyControlsComponent);
    component = fixture.componentInstance;
    component.chainReaction = true;
    component.activeTool = null;
    component.activeToolHint = 'Klicke eine Blase zum Platzen & Hören';
    component.showToolBubble = false;
    component.closingToolBubble = false;
    fixture.detectChanges();
  });

  it('should create the controls component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit spawnCluster when primary button is clicked', () => {
    const spawnSpy = vi.fn();
    component.spawnCluster.subscribe(spawnSpy);

    const primaryBtn = fixture.debugElement.query(By.css('.dock-btn--primary'));
    primaryBtn.nativeElement.click();

    expect(spawnSpy).toHaveBeenCalled();
  });

  it('should emit toggleChain when secondary button is clicked', () => {
    const chainSpy = vi.fn();
    component.toggleChain.subscribe(chainSpy);

    const secondaryBtn = fixture.debugElement.query(By.css('.dock-btn--secondary'));
    secondaryBtn.nativeElement.click();

    expect(chainSpy).toHaveBeenCalled();
  });

  it('should emit popAllSymphony when ghost button is clicked', () => {
    const symphonySpy = vi.fn();
    component.popAllSymphony.subscribe(symphonySpy);

    const ghostBtn = fixture.debugElement.query(By.css('.dock-btn--ghost'));
    ghostBtn.nativeElement.click();

    expect(symphonySpy).toHaveBeenCalled();
  });

  it('should emit toggleToolBubble when tool button is clicked', () => {
    const toggleSpy = vi.fn();
    component.toggleToolBubble.subscribe(toggleSpy);

    const toolBtn = fixture.debugElement.query(By.css('.dock-btn--tool'));
    toolBtn.nativeElement.click();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should emit selectTool when onSelectTool is invoked', () => {
    const selectSpy = vi.fn();
    component.selectTool.subscribe(selectSpy);

    component.onSelectTool('fan');

    expect(selectSpy).toHaveBeenCalledWith('fan');
  });

  it('should emit closeToolBubble when onCloseToolBubble is invoked', () => {
    const closeSpy = vi.fn();
    component.closeToolBubble.subscribe(closeSpy);

    component.onCloseToolBubble();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should display activeToolHint text', () => {
    const hintText = fixture.debugElement.query(By.css('.hint-item span'));
    expect(hintText.nativeElement.textContent).toContain('Klicke eine Blase zum Platzen & Hören');
  });
});
