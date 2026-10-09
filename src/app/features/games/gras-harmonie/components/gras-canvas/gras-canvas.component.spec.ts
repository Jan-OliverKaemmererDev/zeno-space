import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrasCanvasComponent } from './gras-canvas.component';
import { GrasAudioService } from '../../services/gras-audio.service';
import { AudioService } from '../../../../../core/services/audio.service';

describe('GrasCanvasComponent', () => {
  let component: GrasCanvasComponent;
  let fixture: ComponentFixture<GrasCanvasComponent>;
  let mockAudioService: { playWaterdropToneOn: any; playChime: any };

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [GrasCanvasComponent],
      providers: [
        GrasAudioService,
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GrasCanvasComponent);
    component = fixture.componentInstance;
    component.timeOfDay = 'day';
    component.windPreset = 'fresh';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the canvas component instance', () => {
    expect(component).toBeTruthy();
  });

  it('should emit new wind speed display on applyWindPreset', () => {
    const speedSpy = vi.fn();
    component.windSpeedChange.subscribe(speedSpy);

    component.applyWindPreset('gentle');
    expect(speedSpy).toHaveBeenCalledWith('Sanfte Brise (8 km/h)');
  });
});
