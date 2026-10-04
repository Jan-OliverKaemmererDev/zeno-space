import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BubbleToolSelectorComponent } from './bubble-tool-selector.component';
import { By } from '@angular/platform-browser';

describe('BubbleToolSelectorComponent', () => {
  let component: BubbleToolSelectorComponent;
  let fixture: ComponentFixture<BubbleToolSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleToolSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleToolSelectorComponent);
    component = fixture.componentInstance;
    component.activeTool = null;
    component.showToolBubble = false;
    component.closingToolBubble = false;
    fixture.detectChanges();
  });

  it('should create the tool selector component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleToolBubble when tool button is clicked', () => {
    const toggleSpy = vi.fn();
    component.toggleToolBubble.subscribe(toggleSpy);

    const btn = fixture.debugElement.query(By.css('.dock-btn--tool'));
    btn.nativeElement.click();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should emit selectTool when onSelectTool is called', () => {
    const selectSpy = vi.fn();
    component.selectTool.subscribe(selectSpy);

    component.onSelectTool('magnet');
    expect(selectSpy).toHaveBeenCalledWith('magnet');
  });

  it('should emit closeToolBubble when onCloseToolBubble is called', () => {
    const closeSpy = vi.fn();
    component.closeToolBubble.subscribe(closeSpy);

    component.onCloseToolBubble();
    expect(closeSpy).toHaveBeenCalled();
  });
});
