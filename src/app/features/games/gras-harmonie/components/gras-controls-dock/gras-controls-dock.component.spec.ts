import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrasControlsDockComponent } from './gras-controls-dock.component';

describe('GrasControlsDockComponent', () => {
  let component: GrasControlsDockComponent;
  let fixture: ComponentFixture<GrasControlsDockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrasControlsDockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GrasControlsDockComponent);
    component = fixture.componentInstance;
    component.windPreset = 'fresh';
    fixture.detectChanges();
  });

  it('should create the controls dock component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit windPresetChange when a different preset is clicked', () => {
    const presetSpy = vi.fn();
    component.windPresetChange.subscribe(presetSpy);

    component.selectPreset('gust');
    expect(presetSpy).toHaveBeenCalledWith('gust');
  });

  it('should not emit windPresetChange if same preset is clicked', () => {
    const presetSpy = vi.fn();
    component.windPresetChange.subscribe(presetSpy);

    component.selectPreset('fresh');
    expect(presetSpy).not.toHaveBeenCalled();
  });

  it('should emit windGust when gust button is clicked', () => {
    const gustSpy = vi.fn();
    component.windGust.subscribe(gustSpy);

    component.onTriggerGust();
    expect(gustSpy).toHaveBeenCalled();
  });

  it('should apply active class to active preset pill', () => {
    fixture.componentRef.setInput('windPreset', 'gentle');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const activePill = compiled.querySelector('.dock-pill.active');
    expect(activePill?.textContent?.trim()).toBe('Sanft');
  });
});
