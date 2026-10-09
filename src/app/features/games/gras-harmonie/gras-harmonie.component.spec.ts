import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GrasHarmonieComponent } from './gras-harmonie.component';
import { AudioService } from '../../../core/services/audio.service';

describe('GrasHarmonieComponent', () => {
  let component: GrasHarmonieComponent;
  let fixture: ComponentFixture<GrasHarmonieComponent>;
  let router: Router;
  let mockAudioService: { playWaterdropToneOn: any; playChime: any };

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [GrasHarmonieComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GrasHarmonieComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should change time of day and update body class list', () => {
    component.setTimeOfDay('golden');
    expect(component.timeOfDay()).toBe('golden');
    expect(document.body.classList.contains('in-sanctuary')).toBe(true);

    component.setTimeOfDay('night');
    expect(component.timeOfDay()).toBe('night');
    expect(document.body.classList.contains('in-night')).toBe(true);

    component.setTimeOfDay('day');
    expect(component.timeOfDay()).toBe('day');
    expect(document.body.classList.contains('in-night')).toBe(false);
    expect(document.body.classList.contains('in-sanctuary')).toBe(false);
  });

  it('should change wind preset', () => {
    component.setWindPreset('gust');
    expect(component.windPreset()).toBe('gust');
  });

  it('should navigate to bubble-hub on onEscape', () => {
    const navSpy = vi.spyOn(router, 'navigate');
    component.onEscape();
    expect(navSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });
});
