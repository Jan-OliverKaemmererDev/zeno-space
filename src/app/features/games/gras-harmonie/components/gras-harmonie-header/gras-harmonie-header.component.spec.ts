import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GrasHarmonieHeaderComponent } from './gras-harmonie-header.component';

describe('GrasHarmonieHeaderComponent', () => {
  let component: GrasHarmonieHeaderComponent;
  let fixture: ComponentFixture<GrasHarmonieHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrasHarmonieHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GrasHarmonieHeaderComponent);
    component = fixture.componentInstance;
    component.isMuted = false;
    fixture.detectChanges();
  });

  it('should create the header component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleSound when audio toggle button is clicked', () => {
    const toggleSpy = vi.fn();
    component.toggleSound.subscribe(toggleSpy);

    component.onToggleSound();
    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should show mute svg when isMuted is true', () => {
    fixture.componentRef.setInput('isMuted', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const btn = compiled.querySelector('.audio-toggle-btn');
    expect(btn?.getAttribute('aria-label')).toBe('Ton einschalten');

    const polygon = btn?.querySelector('polygon');
    expect(polygon).toBeTruthy();
    const lines = btn?.querySelectorAll('line');
    expect(lines?.length).toBe(2);
  });
});
